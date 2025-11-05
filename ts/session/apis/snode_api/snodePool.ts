import _, { fill, flatten, groupBy, isEmpty, map, pick, sample, shuffle } from 'lodash';
import pRetry from 'p-retry';

import { Data } from '../../../data/data';
import { Snode } from '../../../data/types';

import { OnionPaths } from '../../onions';
import { SeedNodeAPI } from '../seed_node_api';
import { ServiceNodesList } from './getServiceNodesList';
import { requestSnodesForPubkeyFromNetwork } from './getSwarmFor';
import { Onions } from '.';
import { ed25519Str } from '../../utils/String';
import { SnodePoolConstants } from './snodePoolConstants';
import { stringify } from '../../../types/sqlSharedTypes';
import { logDebugWithCat } from '../../../util/logger/debugLog';

let randomSnodePool: Array<Snode> = [];

function TEST_resetState(snodePoolForTest: Array<Snode> = []) {
  randomSnodePool = snodePoolForTest;
  swarmCache.clear();
}

// We only store nodes' identifiers here,
const swarmCache: Map<string, Array<string>> = new Map();

const logPrefix = '[snodePool]';

/**
 * Drop a snode from the snode pool. This does not update the swarm containing this snode.
 * Use `dropSnodeFromSwarmIfNeeded` for that
 * @param snodeEd25519 the snode ed25519 to drop from the snode pool
 */
async function dropSnodeFromSnodePool(snodeEd25519: string) {
  const exists = _.some(randomSnodePool, x => x.pubkey_ed25519 === snodeEd25519);
  if (exists) {
    _.remove(randomSnodePool, x => x.pubkey_ed25519 === snodeEd25519);
    window?.log?.warn(
      `${logPrefix} Dropping ${ed25519Str(snodeEd25519)} from snode pool. ${
        randomSnodePool.length
      } snodes remaining in randomPool`
    );
    await Data.updateSnodePoolOnDb(JSON.stringify(randomSnodePool));
  }
}

/**
 *
 * excludingEd25519Snode can be used to exclude some nodes from the random list.
 * Useful to rebuild a path excluding existing node already in a path
 */
async function getRandomSnode({
  snodesToExclude,
}: {
  snodesToExclude: Array<Snode>;
}): Promise<Snode> {
  // make sure we have a few snodes in the pool excluding the one passed as args
  const extraCountToAdd = snodesToExclude.length;
  const requestedCount = SnodePoolConstants.minSnodePoolCount + extraCountToAdd;
  if (randomSnodePool.length < requestedCount) {
    await SnodePool.getSnodePoolFromDBOrFetchFromSeed(extraCountToAdd);

    if (randomSnodePool.length < requestedCount) {
      window?.log?.warn(
        `${logPrefix} getRandomSnode: failed to fetch snodes from seed. Current pool: ${randomSnodePool.length}, requested count: ${requestedCount}`
      );

      throw new Error(
        `getRandomSnode: failed to fetch snodes from seed. Current pool: ${randomSnodePool.length}, requested count: ${requestedCount}`
      );
    }
  }
  // We know the pool can't be empty at this point
  if (!snodesToExclude.length) {
    const snodePicked = sample(randomSnodePool);
    if (!snodePicked) {
      throw new Error('getRandomSnode failed as sample returned none ');
    }
    return snodePicked;
  }

  // get an unmodified snode pool without the nodes to exclude either by pubkey or by subnet
  const snodePoolWithoutExcluded = window.sessionFeatureFlags?.useLocalDevNet
    ? randomSnodePool
    : randomSnodePool.filter(
        e =>
          !snodesToExclude.some(m => m.pubkey_ed25519 === e.pubkey_ed25519) &&
          !hasSnodeSameSubnetIp(snodesToExclude, e)
      );

  const weightedWithoutExcludedSnodes = getWeightedSingleSnodePerSubnet(snodePoolWithoutExcluded);
  logDebugWithCat(
    logPrefix,
    `getRandomSnode: snodePoolNoFilter: ${stringify(randomSnodePool.map(m => pick(m, ['ip', 'pubkey_ed25519'])))}`,
    window.sessionFeatureFlags.debugSnodePool
  );
  logDebugWithCat(
    logPrefix,
    `getRandomSnode: snodePoolWithoutExcluded: ${stringify(snodePoolWithoutExcluded.map(m => pick(m, ['ip', 'pubkey_ed25519'])))}`,
    window.sessionFeatureFlags.debugSnodePool
  );
  logDebugWithCat(
    logPrefix,
    `getRandomSnode: weightedWithoutExcludedSnodes: ${stringify(weightedWithoutExcludedSnodes.map(m => pick(m, ['ip', 'pubkey_ed25519'])))}`,
    window.sessionFeatureFlags.debugSnodePool
  );
  if (!weightedWithoutExcludedSnodes?.length) {
    // used for tests
    throw new Error(`Not enough snodes with snodes to exclude length:${snodesToExclude.length}`);
  }
  const snodePicked = sample(weightedWithoutExcludedSnodes);
  if (!snodePicked) {
    throw new Error('getRandomSnode failed as sample returned none');
  }

  logDebugWithCat(
    logPrefix,
    `getRandomSnode: snodePicked: ${stringify(snodePicked)}`,
    window.sessionFeatureFlags.debugSnodePool
  );
  return snodePicked;
}

/**
 * This function force the snode poll to be refreshed from a random seed node or snodes if we have enough of them.
 * This should be called once in a day or so for when the app it kept on.
 */
async function forceRefreshRandomSnodePool(): Promise<Array<Snode>> {
  try {
    await SnodePool.getSnodePoolFromDBOrFetchFromSeed();

    window?.log?.info(
      `${logPrefix} forceRefreshRandomSnodePool: enough snodes to fetch from them, so we try using them ${randomSnodePool.length}`
    );

    // this function throws if it does not have enough snodes to do it
    await tryToGetConsensusWithSnodesWithRetries();
    if (randomSnodePool.length < SnodePoolConstants.minSnodePoolCountBeforeRefreshFromSnodes) {
      throw new Error('forceRefreshRandomSnodePool still too small after refetching from snodes');
    }
  } catch (e) {
    window?.log?.warn(
      `${logPrefix} forceRefreshRandomSnodePool: Failed to fetch snode pool from snodes. Fetching from seed node instead:`,
      e.message
    );

    // if that fails to get enough snodes, even after retries, well we just have to retry later.
    try {
      await SnodePool.TEST_fetchFromSeedWithRetriesAndWriteToDb();
    } catch (err2) {
      window?.log?.warn(
        `${logPrefix} forceRefreshRandomSnodePool: Failed to fetch snode pool from seed. Fetching from seed node instead:`,
        err2.message
      );
    }
  }

  return randomSnodePool;
}

/**
 * Fetches from DB if snode pool is not cached, and returns it if the length is >= 12.
 * If length is < 12, fetches from seed an updated list of snodes
 */
async function getSnodePoolFromDBOrFetchFromSeed(
  countToAddToRequirement = 0
): Promise<Array<Snode>> {
  if (
    randomSnodePool &&
    randomSnodePool.length > SnodePoolConstants.minSnodePoolCount + countToAddToRequirement
  ) {
    return randomSnodePool;
  }
  const fetchedFromDb = await Data.getSnodePoolFromDb();

  if (
    !fetchedFromDb ||
    fetchedFromDb.length <= SnodePoolConstants.minSnodePoolCount + countToAddToRequirement
  ) {
    window?.log?.warn(
      `${logPrefix} getSnodePoolFromDBOrFetchFromSeed: not enough snodes in db (${fetchedFromDb?.length}), Fetching from seed node instead... `
    );
    // if that fails to get enough snodes, even after retries, well we just have to retry later.
    // this call does not throw
    await SnodePool.TEST_fetchFromSeedWithRetriesAndWriteToDb();

    return randomSnodePool;
  }

  // write to memory only if it is valid.
  randomSnodePool = fetchedFromDb;
  return randomSnodePool;
}

async function getRandomSnodePool(): Promise<Array<Snode>> {
  if (randomSnodePool.length <= SnodePoolConstants.minSnodePoolCount) {
    await SnodePool.getSnodePoolFromDBOrFetchFromSeed();
  }
  return randomSnodePool;
}

/**
 * This function tries to fetch snodes list from seed nodes and handle retries.
 * It will write the updated snode list to the db once it succeeded.
 * It also resets the onion paths failure count and snode failure count.
 * This function does not throw.
 */

async function TEST_fetchFromSeedWithRetriesAndWriteToDb() {
  const seedNodes = window.getSeedNodeList();

  if (!seedNodes || !seedNodes.length) {
    window?.log?.error(
      `${logPrefix} fetchFromSeedWithRetriesAndWriteToDb - getSeedNodeList has not been loaded yet`
    );

    return;
  }
  const start = Date.now();
  try {
    randomSnodePool = await SeedNodeAPI.fetchSnodePoolFromSeedNodeWithRetries(seedNodes);
    await Data.updateSnodePoolOnDb(JSON.stringify(randomSnodePool));
    window.log.info(
      `${logPrefix} fetchSnodePoolFromSeedNodeWithRetries took ${Date.now() - start}ms`
    );

    OnionPaths.resetPathFailureCount();
    Onions.resetSnodeFailureCount();
  } catch (e) {
    window?.log?.error(
      `${logPrefix} fetchFromSeedWithRetriesAndWriteToDb - Failed to fetch snode poll from seed node with retries. Error:`,
      e
    );
  }
}

async function clearOutAllSnodesNotInPool(snodePool: Array<Snode>) {
  if (snodePool.length <= 10) {
    return;
  }
  const edKeysOfSnodePool = snodePool.map(m => m.pubkey_ed25519);

  await Data.clearOutAllSnodesNotInPool(edKeysOfSnodePool);

  // just remove all the cached entries, we will refetch them as needed from the DB
  swarmCache.clear();
}

export function subnetOfIp(ip: string) {
  if (ip.lastIndexOf('.') === -1) {
    return ip;
  }
  return ip.slice(0, ip.lastIndexOf('.'));
}

function snodeSameSubnetIp(snode1: Snode, snode2: Snode) {
  return subnetOfIp(snode1.ip) === subnetOfIp(snode2.ip);
}

export function hasSnodeSameSubnetIp(snodes: Array<Snode>, snode: Snode) {
  return snodes.some(m => snodeSameSubnetIp(m, snode));
}

/**
 * Given an array of nodes, this function returns an array of nodes where a random node of each subnet is picked
 * and repeated as many times as the subnet was present.
 *
 * For instance: given the snode with ips: 10.0.0.{1,2,3}, 10.0.1.{1,2}, 10.0.2.{1,2,3,4} this function will return
 * an array of where a
 * - a random node of 10.0.0.{1,2,3} is picked and present 3 times
 * - a random node of 10.0.1.{1,2} is picked and present 2 times
 * - a random node of 10.0.2.{1,2,3,4} is picked and present 4 times
 */
function getWeightedSingleSnodePerSubnet(nodes: Array<Snode>) {
  // make sure to not reuse multiple times the same subnet /24
  const allNodesGroupedBySubnet24 = groupBy(nodes, n => subnetOfIp(n.ip));
  const oneNodeForEachSubnet24KeepingRatio = flatten(
    map(allNodesGroupedBySubnet24, group => {
      return fill(Array(group.length), sample(group) as Snode);
    })
  );
  return oneNodeForEachSubnet24KeepingRatio;
}

/**
 * This function retries a few times to get a consensus between 3 snodes of at least 24 snodes in the snode pool.
 *
 * If a consensus cannot be made, this function throws an error and the caller needs to call the fetch snodes from seed.
 *
 */
async function tryToGetConsensusWithSnodesWithRetries() {
  // let this request try 4 (3+1) times. If all those requests end up without having a consensus,
  // fetch the snode pool from one of the seed nodes (see the catch).
  return pRetry(
    async () => {
      const commonNodes = await ServiceNodesList.getSnodePoolFromSnodes();
      const requiredSnodesForAgreement = window.sessionFeatureFlags.useLocalDevNet
        ? 12
        : SnodePoolConstants.requiredSnodesForAgreement;
      if (!commonNodes || commonNodes.length < requiredSnodesForAgreement) {
        // throwing makes trigger a retry if we have some left.
        window?.log?.info(
          `${logPrefix} tryToGetConsensusWithSnodesWithRetries: Not enough common nodes ${commonNodes?.length}`
        );
        throw new Error('Not enough common nodes.');
      }
      window?.log?.info(
        `${logPrefix} Got consensus: updating snode list with snode pool length:`,
        commonNodes.length
      );
      randomSnodePool = commonNodes;
      await Data.updateSnodePoolOnDb(JSON.stringify(randomSnodePool));
      await clearOutAllSnodesNotInPool(randomSnodePool);

      OnionPaths.resetPathFailureCount();
      Onions.resetSnodeFailureCount();
    },
    {
      retries: 3,
      factor: 1,
      minTimeout: 1000,
      onFailedAttempt: e => {
        window?.log?.warn(
          `${logPrefix} tryToGetConsensusWithSnodesWithRetries attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left...`
        );
      },
    }
  );
}

/**
 * Drop a snode from the list of swarm for that specific publicKey
 * @param pubkey the associatedWith publicKey
 * @param snodeToDropEd25519 the snode pubkey to drop
 */
async function dropSnodeFromSwarmIfNeeded(
  pubkey: string,
  snodeToDropEd25519: string
): Promise<void> {
  // this call either used the cache or fetch the swarm from the db
  window?.log?.warn(
    `${logPrefix} Dropping ${ed25519Str(snodeToDropEd25519)} from swarm of ${ed25519Str(pubkey)}`
  );

  const existingSwarm = await SnodePool.getSwarmFromCacheOrDb(pubkey);

  if (!existingSwarm.includes(snodeToDropEd25519)) {
    return;
  }

  const updatedSwarm = existingSwarm.filter(ed25519 => ed25519 !== snodeToDropEd25519);
  await internalUpdateSwarmFor(pubkey, updatedSwarm);
}

async function updateSwarmFor(pubkey: string, snodes: Array<Snode>): Promise<void> {
  const edKeys = snodes.map((sn: Snode) => sn.pubkey_ed25519);
  await internalUpdateSwarmFor(pubkey, edKeys);
}

async function internalUpdateSwarmFor(pubkey: string, edKeys: Array<string>) {
  // update our in-memory cache
  swarmCache.set(pubkey, edKeys);
  // write this change to the db
  await Data.updateSwarmNodesForPubkey(pubkey, edKeys);
}

async function getSwarmFromCacheOrDb(pubkey: string): Promise<Array<string>> {
  // NOTE: important that maybeNodes is not [] here
  const existingCache = swarmCache.get(pubkey);
  if (existingCache === undefined) {
    // First time access, no cache yet, let's try the database.
    const nodes = await Data.getSwarmNodesForPubkey(pubkey);
    // if no db entry, this returns []
    swarmCache.set(pubkey, nodes);
    return nodes;
  }
  // cache already set, use it
  return existingCache;
}

/**
 * Returns the swarm size for the specified pubkey.
 * Note: this function does not fetch from the network or the database
 *
 */
function getCachedSwarmSizeForPubkey(pubkey: string) {
  // NOTE: important that maybeNodes is not [] here
  const existingCache = swarmCache.get(pubkey);
  if (existingCache === undefined) {
    return null;
  }
  return existingCache.length;
}

/**
 * This call fetch from cache or db the swarm and extract only the one currently reachable.
 * If not enough snodes valid are in the swarm, if fetches new snodes for this pubkey from the network.
 */
async function getSwarmFor(pubkey: string): Promise<Array<Snode>> {
  const nodes = await SnodePool.getSwarmFromCacheOrDb(pubkey);

  // See how many are actually still reachable
  // the nodes still reachable are the one still present in the snode pool
  const goodNodes = randomSnodePool.filter((n: Snode) => nodes.indexOf(n.pubkey_ed25519) !== -1);
  if (goodNodes.length >= SnodePoolConstants.minSwarmSnodeCount) {
    return goodNodes;
  }

  // Request new node list from the network and save it
  return getSwarmFromNetworkAndSave(pubkey);
}

async function getNodeFromSwarmOrThrow(pubkey: string): Promise<Snode> {
  const swarm = await SnodePool.getSwarmFor(pubkey);
  if (!isEmpty(swarm)) {
    const node = sample(swarm);
    if (node) {
      return node;
    }
  }
  window.log.warn(
    `${logPrefix} getNodeFromSwarmOrThrow: could not get one random node for pk ${ed25519Str(pubkey)}`
  );
  throw new Error(`getNodeFromSwarmOrThrow: could not get one random node`);
}

/**
 * Force a request to be made to the network to fetch the swarm of the specified pubkey, and cache the result.
 * Note: should not be called directly unless you know what you are doing. Use the cached `getSwarmFor()` function instead
 * @param pubkey the pubkey to request the swarm for
 * @returns the fresh swarm, shuffled
 */
async function getFreshSwarmFor(pubkey: string): Promise<Array<Snode>> {
  return getSwarmFromNetworkAndSave(pubkey);
}

async function getSwarmFromNetworkAndSave(pubkey: string) {
  // Request new node list from the network
  const swarm = await requestSnodesForPubkeyFromNetwork(pubkey);
  const shuffledSwarm = shuffle(swarm);

  const edKeys = shuffledSwarm.map((n: Snode) => n.pubkey_ed25519);
  await internalUpdateSwarmFor(pubkey, edKeys);

  return shuffledSwarm;
}

export const SnodePool = {
  // snode pool
  dropSnodeFromSnodePool,
  forceRefreshRandomSnodePool,
  getRandomSnode,
  getRandomSnodePool,
  getSnodePoolFromDBOrFetchFromSeed,
  getWeightedSingleSnodePerSubnet,

  // swarm
  dropSnodeFromSwarmIfNeeded,
  updateSwarmFor,
  getSwarmFromCacheOrDb,

  getSwarmFor,
  getNodeFromSwarmOrThrow,
  getFreshSwarmFor,
  getCachedSwarmSizeForPubkey,

  // tests
  TEST_resetState,
  TEST_fetchFromSeedWithRetriesAndWriteToDb,
};
