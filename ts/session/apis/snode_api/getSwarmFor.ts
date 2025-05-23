import { isArray } from 'lodash';
import pRetry from 'p-retry';
import { PubKey } from '../../types';
import { BatchRequests } from './batchRequest';
import { GetNetworkTime } from './getNetworkTime';
import { SnodePool } from './snodePool';
import { Snode } from '../../../data/types';
import { SwarmForSubRequest } from './SnodeRequestTypes';
import { DURATION } from '../../constants';

/**
 * get snodes for pubkey from random snode. Uses an existing snode
 */
async function requestSnodesForPubkeyWithTargetNodeRetryable(
  pubkey: string,
  targetNode: Snode
): Promise<Array<Snode>> {
  if (!PubKey.is03Pubkey(pubkey) && !PubKey.is05Pubkey(pubkey)) {
    throw new Error('invalid pubkey given for swarmFor');
  }
  const subRequest = new SwarmForSubRequest(pubkey);

  const result = await BatchRequests.doUnsignedSnodeBatchRequestNoRetries({
    unsignedSubRequests: [subRequest],
    targetNode,
    timeoutMs: 10 * DURATION.SECONDS,
    associatedWith: pubkey,
    allow401s: false,
    method: 'batch',
    abortSignal: null,
  });

  if (!result || !result.length) {
    window?.log?.warn(
      `SessionSnodeAPI::requestSnodesForPubkeyWithTargetNodeRetryable - sessionRpc on ${targetNode.ip}:${targetNode.port} returned falsy value`,
      result
    );
    throw new Error('requestSnodesForPubkeyWithTargetNodeRetryable: Invalid result');
  }

  const firstResult = result[0];

  if (firstResult.code !== 200) {
    window?.log?.warn('Status is not 200 for get_swarm but: ', firstResult.code);
    throw new Error('requestSnodesForPubkeyWithTargetNodeRetryable: Invalid status code');
  }

  try {
    const body = firstResult.body;
    if (!body.snodes || !isArray(body.snodes) || !body.snodes.length) {
      window?.log?.warn(
        `SessionSnodeAPI::requestSnodesForPubkeyRetryable - sessionRpc on ${targetNode.ip}:${targetNode.port} returned falsy value for snodes`,
        result
      );
      throw new Error('requestSnodesForPubkey: Invalid json (empty)');
    }

    // NOTE Filter out 0.0.0.0 nodes which haven't submitted uptime proofs
    const snodes = body.snodes.filter((tSnode: any) => tSnode.ip !== '0.0.0.0');
    GetNetworkTime.handleTimestampOffsetFromNetwork('get_swarm', body.t);
    return snodes;
  } catch (e) {
    throw new Error('Invalid json');
  }
}

async function requestSnodesForPubkeyWithTargetNode(
  pubKey: string,
  targetNode: Snode
): Promise<Array<Snode>> {
  // don't catch exception in here. we want them to bubble up

  // this is the level where our targetNode is supposed to be valid. We retry a few times with this one.
  // if all our retries fails, we retry from the caller of this function with a new target node.
  return pRetry(
    async () => {
      return requestSnodesForPubkeyWithTargetNodeRetryable(pubKey, targetNode);
    },
    {
      retries: 3,
      factor: 2,
      minTimeout: 100,
      maxTimeout: 2000,
      onFailedAttempt: e => {
        window?.log?.warn(
          `requestSnodesForPubkeyWithTargetNode attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left...`
        );
      },
    }
  );
}

async function requestSnodesForPubkeyRetryable(pubKey: string): Promise<Array<Snode>> {
  // don't catch exception in here. we want them to bubble up

  // this is the level where our targetNode is not yet known. We retry a few times with a new one every time.
  // the idea is that the requestSnodesForPubkeyWithTargetNode will remove a failing targetNode
  return pRetry(
    async () => {
      const targetNode = await SnodePool.getRandomSnode();

      return requestSnodesForPubkeyWithTargetNode(pubKey, targetNode);
    },
    {
      retries: 3,
      factor: 2,
      minTimeout: 100,
      maxTimeout: 10000,
      onFailedAttempt: e => {
        window?.log?.warn(
          `requestSnodesForPubkeyRetryable attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left...`
        );
      },
    }
  );
}

export async function requestSnodesForPubkeyFromNetwork(pubKey: string): Promise<Array<Snode>> {
  try {
    // catch exception in here only.
    // the idea is that the p-retry will retry a few times each calls, except if an AbortError is thrown.

    // if all retry fails, we will end up in the catch below when the last exception thrown
    return await requestSnodesForPubkeyRetryable(pubKey);
  } catch (e) {
    window?.log?.error('SessionSnodeAPI::requestSnodesForPubkey - error', e);

    return [];
  }
}
