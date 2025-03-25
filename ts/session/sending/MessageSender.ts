// REMOVE COMMENT AFTER: This can just export pure functions as it doesn't need state

import { AbortController } from 'abort-controller';
import { GroupPubkeyType, PubkeyType } from 'libsession_util_nodejs';
import { isArray, isEmpty, isNumber, isString } from 'lodash';
import pRetry from 'p-retry';
import { Data } from '../../data/data';
import { UserGroupsWrapperActions } from '../../webworker/workers/browser/libsession_worker_interface';
import { OpenGroupMessageV2 } from '../apis/open_group_api/opengroupV2/OpenGroupMessageV2';
import {
  sendMessageOnionV4BlindedRequest,
  sendSogsMessageOnionV4,
} from '../apis/open_group_api/sogsv3/sogsV3SendMessage';
import {
  BuiltSnodeSubRequests,
  DeleteAllFromGroupMsgNodeSubRequest,
  DeleteHashesFromGroupNodeSubRequest,
  DeleteHashesFromUserNodeSubRequest,
  isStoreUserInitiatedSubRequest,
  MethodBatchType,
  RawSnodeSubRequests,
  StoreGroupInfoSubRequest,
  StoreGroupKeysSubRequest,
  StoreGroupMembersSubRequest,
  StoreGroupMessageSubRequest,
  StoreGroupRevokedRetrievableSubRequest,
  StoreUserConfigSubRequest,
  StoreUserMessageSubRequest,
  SubaccountRevokeSubRequest,
  SubaccountUnrevokeSubRequest,
  type DeleteAllFromGroupNodeSubRequest,
} from '../apis/snode_api/SnodeRequestTypes';
import { NotEmptyArrayOfBatchResults } from '../apis/snode_api/BatchResultEntry';
import { BatchRequests } from '../apis/snode_api/batchRequest';
import { GetNetworkTime } from '../apis/snode_api/getNetworkTime';
import { SnodeNamespace, SnodeNamespaces } from '../apis/snode_api/namespaces';
import {
  SigResultAdmin,
  SigResultSubAccount,
  SnodeGroupSignature,
} from '../apis/snode_api/signature/groupSignature';
import { SnodeSignature, SnodeSignatureResult } from '../apis/snode_api/signature/snodeSignatures';
import { SnodePool } from '../apis/snode_api/snodePool';
import { DURATION, TTL_DEFAULT } from '../constants';
import { ConvoHub } from '../conversations';
import { addMessagePadding } from '../crypto/BufferPadding';
import { ContentMessage } from '../messages/outgoing';
import { UnsendMessage } from '../messages/outgoing/controlMessage/UnsendMessage';
import { OpenGroupVisibleMessage } from '../messages/outgoing/visibleMessage/OpenGroupVisibleMessage';
import { PubKey } from '../types';
import { OutgoingRawMessage } from '../types/RawMessage';
import { UserUtils } from '../utils';
import { ed25519Str, fromUInt8ArrayToBase64 } from '../utils/String';
import { MessageSentHandler } from './MessageSentHandler';
import { EncryptAndWrapMessageResults, MessageWrapper } from './MessageWrapper';
import { SaveSeenMessageHash, stringify } from '../../types/sqlSharedTypes';
import { OpenGroupRequestCommonType } from '../../data/types';
import { NetworkTime } from '../../util/NetworkTime';
import { MergedAbortSignal } from '../apis/snode_api/requestWith';
import { WithAllow401s } from '../types/with';
import { ERROR_421_HANDLED_RETRY_REQUEST } from '../apis/snode_api/onions';

// ================ SNODE STORE ================

function getMinRetryTimeout() {
  return 1000;
}

function isContentSyncMessage(message: ContentMessage) {
  if (message instanceof UnsendMessage || (message as any).syncTarget?.length > 0) {
    return true;
  }
  return false;
}

type StoreRequest05 = StoreUserConfigSubRequest | StoreUserMessageSubRequest;

type StoreRequest03 =
  | StoreGroupInfoSubRequest
  | StoreGroupMembersSubRequest
  | StoreGroupKeysSubRequest
  | StoreGroupRevokedRetrievableSubRequest
  | StoreGroupMessageSubRequest;

type StoreRequestPerPubkey<T extends GroupPubkeyType | PubkeyType> = T extends PubkeyType
  ? StoreRequest05
  : StoreRequest03;

type EncryptedMessageDetails = Pick<
  EncryptAndWrapMessageResults,
  | 'namespace'
  | 'encryptedAndWrappedData'
  | 'identifier'
  | 'ttl'
  | 'networkTimestamp'
  | 'plainTextBuffer'
>;

async function messageToRequest05({
  destination,
  encryptedAndWrapped: {
    namespace,
    encryptedAndWrappedData,
    identifier,
    ttl,
    networkTimestamp,
    plainTextBuffer,
  },
}: {
  destination: PubkeyType;
  encryptedAndWrapped: EncryptedMessageDetails;
}): Promise<StoreRequest05> {
  const shared05Arguments = {
    encryptedData: encryptedAndWrappedData,
    dbMessageIdentifier: identifier || null,
    ttlMs: ttl,
    destination,
    namespace,
    createdAtNetworkTimestamp: networkTimestamp,
    plainTextBuffer,
    getNow: NetworkTime.now,
  };
  if (namespace === SnodeNamespaces.Default) {
    return new StoreUserMessageSubRequest(shared05Arguments);
  }

  if (SnodeNamespace.isUserConfigNamespace(namespace)) {
    return new StoreUserConfigSubRequest(shared05Arguments);
  }

  window.log.error(
    `unhandled messageToRequest05 case with details: ${ed25519Str(destination)},namespace: ${namespace}`
  );
  throw new Error(
    `unhandled messageToRequest05 case for 05 ${ed25519Str(destination)} and namespace ${namespace}`
  );
}

async function messageToRequest03({
  destination,
  encryptedAndWrapped: { namespace, encryptedAndWrappedData, identifier, ttl, networkTimestamp },
}: {
  destination: GroupPubkeyType;
  encryptedAndWrapped: Pick<
    EncryptAndWrapMessageResults,
    'namespace' | 'encryptedAndWrappedData' | 'identifier' | 'ttl' | 'networkTimestamp'
  >;
}): Promise<StoreRequest03> {
  const group = UserGroupsWrapperActions.getCachedGroup(destination);
  if (!group) {
    window.log.warn(
      `messageToRequest03: no such group found in wrapper: ${ed25519Str(destination)}`
    );
    throw new Error('messageToRequest03: no such group found in wrapper');
  }
  const shared03Arguments = {
    encryptedData: encryptedAndWrappedData,
    namespace,
    ttlMs: ttl,
    groupPk: destination,
    dbMessageIdentifier: identifier || null,
    createdAtNetworkTimestamp: networkTimestamp,
    getNow: NetworkTime.now,
    ...group,
  };
  if (
    SnodeNamespace.isGroupConfigNamespace(namespace) ||
    namespace === SnodeNamespaces.ClosedGroupMessages
  ) {
    return new StoreGroupMessageSubRequest(shared03Arguments);
  }
  window.log.error(
    `unhandled messageToRequest03 case with details: ${ed25519Str(destination)},namespace: ${namespace}`
  );
  throw new Error(
    `unhandled messageToRequest03 case for 03 ${ed25519Str(destination)} and namespace ${namespace}`
  );
}

async function messageToRequest<T extends GroupPubkeyType | PubkeyType>({
  destination,
  encryptedAndWrapped,
}: {
  destination: T;
  encryptedAndWrapped: EncryptedMessageDetails;
}): Promise<StoreRequestPerPubkey<T>> {
  if (PubKey.is03Pubkey(destination)) {
    const req = await messageToRequest03({ destination, encryptedAndWrapped });
    return req as StoreRequestPerPubkey<T>; // this is mandatory, sadly
  }
  if (PubKey.is05Pubkey(destination)) {
    const req = await messageToRequest05({
      destination,
      encryptedAndWrapped,
    });
    return req as StoreRequestPerPubkey<T>; // this is mandatory, sadly
  }

  throw new Error('messageToRequest: unhandled case');
}

async function messagesToRequests<T extends GroupPubkeyType | PubkeyType>({
  destination,
  encryptedAndWrappedArr,
}: {
  destination: T;
  encryptedAndWrappedArr: Array<EncryptedMessageDetails>;
}): Promise<Array<StoreRequestPerPubkey<T>>> {
  const subRequests: Array<StoreRequestPerPubkey<T>> = [];
  for (let index = 0; index < encryptedAndWrappedArr.length; index++) {
    const encryptedAndWrapped = encryptedAndWrappedArr[index];
    // eslint-disable-next-line no-await-in-loop
    const req = await messageToRequest({ destination, encryptedAndWrapped });
    subRequests.push(req);
  }
  return subRequests;
}

/**
 * Send a single message via service nodes.
 *
 * @param message The message to send.
 * @param attempts The amount of times to attempt sending. Minimum value is 1.
 */

async function sendSingleMessage({
  message,
  retryMinTimeout = 100,
  attempts = 3,
  isSyncMessage,
  abortSignal,
}: {
  message: OutgoingRawMessage;
  abortSignal: MergedAbortSignal | null;
  attempts?: number;
  retryMinTimeout?: number; // in ms
  isSyncMessage: boolean;
}): Promise<{ wrappedEnvelope: Uint8Array; effectiveTimestamp: number }> {
  const destination = message.device;
  if (!PubKey.is03Pubkey(destination) && !PubKey.is05Pubkey(destination)) {
    throw new Error('MessageSender rawMessage was given invalid pubkey');
  }
  return pRetry(
    async () => {
      try {
        const recipient = PubKey.cast(message.device);
        // we can only have a single message in this send function for now
        const [encryptedAndWrapped] = await MessageWrapper.encryptMessagesAndWrap([
          {
            destination: message.device,
            plainTextBuffer: message.plainTextBuffer,
            namespace: message.namespace,
            ttl: message.ttl,
            identifier: message.identifier,
            networkTimestamp: message.networkTimestampCreated,
            isSyncMessage: Boolean(isSyncMessage),
          },
        ]);

        // make sure to update the local sent_at timestamp, because sometimes, we will get the just pushed message in the receiver side
        // before we return from the await below.
        // and the isDuplicate messages relies on sent_at timestamp to be valid.
        const found = await Data.getMessageById(encryptedAndWrapped.identifier);

        // make sure to not update the sent timestamp if this a currently syncing message
        if (found && !found.get('sentSync')) {
          found.set({ sent_at: encryptedAndWrapped.networkTimestamp });
          await found.commit();
        }
        const isSyncedDeleteAfterReadMessage =
          found &&
          UserUtils.isUsFromCache(recipient.key) &&
          found.getExpirationType() === 'deleteAfterRead' &&
          found.getExpireTimerSeconds() > 0 &&
          encryptedAndWrapped.isSyncMessage;

        let overriddenTtl = encryptedAndWrapped.ttl;
        if (isSyncedDeleteAfterReadMessage && found.getExpireTimerSeconds() > 0) {
          const asMs = found.getExpireTimerSeconds() * 1000;
          window.log.debug(`overriding ttl for synced DaR message to ${asMs}`);
          overriddenTtl = asMs;
        }

        const subRequests = await messagesToRequests({
          encryptedAndWrappedArr: [{ ...encryptedAndWrapped, ttl: overriddenTtl }],
          destination,
        });

        const targetNode = await SnodePool.getNodeFromSwarmOrThrow(destination);

        const batchResult = await BatchRequests.doUnsignedSnodeBatchRequestNoRetries({
          unsignedSubRequests: subRequests,
          targetNode,
          timeoutMs: 10 * DURATION.SECONDS,
          associatedWith: destination,
          allow401s: false,
          method: 'sequence',
          abortSignal,
        });

        await handleBatchResultWithSubRequests({ batchResult, subRequests, destination });
        return {
          wrappedEnvelope: encryptedAndWrapped.encryptedAndWrappedData,
          effectiveTimestamp: encryptedAndWrapped.networkTimestamp,
        };
      } catch (e) {
        if (e instanceof pRetry.AbortError && e.message === ERROR_421_HANDLED_RETRY_REQUEST) {
          // sendSingleMessage handles fetching a new snode itself once 421 was handled, but a pRetry.AbortError thrown
          // will stop the retry process. We need to catch this specific error and throw it again (as a normal error)
          // to let pRetry retry the request.
          throw new Error(e.message);
        }
        throw e;
      }
    },
    {
      retries: Math.max(attempts - 1, 0),
      factor: 1,
      minTimeout: retryMinTimeout || MessageSender.getMinRetryTimeout(),
      onFailedAttempt: e => {
        window?.log?.warn(
          `[sendSingleMessage] attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left... Error: ${e.message}`
        );
      },
    }
  );
}

async function getSignatureParamsFromNamespace(
  { namespace }: { namespace: SnodeNamespaces },
  destination: string
): Promise<SigResultSubAccount | SigResultAdmin | SnodeSignatureResult | object> {
  const store = 'store' as const;
  if (SnodeNamespace.isUserConfigNamespace(namespace)) {
    const ourPrivKey = (await UserUtils.getUserED25519KeyPairBytes())?.privKeyBytes;
    if (!ourPrivKey) {
      throw new Error(
        'getSignatureParamsFromNamespace UserUtils.getUserED25519KeyPairBytes is empty'
      );
    }
    return SnodeSignature.getSnodeSignatureParamsUs({
      method: store,
      namespace,
    });
  }

  if (
    SnodeNamespace.isGroupConfigNamespace(namespace) ||
    namespace === SnodeNamespaces.ClosedGroupMessages ||
    namespace === SnodeNamespaces.ClosedGroupRevokedRetrievableMessages
  ) {
    if (!PubKey.is03Pubkey(destination)) {
      throw new Error(
        'getSignatureParamsFromNamespace: group config namespace required a 03 pubkey'
      );
    }
    const found = UserGroupsWrapperActions.getCachedGroup(destination);
    if (!found) {
      throw new Error(
        `getSignatureParamsFromNamespace: group ${ed25519Str(destination)} not found in cache`
      );
    }
    return SnodeGroupSignature.getSnodeGroupSignature({
      method: store,
      namespace,
      group: found,
    });
  }
  // no signature required for this namespace/pubkey combo
  return {};
}

function logBuildSubRequests(subRequests: Array<BuiltSnodeSubRequests>) {
  if (!window.sessionFeatureFlags.debug.debugBuiltSnodeRequests) {
    return;
  }
  window.log.debug(
    `\n========================================\nsubRequests: [\n\t${subRequests
      .map(m => {
        return stringify(m);
      })
      .join(',\n\t')}]\n========================================`
  );
}

async function signSubRequests(
  params: Array<RawSnodeSubRequests>
): Promise<Array<BuiltSnodeSubRequests>> {
  const signedRequests: Array<BuiltSnodeSubRequests> = await Promise.all(
    params.map(p => {
      return p.build();
    })
  );

  logBuildSubRequests(signedRequests);

  return signedRequests;
}

type DeleteHashesRequestPerPubkey<T extends PubkeyType | GroupPubkeyType> = T extends PubkeyType
  ? DeleteHashesFromUserNodeSubRequest
  : DeleteHashesFromGroupNodeSubRequest;

/**
 * Make sure that all the sub requests have been given in their sendingOrder, or throw an error.
 */
function assertRequestsAreSorted({ subRequests }: { subRequests: Array<RawSnodeSubRequests> }) {
  const allSorted = subRequests.every((current, index) => {
    const currentOrder = current.requestOrder();
    const previousOrder =
      index > 0 ? subRequests[index - 1].requestOrder() : Number.MIN_SAFE_INTEGER;
    return currentOrder >= previousOrder;
  });
  if (!allSorted) {
    throw new Error(
      'assertRequestsAreSorted: Some sub requests are not correctly sorted by requestOrder().'
    );
  }
}

type SortedSubRequestsType<T extends PubkeyType | GroupPubkeyType> = Array<
  | StoreRequestPerPubkey<T>
  | DeleteHashesRequestPerPubkey<T>
  | DeleteAllFromGroupMsgNodeSubRequest
  | DeleteAllFromGroupNodeSubRequest
  | SubaccountRevokeSubRequest
  | SubaccountUnrevokeSubRequest
>;

async function sendMessagesDataToSnode<T extends PubkeyType | GroupPubkeyType>({
  associatedWith,
  sortedSubRequests,
  method,
  abortSignal,
  allow401s,
}: WithAllow401s & {
  sortedSubRequests: SortedSubRequestsType<T>;
  associatedWith: T;
  method: MethodBatchType;
  abortSignal: MergedAbortSignal | null;
}): Promise<NotEmptyArrayOfBatchResults> {
  if (!associatedWith) {
    throw new Error('sendMessagesDataToSnode first sub request pubkey needs to be set');
  }

  if (sortedSubRequests.some(m => m.destination !== associatedWith)) {
    throw new Error(
      'sendMessagesDataToSnode tried to send batch request containing sub request not for the right destination'
    );
  }

  // Note: we want to make sure the caller sorted those sub requests, as it might try to handle the batch result based on the index.
  // If we sorted the requests here, we'd need to make sure the caller knows that the results are not in order he sent them.
  assertRequestsAreSorted({ subRequests: sortedSubRequests });

  const targetNode = await SnodePool.getNodeFromSwarmOrThrow(associatedWith);

  try {
    const responses = await BatchRequests.doUnsignedSnodeBatchRequestNoRetries({
      unsignedSubRequests: sortedSubRequests,
      targetNode,
      timeoutMs: 6 * DURATION.SECONDS,
      associatedWith,
      allow401s,
      method,
      abortSignal,
    });

    if (!responses || !responses.length) {
      window?.log?.warn(
        `SessionSnodeAPI::doUnsignedSnodeBatchRequestNoRetries on ${targetNode.ip}:${targetNode.port} returned falsy value`,
        responses
      );
      throw new Error('doUnsignedSnodeBatchRequestNoRetries: Invalid result');
    }
    await handleBatchResultWithSubRequests({
      batchResult: responses,
      subRequests: sortedSubRequests,
      destination: associatedWith,
    });

    const firstResult = responses[0];

    if (firstResult.code !== 200) {
      window?.log?.warn(
        'first result status is not 200 for sendMessagesDataToSnode but: ',
        firstResult.code
      );
      if (!allow401s || firstResult.code !== 401) {
        throw new Error('sendMessagesDataToSnode: Invalid status code');
      }
    }

    GetNetworkTime.handleTimestampOffsetFromNetwork('store', firstResult.body.t);

    if (!isEmpty(responses)) {
      window?.log?.info(
        `sendMessagesDataToSnode - Successfully sent requests to ${ed25519Str(
          associatedWith
        )} via ${ed25519Str(targetNode.pubkey_ed25519)} (requests: ${sortedSubRequests.map(m => m.loggingId()).join(', ')})`
      );
    }

    return responses;
  } catch (e) {
    const snodeStr = targetNode ? `${ed25519Str(targetNode.pubkey_ed25519)}` : 'null';
    window?.log?.warn(
      `sendMessagesDataToSnode - "${e.code}:${e.message}" to ${associatedWith} via snode:${snodeStr}`
    );
    throw e;
  }
}

/**
 * Send an array of pre-encrypted data to the corresponding swarm.
 * Note: also handles the result of each sub requests with `handleBatchResultWithSubRequests`
 *
 * @param params the data to deposit
 * @param destination the pubkey we should deposit those message to
 * @returns the batch/sequence results if further processing is needed
 */
async function sendEncryptedDataToSnode<T extends GroupPubkeyType | PubkeyType>({
  destination,
  sortedSubRequests,
  method,
  abortSignal,
  allow401s,
}: WithAllow401s & {
  sortedSubRequests: SortedSubRequestsType<T>; // keeping those as an array because the order needs to be enforced for some (group keys for instance)
  destination: T;
  method: MethodBatchType;
  abortSignal: MergedAbortSignal | null;
}): Promise<NotEmptyArrayOfBatchResults | null> {
  try {
    const batchResults = await pRetry(
      async () => {
        return MessageSender.sendMessagesDataToSnode({
          sortedSubRequests,
          associatedWith: destination,
          method,
          abortSignal,
          allow401s,
        });
      },
      {
        retries: 2,
        factor: 1,
        minTimeout: MessageSender.getMinRetryTimeout(),
        maxTimeout: 1000,
      }
    );

    if (!batchResults || isEmpty(batchResults)) {
      throw new Error('result is empty for sendEncryptedDataToSnode');
    }

    return batchResults;
  } catch (e) {
    window.log.warn(`sendEncryptedDataToSnode failed with ${e.message}`);
    const sortedSubRequestsWithMsg = sortedSubRequests.filter(r =>
      isStoreUserInitiatedSubRequest(r)
    );
    for (let index = 0; index < sortedSubRequestsWithMsg.length; index++) {
      const request = sortedSubRequestsWithMsg[index];
      if (request.dbMessageIdentifier) {
        // eslint-disable-next-line no-await-in-loop
        await MessageSentHandler.handleSwarmMessageSentFailure(
          { device: destination, identifier: request.dbMessageIdentifier },
          e
        );
      }
    }

    return null;
  }
}

// ================ Open Group ================
/**
 * Send a message to an open group v2.
 * @param message The open group message.
 */
async function sendToOpenGroupV2(
  rawMessage: OpenGroupVisibleMessage,
  roomInfos: OpenGroupRequestCommonType,
  blinded: boolean,
  filesToLink: Array<number>
): Promise<OpenGroupMessageV2 | boolean> {
  // we agreed to pad messages for opengroup v2
  const paddedBody = addMessagePadding(rawMessage.plainTextBuffer());
  const v2Message = new OpenGroupMessageV2({
    sentTimestamp: NetworkTime.now(),
    base64EncodedData: fromUInt8ArrayToBase64(paddedBody),
    filesToLink,
  });

  const msg = await sendSogsMessageOnionV4(
    roomInfos.serverUrl,
    roomInfos.roomId,
    new AbortController().signal,
    v2Message,
    blinded
  );
  return msg;
}

/**
 * Send a message to an open group v2.
 * @param message The open group message.
 */
async function sendToOpenGroupV2BlindedRequest(
  encryptedContent: Uint8Array,
  roomInfos: OpenGroupRequestCommonType,
  recipientBlindedId: string
): Promise<{ serverId: number; serverTimestamp: number }> {
  const v2Message = new OpenGroupMessageV2({
    sentTimestamp: NetworkTime.now(),
    base64EncodedData: fromUInt8ArrayToBase64(encryptedContent),
  });

  // Warning: sendMessageOnionV4BlindedRequest throws
  const msg = await sendMessageOnionV4BlindedRequest(
    roomInfos.serverUrl,
    roomInfos.roomId,
    new AbortController().signal,
    v2Message,
    recipientBlindedId
  );
  return msg;
}

export const MessageSender = {
  sendToOpenGroupV2BlindedRequest,
  sendMessagesDataToSnode,
  sendEncryptedDataToSnode,
  getMinRetryTimeout,
  sendToOpenGroupV2,
  sendSingleMessage,
  isContentSyncMessage,
  getSignatureParamsFromNamespace,
  signSubRequests,
  messagesToRequests,
  destinationIsClosedGroup,
};

function destinationIsClosedGroup(destination: string) {
  return ConvoHub.use().get(destination)?.isClosedGroup();
}

/**
 * Note: this function does not handle the syncing logic of messages yet.
 * Use it to push message to group, to note to self, or with user messages which do not require a syncing logic
 */
async function handleBatchResultWithSubRequests({
  batchResult,
  destination,
  subRequests,
}: {
  batchResult: NotEmptyArrayOfBatchResults;
  subRequests: Array<RawSnodeSubRequests>;
  destination: string;
}) {
  if (!batchResult || !isArray(batchResult) || isEmpty(batchResult)) {
    window.log.error('handleBatchResultWithSubRequests: invalid batch result ');
    return;
  }

  const seenHashes: Array<SaveSeenMessageHash> = [];

  for (let index = 0; index < subRequests.length; index++) {
    const subRequest = subRequests[index];

    // there are some things we need to do when storing messages
    // for groups/legacy groups or user (but not for config messages)
    if (isStoreUserInitiatedSubRequest(subRequest)) {
      const storedAt = batchResult?.[index]?.body?.t;
      const storedHash = batchResult?.[index]?.body?.hash;
      const subRequestStatusCode = batchResult?.[index]?.code;
      // TODO: the expiration is due to be returned by the storage server on "store" soon, we will then be able to use it instead of doing the storedAt + ttl logic below
      // if we have a hash and a storedAt, mark it as seen so we don't reprocess it on the next retrieve
      if (
        subRequestStatusCode === 200 &&
        !isEmpty(storedHash) &&
        isString(storedHash) &&
        isNumber(storedAt)
      ) {
        seenHashes.push({
          expiresAt: NetworkTime.now() + TTL_DEFAULT.CONTENT_MESSAGE, // non config msg expire at CONTENT_MESSAGE at most
          hash: storedHash,
          conversationId: destination,
        });

        // We need to store the hash of our synced message for a 1o1. (as this is the one stored on our swarm)
        // For groups, we can just store that hash directly as the group's swarm is hosting all of the group messages
        if (subRequest.dbMessageIdentifier) {
          // eslint-disable-next-line no-await-in-loop
          await MessageSentHandler.handleSwarmMessageSentSuccess(
            {
              device: subRequest.destination,
              isDestinationClosedGroup: MessageSender.destinationIsClosedGroup(destination),
              identifier: subRequest.dbMessageIdentifier,
              plainTextBuffer:
                subRequest instanceof StoreUserMessageSubRequest
                  ? subRequest.plainTextBuffer
                  : null,
            },
            subRequest.createdAtNetworkTimestamp,
            storedHash
          );
        }
      }
    }
  }
  await Data.saveSeenMessageHashes(seenHashes);
}
