import { GroupPubkeyType } from 'libsession_util_nodejs';
import { isArray } from 'lodash';
import { Snode } from '../../../data/types';
import { SnodeNamespace, SnodeNamespaces, SnodeNamespacesGroup } from './namespaces';

import { UserGroupsWrapperActions } from '../../../webworker/workers/browser/libsession_worker_interface';
import { PubKey } from '../../types';
import { DURATION, TTL_DEFAULT } from '../../constants';
import { SnodeResponseError } from '../../utils/errors';
import {
  RetrieveGroupSubRequest,
  RetrieveUserSubRequest,
  UpdateExpiryOnNodeGroupSubRequest,
  UpdateExpiryOnNodeUserSubRequest,
} from './SnodeRequestTypes';
import { BatchRequests } from './batchRequest';
import {
  ExpireMessagesResultsContent,
  RetrieveMessagesResultsBatched,
  RetrieveMessagesResultsContent,
} from './types';
import { ed25519Str } from '../../utils/String';
import { NetworkTime } from '../../../util/NetworkTime';
import { detectMissingConfigHashes } from './configExpiryDetection';
import { ConfigRecovery } from './configRecovery';
import { BatchResultEntry } from './BatchResultEntry';

type RetrieveParams = {
  pubkey: string;
  last_hash: string;
  timestamp: number;
  max_size: number | undefined;
};

async function retrieveRequestForUs({
  namespace,
  retrieveParam,
}: {
  namespace: SnodeNamespaces;
  retrieveParam: RetrieveParams;
}) {
  if (!SnodeNamespace.isUserConfigNamespace(namespace) && namespace !== SnodeNamespaces.Default) {
    throw new Error(`retrieveRequestForUs not a valid namespace to retrieve as us:${namespace}`);
  }
  return new RetrieveUserSubRequest({
    last_hash: retrieveParam.last_hash,
    max_size: retrieveParam.max_size,
    namespace,
  });
}

type NamespaceAndLastHash = { lastHash: string | null; namespace: SnodeNamespaces };

/**
 * Retrieve for groups (03-prefixed) are authenticated with the admin key if we have it, or with our sub key auth
 */
async function retrieveRequestForGroup({
  namespace,
  groupPk,
  retrieveParam,
}: {
  groupPk: GroupPubkeyType;
  namespace: SnodeNamespacesGroup;
  retrieveParam: RetrieveParams;
}) {
  if (!PubKey.is03Pubkey(groupPk)) {
    throw new Error('retrieveRequestForGroup: not a 03 group');
  }
  if (!SnodeNamespace.isGroupNamespace(namespace)) {
    throw new Error(`retrieveRequestForGroup: not a groupNamespace: ${namespace}`);
  }
  const group = await UserGroupsWrapperActions.getGroup(groupPk);

  return new RetrieveGroupSubRequest({
    last_hash: retrieveParam.last_hash,
    namespace,
    max_size: retrieveParam.max_size,
    groupDetailsNeededForSignature: group,
  });
}

type RetrieveSubRequestType =
  | RetrieveUserSubRequest
  | RetrieveGroupSubRequest
  | UpdateExpiryOnNodeUserSubRequest
  | UpdateExpiryOnNodeGroupSubRequest;

/**
 * build the Array of retrieveRequests to do on the next poll, given the specified namespaces, lastHash, pubkey and hashes to bump (expiry)
 * Note: exported only for testing purposes
 * @param namespacesAndLastHashes
 * @param pubkey
 * @param ourPubkey
 * @param configHashesToBump
 * @returns
 */
async function buildRetrieveRequest(
  namespacesAndLastHashes: Array<NamespaceAndLastHash>,
  pubkey: string,
  ourPubkey: string,
  configHashesToBump: Array<string> | null
) {
  const isUs = pubkey === ourPubkey;
  const maxSizeMap = SnodeNamespace.maxSizeMap(namespacesAndLastHashes.map(m => m.namespace));
  const now = NetworkTime.now();

  const retrieveRequestsParams: Array<RetrieveSubRequestType> = await Promise.all(
    namespacesAndLastHashes.map(async ({ lastHash, namespace }) => {
      const foundMaxSize = maxSizeMap.find(m => m.namespace === namespace)?.maxSize;
      const retrieveParam = {
        pubkey,
        last_hash: lastHash || '',
        timestamp: now,
        max_size: foundMaxSize,
      };

      if (PubKey.is03Pubkey(pubkey)) {
        if (!SnodeNamespace.isGroupNamespace(namespace)) {
          // either config or messages namespaces for 03 groups
          throw new Error(`tried to poll from a non 03 group namespace ${namespace}`);
        }
        return retrieveRequestForGroup({ namespace, groupPk: pubkey, retrieveParam });
      }

      // all legacy closed group retrieves are unauthenticated and run above.
      // if we get here, this can only be a retrieve for our own swarm, which must be authenticated
      return retrieveRequestForUs({ namespace, retrieveParam });
    })
  );

  const expiryMs = NetworkTime.now() + TTL_DEFAULT.CONFIG_MESSAGE;

  if (configHashesToBump?.length && isUs) {
    const request = new UpdateExpiryOnNodeUserSubRequest({
      expiryMs,
      messagesHashes: configHashesToBump,
      // extend-only: bumping a config TTL must never be able to shorten it, and it is what makes
      // the server return the `unchanged` array we need to detect configs expired from the swarm.
      shortenOrExtend: 'extend',
    });
    retrieveRequestsParams.push(request);
    return retrieveRequestsParams;
  }

  if (configHashesToBump?.length && PubKey.is03Pubkey(pubkey)) {
    const group = await UserGroupsWrapperActions.getGroup(pubkey);

    if (!group) {
      window.log.warn(
        `trying to retrieve for group ${ed25519Str(
          pubkey
        )} but we are missing the details in the user group wrapper`
      );
      throw new Error('retrieve request is missing group details');
    }

    retrieveRequestsParams.push(
      new UpdateExpiryOnNodeGroupSubRequest({
        expiryMs,
        messagesHashes: configHashesToBump,
        // extend-only, same as the user path above: bumping a config TTL must never shorten it,
        // and it is what makes the server return the `unchanged` array detection needs.
        shortenOrExtend: 'extend',
        groupDetailsNeededForSignature: group,
      })
    );
  }
  return retrieveRequestsParams;
}

/**
 * Read the `expire` sub-response we piggyback on every poll to work out whether any of our config
 * messages have expired from the swarm, and record it. Acting on it happens after the merge, in
 * `swarmPolling` — see guard §4.1.
 *
 * This only ever records; it must not throw into the polling path.
 */
function detectExpiredConfigs({
  associatedWith,
  configHashesToBump,
  expireSubRequest,
  expireResult,
}: {
  associatedWith: string;
  configHashesToBump: Array<string>;
  expireSubRequest: RetrieveSubRequestType | undefined;
  expireResult: BatchResultEntry;
}) {
  try {
    if (expireSubRequest?.method !== 'expire') {
      return;
    }

    // Note: read from the request we actually built rather than assuming. A response to a request
    // that didn't set `extend` omits `unchanged` entirely, which makes every hash we didn't update
    // look missing — so if that flag ever changes, detection has to switch itself off rather than
    // report the whole config gone on every poll.
    const detection = detectMissingConfigHashes({
      requestedHashes: configHashesToBump,
      swarm: (expireResult.body as { swarm?: ExpireMessagesResultsContent })?.swarm,
      requestSetExtend: expireSubRequest.shortenOrExtend === 'extend',
    });

    if (detection.status === 'conclusive' && detection.missingHashes.length) {
      window.log.warn(
        `SwarmPolling: ${detection.missingHashes.length} config message(s) missing from the swarm of ${ed25519Str(associatedWith)}`
      );
    }

    ConfigRecovery.recordDetection(associatedWith, detection);
  } catch (e) {
    window.log.warn('detectExpiredConfigs failed with:', e.message);
  }
}

/**
 *
 * @param targetNode the node to make the request to
 * @param associatedWith the pubkey for which this request is, used to handle 421 errors
 * @param namespacesAndLastHashes the details of the retrieve request to make
 * @param ourPubkey our current user pubkey
 * @param configHashesToBump the config hashes to update the expiry of
 * @param allow401s for groups we allow a 401 to not throw as we can be removed from it, but we still need to process part of the result.
 * @returns an array of results with exactly namespacesAndLastHashes.length items in it.
 *
 * Note: Even if configHashesToBump is set, its result will be excluded from the return of this function, so what you get is always of namespacesAndLastHashes.length
 */
async function retrieveNextMessagesNoRetries(
  targetNode: Snode,
  associatedWith: string,
  namespacesAndLastHashes: Array<NamespaceAndLastHash>,
  ourPubkey: string,
  configHashesToBump: Array<string> | null,
  allow401s: boolean
): Promise<RetrieveMessagesResultsBatched> {
  const rawRequests = await buildRetrieveRequest(
    namespacesAndLastHashes,
    associatedWith,
    ourPubkey,
    configHashesToBump
  );

  // let exceptions bubble up
  // no retry for this one as this a call we do every few seconds while polling for messages

  // just to make sure that we don't hang for more than timeOutMs
  const results = await BatchRequests.doUnsignedSnodeBatchRequestNoRetries({
    unsignedSubRequests: rawRequests,
    targetNode,
    // yes this is a long timeout for just messages, but 4s timeouts way to often...
    timeoutMs: 10 * DURATION.SECONDS,
    associatedWith,
    allow401s,
    method: 'batch',
    abortSignal: null,
  });
  try {
    if (!results || !isArray(results) || !results.length) {
      window?.log?.warn(
        `_retrieveNextMessages - sessionRpc could not talk to ${targetNode.ip}:${targetNode.port}`
      );
      throw new SnodeResponseError(
        `_retrieveNextMessages - sessionRpc could not talk to ${targetNode.ip}:${targetNode.port}`
      );
    }

    // One result per sub-request, and it must STAY a throw rather than becoming a filter or a
    // tolerance: everything below pairs `results[index]` with `namespacesAndLastHashes[index]` by
    // position, so a missing result does not drop a namespace — it shifts every later one onto its
    // neighbour's messages.
    //
    // This used to accept `namespacesAndLastHashes.length` OR that +1, to allow for the `expire`
    // sub-request only being appended when there are config hashes to bump. But two accepted
    // lengths is the same hole as a filter: with `expire` appended, a response that dropped one
    // retrieve result lands on the lower bound, passes, and then the LAST namespace is handed the
    // expire result as its messages. `rawRequests` already accounts for the conditional
    // sub-request, so comparing against it states the real invariant and admits only one length.
    if (results.length !== rawRequests.length) {
      throw new Error(
        `We asked for ${rawRequests.length} sub-requests but got results of length ${results.length}`
      );
    }

    // do a basic check to know if we have something kind of looking right (status 200 should always be there for a retrieve)
    const firstResult = results[0];

    if (firstResult.code !== 200) {
      window?.log?.warn(`retrieveNextMessagesNoRetries result is not 200 but ${firstResult.code}`);
      throw new Error(
        `_retrieveNextMessages - retrieve result is not 200 with ${targetNode.ip}:${targetNode.port} but ${firstResult.code}`
      );
    }
    // Safe to read both `length - 1` slots as a pair only because the check above admits exactly
    // one length: `configHashesToBump` being set means `buildRetrieveRequest` appended the expire
    // sub-request last, and the result array is now known to be the same length. Loosen that check
    // and this pairs an expire request with a retrieve response.
    if (configHashesToBump?.length) {
      const lastResult = results[results.length - 1];
      if (lastResult?.code !== 200) {
        // the update expiry of our config messages didn't work.
        window.log.warn(
          `the update expiry of our tracked config hashes didn't work: ${JSON.stringify(lastResult)}`
        );
      } else {
        detectExpiredConfigs({
          associatedWith,
          configHashesToBump,
          expireSubRequest: rawRequests[rawRequests.length - 1],
          expireResult: lastResult,
        });
      }
    }

    // merge results with their corresponding namespaces
    // NOTE: We don't want to sort messages here because the ordering depends on the snode and when it received each message.
    // The last_hash for that snode has to be the last one we've received from that same snode, otherwise we end up fetching the same messages over and over again.
    const toRet = namespacesAndLastHashes.map((n, index) => ({
      code: results[index].code,
      messages: results[index].body as RetrieveMessagesResultsContent,
      namespace: n.namespace,
    }));
    return toRet;
  } catch (e) {
    window?.log?.warn('exception while parsing json of nextMessage:', e);
    throw new Error(
      `_retrieveNextMessages - exception while parsing json of nextMessage ${targetNode.ip}:${targetNode.port}: ${e?.message}`
    );
  }
}

export const SnodeAPIRetrieve = { retrieveNextMessagesNoRetries, buildRetrieveRequest };
