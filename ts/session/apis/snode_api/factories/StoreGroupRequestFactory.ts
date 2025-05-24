import { UserGroupsGet } from 'libsession_util_nodejs';
import { compact, flatten, isEmpty, uniqBy } from 'lodash';
import { SignalService } from '../../../../protobuf';
import { MetaGroupWrapperActions } from '../../../../webworker/workers/browser/libsession_worker_interface';
import { GroupUpdateInfoChangeMessage } from '../../../messages/outgoing/controlMessage/group_v2/to_group/GroupUpdateInfoChangeMessage';
import { GroupUpdateMemberChangeMessage } from '../../../messages/outgoing/controlMessage/group_v2/to_group/GroupUpdateMemberChangeMessage';
import { MessageWrapper } from '../../../sending/MessageWrapper';
import { ed25519Str } from '../../../utils/String';
import { PendingChangesForGroup } from '../../../utils/libsession/libsession_utils';
import {
  StoreGroupExtraData,
  StoreGroupInfoSubRequest,
  StoreGroupKeysSubRequest,
  StoreGroupMembersSubRequest,
  StoreGroupMessageSubRequest,
} from '../SnodeRequestTypes';
import { SnodeNamespaces } from '../namespaces';
import { GroupUpdateDeleteMemberContentMessage } from '../../../messages/outgoing/controlMessage/group_v2/to_group/GroupUpdateDeleteMemberContentMessage';
import { GroupUpdateMemberLeftNotificationMessage } from '../../../messages/outgoing/controlMessage/group_v2/to_group/GroupUpdateMemberLeftNotificationMessage';
import { TTL_DEFAULT } from '../../../constants';
import { NetworkTime } from '../../../../util/NetworkTime';

export type StoreMessageToSubRequestType =
  | GroupUpdateMemberChangeMessage
  | GroupUpdateInfoChangeMessage
  | GroupUpdateDeleteMemberContentMessage
  | GroupUpdateMemberLeftNotificationMessage;

async function makeGroupMessageSubRequest(
  updateMessages: Array<StoreMessageToSubRequestType | null>,
  group: Pick<UserGroupsGet, 'authData' | 'secretKey'>
) {
  const compactedMessages = compact(updateMessages);
  if (isEmpty(compactedMessages)) {
    return [];
  }
  const groupPk = compactedMessages[0].destination;
  const allForSameDestination = compactedMessages.every(m => m.destination === groupPk);
  if (!allForSameDestination) {
    throw new Error('makeGroupMessageSubRequest: not all messages are for the same destination');
  }

  const allTimestamps = uniqBy(compactedMessages, m => m.createAtNetworkTimestamp);
  if (allTimestamps.length !== compactedMessages.length) {
    throw new Error(
      'tried to send batch request with messages having the same timestamp, this is not supported on all platforms.'
    );
  }

  const messagesToEncrypt: Array<StoreGroupExtraData> = compactedMessages.map(updateMessage => {
    const wrapped = MessageWrapper.wrapContentIntoEnvelope(
      SignalService.Envelope.Type.CLOSED_GROUP_MESSAGE,
      undefined,
      updateMessage.createAtNetworkTimestamp, // message is signed with this timestamp
      updateMessage.plainTextBuffer()
    );

    return {
      namespace: SnodeNamespaces.ClosedGroupMessages,
      pubkey: updateMessage.destination,
      ttl: updateMessage.ttl(),
      networkTimestamp: updateMessage.createAtNetworkTimestamp,
      data: SignalService.Envelope.encode(wrapped).finish(),
      dbMessageIdentifier: updateMessage.identifier,
    };
  });

  const encryptedContent = messagesToEncrypt.length
    ? await MetaGroupWrapperActions.encryptMessages(
        groupPk,
        messagesToEncrypt.map(m => m.data)
      )
    : [];
  if (encryptedContent.length !== messagesToEncrypt.length) {
    throw new Error(
      'makeGroupMessageSubRequest: MetaGroupWrapperActions.encryptMessages did not return the right count of items'
    );
  }

  const updateMessagesEncrypted = messagesToEncrypt.map((requestDetails, index) => ({
    ...requestDetails,
    data: encryptedContent[index],
  }));

  const updateMessagesRequests = updateMessagesEncrypted.map(m => {
    return new StoreGroupMessageSubRequest({
      encryptedData: m.data,
      groupPk,
      ttlMs: m.ttl,
      dbMessageIdentifier: m.dbMessageIdentifier,
      ...group,
      createdAtNetworkTimestamp: m.networkTimestamp,
      getNow: NetworkTime.now,
    });
  });

  return updateMessagesRequests;
}

function makeStoreGroupKeysSubRequest({
  encryptedSupplementKeys,
  group,
}: {
  group: Pick<UserGroupsGet, 'secretKey' | 'pubkeyHex'>;
  encryptedSupplementKeys: Uint8Array | null;
}) {
  const groupPk = group.pubkeyHex;
  if (!encryptedSupplementKeys?.length) {
    return undefined;
  }

  // supplementalKeys are already encrypted, but we still need the secretKey to sign the request

  if (!group.secretKey || isEmpty(group.secretKey)) {
    window.log.debug(
      `makeStoreGroupKeysSubRequest: ${ed25519Str(groupPk)}: keysEncryptedmessage not empty but we do not have the secretKey`
    );

    throw new Error(
      'makeStoreGroupKeysSubRequest: keysEncryptedmessage not empty but we do not have the secretKey'
    );
  }
  return new StoreGroupKeysSubRequest({
    encryptedData: encryptedSupplementKeys,
    groupPk,
    secretKey: group.secretKey,
    ttlMs: TTL_DEFAULT.CONFIG_MESSAGE,
    getNow: NetworkTime.now,
  });
}

/**
 * Make the requests needed to store that group config details.
 * Note: the groupKeys request is always returned first, as it needs to be stored first on the swarm.
 * This is to avoid a race condition where some clients get a groupInfo encrypted with a new key, when the new groupKeys was not stored yet.
 */
function makeStoreGroupConfigSubRequest({
  group,
  pendingConfigData,
}: {
  group: Pick<UserGroupsGet, 'secretKey' | 'pubkeyHex'>;
  pendingConfigData: Array<PendingChangesForGroup>;
}) {
  if (!pendingConfigData.length) {
    return [];
  }
  const groupPk = group.pubkeyHex;

  if (!group.secretKey || isEmpty(group.secretKey)) {
    window.log.debug(
      `makeStoreGroupConfigSubRequest: ${ed25519Str(groupPk)}: pendingConfigMsgs not empty but we do not have the secretKey`
    );

    throw new Error(
      'makeStoreGroupConfigSubRequest: pendingConfigMsgs not empty but we do not have the secretKey'
    );
  }

  const groupInfoSubRequests = compact(
    flatten(
      pendingConfigData.map(m =>
        m.namespace === SnodeNamespaces.ClosedGroupInfo
          ? m.ciphertexts.map(
              ciphertext =>
                new StoreGroupInfoSubRequest({
                  encryptedData: ciphertext,
                  groupPk,
                  secretKey: group.secretKey,
                  ttlMs: TTL_DEFAULT.CONFIG_MESSAGE,
                  getNow: NetworkTime.now,
                })
            )
          : null
      )
    )
  );

  const groupMembersSubRequests = flatten(
    compact(
      pendingConfigData.map(m =>
        m.namespace === SnodeNamespaces.ClosedGroupMembers
          ? m.ciphertexts.map(
              ciphertext =>
                new StoreGroupMembersSubRequest({
                  encryptedData: ciphertext,
                  groupPk,
                  secretKey: group.secretKey,
                  ttlMs: TTL_DEFAULT.CONFIG_MESSAGE,
                  getNow: NetworkTime.now,
                })
            )
          : null
      )
    )
  );

  const groupKeysSubRequests = flatten(
    compact(
      pendingConfigData.map(m =>
        m.namespace === SnodeNamespaces.ClosedGroupKeys
          ? m.ciphertexts.map(
              ciphertext =>
                new StoreGroupKeysSubRequest({
                  encryptedData: ciphertext,
                  groupPk,
                  secretKey: group.secretKey,
                  ttlMs: TTL_DEFAULT.CONFIG_MESSAGE,
                  getNow: NetworkTime.now,
                })
            )
          : null
      )
    )
  );

  // we want to store first the keys (as the info and members might already be encrypted with them)
  return [...groupKeysSubRequests, ...groupInfoSubRequests, ...groupMembersSubRequests];
}

export const StoreGroupRequestFactory = {
  makeGroupMessageSubRequest,
  makeStoreGroupConfigSubRequest,
  makeStoreGroupKeysSubRequest,
};
