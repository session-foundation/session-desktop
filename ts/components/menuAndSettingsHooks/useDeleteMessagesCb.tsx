import type { PubkeyType, GroupPubkeyType } from 'libsession_util_nodejs';
import { compact, isArray } from 'lodash';
import { useDispatch } from 'react-redux';
import { updateConfirmModal } from '../../state/ducks/modalDialog';
import {
  useIsLegacyGroup,
  useIsMe,
  useIsPublic,
  useWeAreAdmin,
} from '../../hooks/useParamSelector';
import { SessionButtonColor } from '../basic/SessionButton';
import { closeRightPanel, resetSelectedMessageIds } from '../../state/ducks/conversations';
import { tr, type TrArgs } from '../../localization/localeTools';
import { useWeAreCommunityAdminOrModerator } from '../../state/selectors/conversations';
import type { ConversationModel } from '../../models/conversation';
import type { MessageModel } from '../../models/message';
import { PubKey } from '../../session/types';
import { ToastUtils } from '../../session/utils';
import { UserGroupsWrapperActions } from '../../webworker/workers/browser/libsession_worker_interface';
import { Data } from '../../data/data';
import { MessageQueue } from '../../session/sending';

import { deleteSogsMessageByServerIds } from '../../session/apis/open_group_api/sogsv3/sogsV3DeleteMessages';
import { SnodeNamespaces } from '../../session/apis/snode_api/namespaces';
import { getSodiumRenderer } from '../../session/crypto';
import { GroupUpdateDeleteMemberContentMessage } from '../../session/messages/outgoing/controlMessage/group_v2/to_group/GroupUpdateDeleteMemberContentMessage';
import { UnsendMessage } from '../../session/messages/outgoing/controlMessage/UnsendMessage';
import { NetworkTime } from '../../util/NetworkTime';
import { deleteOrMarkAsDeletedMessages } from '../../interactions/conversations/deleteOrMarkAsDeletedMessages';
import { sectionActions } from '../../state/ducks/section';
import { ConvoHub } from '../../session/conversations';
import { uuidV4 } from '../../util/uuid';
import { isUsAnySogsFromCache } from '../../session/apis/open_group_api/sogsv3/knownBlindedkeys';
import type { RadioOptions } from '../dialog/SessionConfirm';
import { deleteMessagesFromSwarmOnly } from '../../interactions/conversations/deleteMessagesFromSwarmOnly';

const deleteMessageDeviceOnly = 'deleteMessageDeviceOnly';
const deleteMessageAllMyDevices = 'deleteMessageDevicesAll';
const deleteMessageEveryone = 'deleteMessageEveryone';

type MessageDeletionType =
  | typeof deleteMessageDeviceOnly
  | typeof deleteMessageAllMyDevices
  | typeof deleteMessageEveryone;

/**
 * Offer to delete for everyone or not, based on what is currently selected
 * and our role in the corresponding conversation.
 */
export function useDeleteMessagesCb(conversationId: string | undefined) {
  const dispatch = useDispatch();

  const isNts = useIsMe(conversationId);
  const isPublic = useIsPublic(conversationId);
  const weAreAdminOrModCommunity = useWeAreCommunityAdminOrModerator(conversationId);
  const weAreAdminGroup = useWeAreAdmin(conversationId);
  const isLegacyGroup = useIsLegacyGroup(conversationId);

  const closeDialog = () => dispatch(updateConfirmModal(null));

  if (!conversationId) {
    return null;
  }

  return async (messageIds: string | Array<string> | undefined) => {
    const count = isArray(messageIds) ? messageIds.length : messageIds ? 1 : 0;
    const convo = ConvoHub.use().get(conversationId);
    if (!convo || !messageIds || (!isArray(messageIds) && !messageIds.length)) {
      return;
    }
    const messageIdsArr = isArray(messageIds) ? messageIds : [messageIds];

    // legacy groups are read only, we can only delete locally.
    const canDeleteAllForEveryoneAsAdmin =
      !isLegacyGroup && ((isPublic && weAreAdminOrModCommunity) || (!isPublic && weAreAdminGroup));

    const msgModels = await Data.getMessagesById(messageIdsArr);
    const senders = compact(msgModels.map(m => m.getSource()));

    const anyAreMarkAsDeleted = msgModels.some(m => m.isMarkedAsDeleted());
    const anyAreControlMessages = msgModels.some(m => m.isControlMessage());

    // We can technically never delete for everyone if one of the message is
    // - a control message
    // - a message marked as deleted
    // - a message that is sending or failed to be sent (as we need a hash to delete globally)
    // In this case, the only option is to delete locally.
    // BUT, because we love inconsistencies we still allow to delete globally a sending or failed to be sent message.
    // This does nothing on the backend, but makes a nice UX, apparently.
    const sharedCannotDeleteForEveryone = anyAreControlMessages || anyAreMarkAsDeleted;

    const canDeleteAllForEveryoneAsMe = senders.every(isUsAnySogsFromCache);
    const canDeleteAllForEveryone =
      (canDeleteAllForEveryoneAsMe || canDeleteAllForEveryoneAsAdmin) &&
      !sharedCannotDeleteForEveryone;

    const canDeleteFromAllDevices = isNts && !sharedCannotDeleteForEveryone;

    // Note: the isMe case has no radio buttons, so we just show the description below
    const i18nMessage: TrArgs | undefined = isNts
      ? { token: 'deleteMessageConfirm', count }
      : undefined;

    const warningMessage: TrArgs | undefined =
      isNts && !canDeleteFromAllDevices
        ? { token: 'deleteMessageNoteToSelfWarning', count }
        : !isNts && !canDeleteAllForEveryone
          ? {
              token: 'deleteMessageWarning',
              count,
            }
          : undefined;

    const radioOptions: RadioOptions | undefined = {
      items: [
        {
          label: tr(deleteMessageDeviceOnly),
          value: deleteMessageDeviceOnly,
          inputDataTestId: `input-${deleteMessageDeviceOnly}` as const,
          labelDataTestId: `label-${deleteMessageDeviceOnly}` as const,
          disabled: false, // we can always delete messages locally
        },
        isNts
          ? {
              label: tr(deleteMessageAllMyDevices),
              value: deleteMessageAllMyDevices,
              inputDataTestId: `input-${deleteMessageAllMyDevices}` as const,
              labelDataTestId: `label-${deleteMessageAllMyDevices}` as const,
              disabled: !canDeleteFromAllDevices,
            }
          : {
              label: tr(deleteMessageEveryone),
              value: deleteMessageEveryone,
              inputDataTestId: `input-${deleteMessageEveryone}` as const,
              labelDataTestId: `label-${deleteMessageEveryone}` as const,
              disabled: !canDeleteAllForEveryone,
            },
      ],
      defaultSelectedValue: !isNts && canDeleteAllForEveryone ? deleteMessageEveryone : undefined,
    };

    dispatch(
      updateConfirmModal({
        title: { token: 'deleteMessage', count },
        radioOptions,
        i18nMessage,

        okText: { token: 'delete' },
        warningMessage,

        okTheme: SessionButtonColor.Danger,
        onClickOk: async args => {
          if (
            args !== deleteMessageEveryone &&
            args !== deleteMessageAllMyDevices &&
            args !== deleteMessageDeviceOnly
          ) {
            throw new Error('doDeleteSelectedMessages: invalid args onClickOk');
          }

          const noErrors = await doDeleteSelectedMessages({
            selectedMessages: msgModels,
            conversation: convo,
            deletionType: args,
          });
          if (noErrors) {
            dispatch(updateConfirmModal(null));
            dispatch(closeRightPanel());
            dispatch(sectionActions.resetRightOverlayMode());
          }
        },
        onClickClose: closeDialog,
      })
    );
  };
}

/**
 * Delete the messages from the conversation.
 * Also deletes messages from the swarm/sogs if needed, sends unsend requests for syncing etc...
 *
 * Note: this function does not check if the user is allowed to delete the messages.
 * The call will just fail if the user is not allowed to delete the messages.
 * So make sure to check the user permissions before calling this function and to display only valid actions for the user's permissions.
 *
 * Returns true if the modal should be closed (i.e. messages were deleted as expected)
 */
async function doDeleteSelectedMessages({
  conversation,
  selectedMessages,
  deletionType,
}: {
  conversation: ConversationModel;
  selectedMessages: Array<MessageModel>;
  deletionType: MessageDeletionType;
}) {
  if (selectedMessages.length === 0) {
    window.log.info('doDeleteSelectedMessages: no messages selected');
    return true;
  }

  // legacy groups are read only
  if (conversation.isClosedGroup() && PubKey.is05Pubkey(conversation.id)) {
    window.log.info(
      'doDeleteSelectedMessages: legacy groups are read only. Only removing those messages locally'
    );
    await deleteOrMarkAsDeletedMessages({
      conversation,
      messages: selectedMessages,
      deletionType: 'complete',
      actionContextIsUI: true,
    });
    return true;
  }

  if (deletionType === deleteMessageDeviceOnly) {
    // Delete on device only is an easy case.
    // `deleteOrMarkAsDeletedMessages` will forcefully remove
    // - control messages or
    // - already marked as deleted messages
    await deleteOrMarkAsDeletedMessages({
      conversation,
      messages: selectedMessages,
      deletionType: 'markDeletedThisDevice',
      actionContextIsUI: true,
    });
    // this can never fail
    ToastUtils.pushDeleted(selectedMessages.length);
    window.inboxStore?.dispatch(resetSelectedMessageIds());

    return true;
  }

  if (deletionType === deleteMessageAllMyDevices) {
    if (!conversation.isMe()) {
      throw new Error(
        ' doDeleteSelectedMessages: invalid deletionType: "deleteMessageAllMyDevices" for a different conversation than ours'
      );
    }
    // Delete those messages locally, from our swarm and from our other devices, but not for anyone else in the conversation
    const deletedFromOurSwarm = await unsendMessageJustForThisUserAllDevices(
      conversation,
      selectedMessages
    );
    return deletedFromOurSwarm;
  }

  // device only was handled above, so this isOpenGroupV2 can only mean delete for everyone in a community
  if (conversation.isOpenGroupV2()) {
    // this shows a toast on success or failure
    const deletedFromSogs = await doDeleteSelectedMessagesInSOGS(selectedMessages, conversation);
    return deletedFromSogs;
  }

  // sanity check that this is the last available option
  if (deletionType !== deleteMessageEveryone) {
    throw new Error(`doDeleteSelectedMessages: invalid deletionType: "${deletionType}"`);
  }

  if (conversation.isPrivate()) {
    if (conversation.isMe()) {
      throw new Error(
        'the NTS case should have been deleteMessageDeviceOnly or deleteMessageAllMyDevices'
      );
    }
    // Note: we cannot delete for everyone a message in a non 05-private chat
    if (!PubKey.is05Pubkey(conversation.id)) {
      throw new Error('unsendMessagesForEveryone1o1 requires a 05 key');
    }

    // build the unsendMsgObjects before we delete the hash from those messages
    const unsendMsgObjects = getUnsendMessagesObjects1o1(conversation, selectedMessages);

    // Note: not calling deleteMessagesFromSwarmAndMarkAsDeletedLocally here as
    // we've got some custom logic going on
    const deletedFromSwarm = await deleteMessagesFromSwarmOnly(conversation, selectedMessages);
    if (!deletedFromSwarm) {
      window.log.warn(
        'unsendMessagesForEveryone1o1: failed to delete from swarm. Not sending unsend requests'
      );
      ToastUtils.pushFailedToDelete(selectedMessages.length);
      return false;
    }
    await deleteOrMarkAsDeletedMessages({
      conversation,
      messages: selectedMessages,
      deletionType: 'markDeletedGlobally',
      actionContextIsUI: true,
    });

    await unsendMessagesForEveryone1o1(conversation, unsendMsgObjects);

    ToastUtils.pushDeleted(selectedMessages.length);
    window.inboxStore?.dispatch(resetSelectedMessageIds());

    return true;
  }

  if (!conversation.isClosedGroupV2() || !PubKey.is03Pubkey(conversation.id)) {
    // considering the above, the only valid case here is 03 groupv2
    throw new Error('doDeleteSelectedMessages: invalid conversation type');
  }

  const weAreAdmin = await hasGroupAdminKey(conversation.id);
  // 03 groups: mark as deleted
  if (weAreAdmin) {
    // when we are an admin, we first delete the messages from the swarm
    // Note: not calling deleteMessagesFromSwarmAndMarkAsDeletedLocally here as
    // we've got some custom logic going on
    const deletedFromGroupSwarm = await deleteMessagesFromSwarmOnly(conversation, selectedMessages);
    if (!deletedFromGroupSwarm) {
      window.log.warn(
        'unsendMessagesForEveryone1o1: failed to delete from group swarm. Not sending unsend requests'
      );
      ToastUtils.pushFailedToDelete(selectedMessages.length);

      return false;
    }

    if (!deletedFromGroupSwarm) {
      window.log.warn(
        'unsendMessagesForEveryoneGroupV2: failed to delete messages on group swarm:'
      );
      return false;
    }
  }

  // Here, either we've removed those messages from the swarm as an admin,
  // or we want to request the admin to delete them for us.
  // Those messages have to be ours in this case.

  const groupV2UnsendSent = await unsendMessagesForEveryoneGroupV2({
    groupPk: conversation.id,
    msgsToDelete: selectedMessages,
    allMessagesFrom: [], // currently we cannot remove all the messages from a specific pubkey but we do already handle them on the receiving side
  });

  if (!groupV2UnsendSent) {
    window.log.warn(
      'unsendMessagesForEveryoneGroupV2: failed to send our groupv2 unsend for everyone'
    );
    ToastUtils.pushFailedToDelete(selectedMessages.length);
    return false;
  }
  await deleteOrMarkAsDeletedMessages({
    conversation,
    messages: selectedMessages,
    deletionType: 'markDeletedGlobally',
    actionContextIsUI: true,
  });
  window.inboxStore?.dispatch(resetSelectedMessageIds());
  ToastUtils.pushDeleted(selectedMessages.length);

  return true;
}

/**
 * Delete those message hashes from our swarm.
 * On success, send an UnsendMessage synced message so our devices removes those already fetched messages.
 * Then, deletes completely the messages locally.
 *
 * Shows a toast on error/success and reset the selection
 */
async function unsendMessageJustForThisUserAllDevices(
  conversation: ConversationModel,
  msgsToDelete: Array<MessageModel>
) {
  // we can only delete the messages on the swarm when they've been sent
  const msgsToDeleteFromSwarm = msgsToDelete.filter(m => m.getMessageHash());
  window?.log?.info('Deleting messages just for this user');

  // get the unsendMsgObjects before we delete the hash from those messages
  const unsendMsgObjects = getUnsendMessagesObjects1o1(conversation, msgsToDeleteFromSwarm);

  // Note: not calling deleteMessagesFromSwarmAndCompletelyLocally here as
  // we've got some custom logic going on
  const deletedFromSwarm = await deleteMessagesFromSwarmOnly(conversation, msgsToDelete);

  // we want to locally only when we've manage to delete them from the swarm first
  if (!deletedFromSwarm) {
    window.log.warn(
      'unsendMessageJustForThisUserAllDevices: failed to delete from swarm. Not sending unsend requests'
    );
    ToastUtils.pushFailedToDelete(msgsToDelete.length);
    return false;
  }
  await deleteOrMarkAsDeletedMessages({
    conversation,
    messages: msgsToDelete,
    deletionType: 'complete',
    actionContextIsUI: true,
  });

  // deleting from the swarm worked, sending to our other devices all the messages separately for now
  await Promise.all(
    unsendMsgObjects.map(unsendObject =>
      MessageQueue.use()
        .sendSyncMessage({ namespace: SnodeNamespaces.Default, message: unsendObject })
        .catch(window?.log?.error)
    )
  );
  // Update view and trigger update
  window.inboxStore?.dispatch(resetSelectedMessageIds());
  ToastUtils.pushDeleted(unsendMsgObjects.length);
  return true;
}

/**
 * Attempt to delete the messages from the SOGS.
 * Note: this function does not check if the user is allowed to delete the messages.
 * The call will just fail if the user is not allowed to delete the messages.
 * So make sure to check the user permissions before calling this function and to display only valid actions for the user's permissions.
 *
 * Returns true if those messages could be removed from the SOGS and were removed locally.
 */
async function doDeleteSelectedMessagesInSOGS(
  selectedMessages: Array<MessageModel>,
  conversation: ConversationModel
) {
  const toDeleteLocallyIds = await deleteOpenGroupMessages(selectedMessages, conversation);
  if (toDeleteLocallyIds.length === 0) {
    // Failed to delete those messages from the sogs.
    ToastUtils.pushGenericError();
    return false;
  }

  await deleteOrMarkAsDeletedMessages({
    conversation,
    messages: selectedMessages,
    deletionType: 'complete',
    actionContextIsUI: true,
  });

  // successful deletion
  ToastUtils.pushDeleted(toDeleteLocallyIds.length);
  window.inboxStore?.dispatch(resetSelectedMessageIds());
  return true;
}

/**
 *
 * @param messages the list of MessageModel to delete
 * @param convo the conversation to delete from (only v2 opengroups are supported)
 */
async function deleteOpenGroupMessages(
  messages: Array<MessageModel>,
  convo: ConversationModel
): Promise<Array<string>> {
  if (!convo.isOpenGroupV2()) {
    throw new Error('cannot delete public message on a non public groups');
  }

  const roomInfos = convo.toOpenGroupV2();
  // on v2 servers we can only remove a single message per request..
  // so logic here is to delete each messages and get which one where not removed
  const validServerIdsToRemove = compact(
    messages.map(msg => {
      return msg.get('serverId');
    })
  );

  const validMessageModelsToRemove = compact(
    messages.map(msg => {
      const serverId = msg.get('serverId');
      if (serverId) {
        return msg;
      }
      return undefined;
    })
  );

  let allMessagesAreDeleted: boolean = false;
  if (validServerIdsToRemove.length) {
    allMessagesAreDeleted = await deleteSogsMessageByServerIds(validServerIdsToRemove, roomInfos);
  }
  // remove only the messages we managed to remove on the server
  if (allMessagesAreDeleted) {
    window?.log?.info('Removed all those serverIds messages successfully');
    return validMessageModelsToRemove.map(m => m.id);
  }
  window?.log?.info(
    'failed to remove all those serverIds message. not removing them locally neither'
  );
  return [];
}

async function unsendMessagesForEveryone1o1(
  conversation: ConversationModel,
  unsendMsgObjects: Array<UnsendMessage>
) {
  if (!conversation.isPrivate()) {
    throw new Error('unsendMessagesForEveryone1o1 only works with private conversations');
  }
  if (unsendMsgObjects.length === 0) {
    return;
  }

  // sending to recipient all the messages separately for now
  await Promise.all(
    unsendMsgObjects.map(unsendObject =>
      MessageQueue.use()
        .sendToPubKey(new PubKey(conversation.id), unsendObject, SnodeNamespaces.Default)
        .catch(window?.log?.error)
    )
  );
  await Promise.all(
    unsendMsgObjects.map(unsendObject =>
      MessageQueue.use()
        .sendSyncMessage({ namespace: SnodeNamespaces.Default, message: unsendObject })
        .catch(window?.log?.error)
    )
  );
}

async function hasGroupAdminKey(groupPk: GroupPubkeyType) {
  const group = await UserGroupsWrapperActions.getGroup(groupPk);
  return !!group?.secretKey?.length;
}

async function unsendMessagesForEveryoneGroupV2({
  allMessagesFrom,
  groupPk,
  msgsToDelete,
}: {
  groupPk: GroupPubkeyType;
  msgsToDelete: Array<MessageModel>;
  allMessagesFrom: Array<PubkeyType>;
}) {
  const messageHashesToUnsend = compact(msgsToDelete.map(m => m.getMessageHash()));
  const group = await UserGroupsWrapperActions.getGroup(groupPk);

  if (!messageHashesToUnsend.length && !allMessagesFrom.length) {
    window.log.info('unsendMessagesForEveryoneGroupV2: no hashes nor author to remove');
    return true;
  }

  const storedAt = await MessageQueue.use().sendToGroupV2NonDurably({
    message: new GroupUpdateDeleteMemberContentMessage({
      createAtNetworkTimestamp: NetworkTime.now(),
      expirationType: 'unknown', // GroupUpdateDeleteMemberContentMessage is not displayed so not expiring.
      expireTimer: 0,
      groupPk,
      memberSessionIds: allMessagesFrom,
      messageHashes: messageHashesToUnsend,
      sodium: await getSodiumRenderer(),
      secretKey: group?.secretKey || undefined,
      dbMessageIdentifier: uuidV4(),
    }),
  });
  return !!storedAt;
}

function getUnsendMessagesObjects1o1(
  conversation: ConversationModel,
  messages: Array<MessageModel>
) {
  if (!conversation.isPrivate()) {
    throw new Error(
      'getUnsendMessagesObjects1o1: cannot send messages to a non-private conversation'
    );
  }
  return compact(
    messages.map((message, index) => {
      const author = message.get('source');

      // call getPropsForMessage here so we get the received_at or sent_at timestamp in timestamp
      const referencedMessageTimestamp = message.getPropsForMessage().timestamp;
      if (!referencedMessageTimestamp) {
        window?.log?.error('cannot find timestamp - aborting unsend request');
        return undefined;
      }

      return new UnsendMessage({
        // this isn't pretty, but we need a unique timestamp for Android to not drop the message as a duplicate
        createAtNetworkTimestamp: NetworkTime.now() + index,
        referencedMessageTimestamp,
        author,
        dbMessageIdentifier: uuidV4(),
      });
    })
  );
}
