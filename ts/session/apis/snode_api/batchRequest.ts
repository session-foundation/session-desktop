import { isArray } from 'lodash';
import { AbortController } from 'abort-controller';

import { MessageSender } from '../../sending';
import { SnodeResponseError } from '../../utils/errors';
import { processOnionRequestErrorAtDestination, SnodeResponse } from './onions';
import { SessionRpc } from './sessionRpc';
import {
  builtRequestToLoggingId,
  BuiltSnodeSubRequests,
  MAX_SUBREQUESTS_COUNT,
  RawSnodeSubRequests,
  WithMethodBatchType,
} from './SnodeRequestTypes';
import { NotEmptyArrayOfBatchResults } from './BatchResultEntry';
import { MergedAbortSignal, WithTimeoutMs } from './requestWith';
import { WithAllow401s, WithAssociatedWith, WithTargetNode } from '../../types/with';

function logSubRequests(requests: Array<BuiltSnodeSubRequests>) {
  return `[${requests.map(builtRequestToLoggingId).join(', ')}]`;
}

/**
 * This is the equivalent to the batch send on sogs. The target node runs each sub request and returns a list of all the sub status and bodies.
 * If the global status code is not 200, an exception is thrown.
 * The body is already parsed from json and is enforced to be an Array of at least one element
 * Note: This function does not retry by itself.
 *
 * @param subRequests the list of requests to do
 * @param targetNode the node to do the request to, once all the onion routing is done
 * @param timeout the timeout at which we should cancel this request.
 * @param associatedWith used mostly for handling 421 errors, we need the pubkey the change is associated to
 * @param method can be either batch or sequence. A batch call will run all calls even if one of them fails. A sequence call will stop as soon as the first one fails
 */
async function doSnodeBatchRequestNoRetries({
  allow401s,
  associatedWith,
  method,
  subRequests,
  targetNode,
  timeoutMs,
  abortSignal,
}: WithTargetNode &
  WithTimeoutMs &
  WithAssociatedWith &
  WithAllow401s &
  WithMethodBatchType & {
    subRequests: Array<BuiltSnodeSubRequests>;
    abortSignal?: MergedAbortSignal;
  }): Promise<NotEmptyArrayOfBatchResults> {
  window.log.debug(
    `doSnodeBatchRequestNoRetries "${method}":`,
    JSON.stringify(logSubRequests(subRequests))
  );

  if (subRequests.length > MAX_SUBREQUESTS_COUNT) {
    window.log.error(
      `batch subRequests count cannot be more than ${MAX_SUBREQUESTS_COUNT}. Got ${subRequests.length}`
    );
    throw new Error(
      `batch subRequests count cannot be more than ${MAX_SUBREQUESTS_COUNT}. Got ${subRequests.length}`
    );
  }
  const result = await SessionRpc.snodeRpcNoRetries({
    method,
    params: { requests: subRequests },
    targetNode,
    associatedWith,
    allow401s,
    timeoutMs,
    abortSignal: abortSignal || new AbortController().signal,
  });

  if (!result) {
    window?.log?.warn(
      `doSnodeBatchRequestNoRetries - sessionRpc could not talk to ${targetNode.ip}:${targetNode.port}`
    );

    throw new SnodeResponseError(
      `doSnodeBatchRequest - sessionRpc could not talk to ${targetNode.ip}:${targetNode.port}`
    );
  }
  const decoded = decodeBatchRequest(result);

  if (decoded?.length) {
    for (let index = 0; index < decoded.length; index++) {
      const resultRow = decoded[index];
      // eslint-disable-next-line no-await-in-loop
      await processOnionRequestErrorAtDestination({
        statusCode: resultRow.code,
        body: JSON.stringify(resultRow.body),
        associatedWith: associatedWith || undefined,
        destinationSnodeEd25519: targetNode.pubkey_ed25519,
        allow401s,
      });
    }
  }

  return decoded;
}

/**
 * This function can be called to sign subrequests and then call doSnodeBatchRequestNoRetries with them.
 *
 * Note: this function does not retry.
 *
 * @param unsignedSubRequests the unsigned sub requests to make
 * @param targetNode the snode to make the request to
 * @param timeoutMs the max timeout to wait for a reply
 * @param associatedWith the pubkey associated with this request (used to remove snode failing to reply from that users' swarm)
 * @param method the type of request to make batch or sequence
 * @param allow401 on very specific use case, we need to allow 401 (Group kicked event)
 * @param abortSignal the signal used to know when we should abort the request
 */
async function doUnsignedSnodeBatchRequestNoRetries({
  unsignedSubRequests,
  targetNode,
  timeoutMs,
  associatedWith,
  method,
  allow401s,
  abortSignal,
}: WithTargetNode &
  WithTimeoutMs &
  WithAssociatedWith &
  WithAllow401s &
  WithMethodBatchType & {
    unsignedSubRequests: Array<RawSnodeSubRequests>;
    abortSignal: MergedAbortSignal | null;
  }): Promise<NotEmptyArrayOfBatchResults> {
  const signedSubRequests = await MessageSender.signSubRequests(unsignedSubRequests);
  return BatchRequests.doSnodeBatchRequestNoRetries({
    subRequests: signedSubRequests,
    targetNode,
    timeoutMs,
    associatedWith,
    allow401s,
    abortSignal: abortSignal || undefined,
    method,
  });
}

/**
 * Make sure the global batch status code is 200, parse the content as json and return it
 */
function decodeBatchRequest(snodeResponse: SnodeResponse): NotEmptyArrayOfBatchResults {
  try {
    if (snodeResponse.status !== 200) {
      throw new Error(`decodeBatchRequest invalid status code: ${snodeResponse.status}`);
    }
    const parsed = JSON.parse(snodeResponse.body);

    if (!isArray(parsed.results)) {
      throw new Error('decodeBatchRequest results is not an array');
    }

    if (!parsed.results.length) {
      throw new Error('decodeBatchRequest results an empty array');
    }

    return parsed.results;
  } catch (e) {
    window.log.error('decodeBatchRequest failed with ', e.message);
    throw e;
  }
}

export const BatchRequests = {
  doSnodeBatchRequestNoRetries,
  doUnsignedSnodeBatchRequestNoRetries,
};
