import type { PubkeyType, GroupPubkeyType } from 'libsession_util_nodejs';
import { compact, isArray } from 'lodash';
import { useDispatch } from 'react-redux';
import { updateConfirmModal } from '../../state/ducks/modalDialog';
import { useIsMe, useIsPublic, useWeAreAdmin } from '../../hooks/useParamSelector';
import type { LocalizerProps } from '../basic/Localizer';
import { SessionButtonColor } from '../basic/SessionButton';
import { closeRightPanel, resetSelectedMessageIds } from '../../state/ducks/conversations';
import { tr } from '../../localization/localeTools';
import { useWeAreCommunityAdminOrModerator } from '../../state/selectors/conversations';
import type { ConversationModel } from '../../models/conversation';
import type { MessageModel } from '../../models/message';
import { PubKey } from '../../session/types';
import { ToastUtils, UserUtils } from '../../session/utils';
import { UserGroupsWrapperActions } from '../../webworker/workers/browser/libsession_worker_interface';
import { Data } from '../../data/data';
import { MessageQueue } from '../../session/sending';
import {
  deleteMessagesFromSwarmAndCompletelyLocally,
  deleteMessagesFromSwarmAndMarkAsDeletedLocally,
} from '../../interactions/conversations/unsendingInteractions';
import { deleteSogsMessageByServerIds } from '../../session/apis/open_group_api/sogsv3/sogsV3DeleteMessages';
import { SnodeNamespaces } from '../../session/apis/snode_api/namespaces';
import type { SessionRadioItems } from '../basic/SessionRadioGroup';
import { getSodiumRenderer } from '../../session/crypto';
import { GroupUpdateDeleteMemberContentMessage } from '../../session/messages/outgoing/controlMessage/group_v2/to_group/GroupUpdateDeleteMemberContentMessage';
import { UnsendMessage } from '../../session/messages/outgoing/controlMessage/UnsendMessage';
import { NetworkTime } from '../../util/NetworkTime';
import { deleteMessagesLocallyOnly } from '../../interactions/conversations/deleteMessagesLocallyOnly';
import { sectionActions } from '../../state/ducks/section';
import { ConvoHub } from '../../session/conversations';
import { useNetworkStakedTokens } from '../../state/selectors/networkData';

const deleteMessageDeviceOnly = 'deleteMessageDeviceOnly';
const deleteMessageDevicesAll = 'deleteMessageDevicesAll';
const deleteMessageEveryone = 'deleteMessageEveryone';

type MessageDeletionType =
  | typeof deleteMessageDeviceOnly
  | typeof deleteMessageDevicesAll
  | typeof deleteMessageEveryone;

/**
 * Offer to delete for everyone or not, based on what is currently selected and our role in the corresponding conversation.
 *
 */
export function useDeleteMessagesCb(conversationId: string | undefined) {
  const dispatch = useDispatch();

  const isMe = useIsMe(conversationId);
  const isPublic = useIsPublic(conversationId);
  const weAreAdminOrModCommunity = useWeAreCommunityAdminOrModerator(conversationId);
  const weAreAdminGroup = useWeAreAdmin(conversationId);

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

    const canDeleteAllForEveryoneAsAdmin =
      (isPublic && weAreAdminOrModCommunity) || (!isPublic && weAreAdminGroup);

    const msgModels = await Data.getMessagesById(messageIdsArr);
    const senders = compact(msgModels.map(m => m.getSource()));
    const us = UserUtils.getOurPubKeyStrFromCache();

    const anyAreMarkAsDeleted = msgModels.some(m => m.get('isDeleted'));
    const anyAreControlMessages = msgModels.some(m => m.isControlMessage());

    const canDeleteAllForEveryoneAsMe = senders.every(s => s === us);
    const canDeleteAllForEveryone =
      (canDeleteAllForEveryoneAsMe || canDeleteAllForEveryoneAsAdmin) &&
      !anyAreControlMessages &&
      !anyAreMarkAsDeleted;

    // Note: the isMe case has no radio buttons, so we just show the description below
    const i18nMessage: LocalizerProps | undefined = isMe
      ? { token: 'deleteMessageDescriptionDevice', args: { count } }
      : undefined;

    const canDeleteFromAllDevices = isMe && !anyAreControlMessages && !anyAreMarkAsDeleted;

    const radioOptions: SessionRadioItems | undefined = [
      {
        label: tr(deleteMessageDeviceOnly),
        value: deleteMessageDeviceOnly,
        inputDataTestId: `input-${deleteMessageDeviceOnly}` as const,
        labelDataTestId: `label-${deleteMessageDeviceOnly}` as const,
        disabled: false, // we can always delete message locally
      },
      isMe
        ? {
            label: tr(deleteMessageDevicesAll),
            value: deleteMessageDevicesAll,
            inputDataTestId: `input-${deleteMessageDevicesAll}` as const,
            labelDataTestId: `label-${deleteMessageDevicesAll}` as const,
            disabled: !canDeleteFromAllDevices,
          }
        : {
            label: tr(deleteMessageEveryone),
            value: deleteMessageEveryone,
            inputDataTestId: `input-${deleteMessageEveryone}` as const,
            labelDataTestId: `label-${deleteMessageEveryone}` as const,
            disabled: !canDeleteAllForEveryone,
          },
    ];

    dispatch(
      updateConfirmModal({
        title: tr('deleteMessage', { count }),
        radioOptions,
        i18nMessage,
        okText: tr('delete'),

        okTheme: SessionButtonColor.Danger,
        onClickOk: async args => {
          if (
            args !== deleteMessageEveryone &&
            args !== deleteMessageDevicesAll &&
            args !== deleteMessageDeviceOnly
          ) {
            throw new Error('doDeleteSelectedMessages: invalid args onClickOk');
          }

          await doDeleteSelectedMessages({
            selectedMessages: msgModels,
            conversation: convo,
            deletionType: args,
          });
          dispatch(updateConfirmModal(null));
          dispatch(closeRightPanel());
          dispatch(sectionActions.resetRightOverlayMode());
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
 * The call will just fail if the user is not allowed to delete the messages, silently.
 * So make sure to check the user permissions before calling this function and to display only valid actions for the user's permissions.
 *
 */
const doDeleteSelectedMessages = async ({
  conversation,
  selectedMessages,
  deletionType,
}: {
  selectedMessages: Array<MessageModel>;
  conversation: ConversationModel;
  deletionType: MessageDeletionType;
}) => {
  // legacy groups are read only
  if (conversation.isClosedGroup() && PubKey.is05Pubkey(conversation.id)) {
    window.log.info('doDeleteSelectedMessages: legacy groups are deprecated');
    return;
  }

  if (deletionType === deleteMessageDeviceOnly) {
    // Mark those messages as deleted only locally
    await deleteMessagesLocallyOnly({
      conversation,
      messages: selectedMessages,
      deletionType: 'markDeleted',
    });
    ToastUtils.pushDeleted(selectedMessages.length);

    return;
  }

  // device only was handled above, so this isPublic can only mean delete for everyone in a community
  if (conversation.isPublic()) {
    await doDeleteSelectedMessagesInSOGS(selectedMessages, conversation);
    return;
  }

  if (deletionType === deleteMessageDevicesAll) {
    // Delete those messages locally, from our swarm and from our other devices, but not for anyone else in the conversation
    await unsendMessageJustForThisUserAllDevices(conversation, selectedMessages);
    return;
  }

  note: this is all done but untested
  //  Note: a groupv2 member can delete messages for everyone if they are the admin, or if that message is theirs.

  if (deletionType !== deleteMessageEveryone) {
    throw new Error('doDeleteSelectedMessages: invalid deletionType');
  }

  if (conversation.isPrivate()) {
    // Note: we cannot delete for everyone a message in non 05-private chat
    if (!PubKey.is05Pubkey(conversation.id)) {
      throw new Error('unsendMessagesForEveryone1o1AndLegacy requires a 05 key');
    }
    // private chats: we want to delete those messages completely (not just marked as deleted)
    await unsendMessagesForEveryone1o1(conversation, conversation.id, selectedMessages);
    await deleteMessagesFromSwarmAndCompletelyLocally(conversation, selectedMessages);
    ToastUtils.pushDeleted(selectedMessages.length);
    window.inboxStore?.dispatch(resetSelectedMessageIds());

    return;
  }

  if (!conversation.isClosedGroupV2() || !PubKey.is03Pubkey(conversation.id)) {
    // considering the above, the only valid case here is 03 groupv2
    throw new Error('doDeleteSelectedMessages: invalid conversation type');
  }

  await unsendMessagesForEveryoneGroupV2({
    groupPk: conversation.id,
    msgsToDelete: selectedMessages,
    allMessagesFrom: [], // currently we cannot remove all the messages from a specific pubkey but we do already handle them on the receiving side
  });

  // 03 groups: mark as deleted
  await deleteMessagesFromSwarmAndMarkAsDeletedLocally(conversation, selectedMessages);

  window.inboxStore?.dispatch(resetSelectedMessageIds());
  ToastUtils.pushDeleted(selectedMessages.length);
};

/**
 * Send an UnsendMessage synced message so our devices removes those messages locally,
 * and send an unsend request on our swarm so this message is effectively removed from it.
 * Then, deletes completely the messages locally.
 *
 * Show a toast on error/success and reset the selection
 */
async function unsendMessageJustForThisUserAllDevices(
  conversation: ConversationModel,
  msgsToDelete: Array<MessageModel>
) {
  window?.log?.warn('Deleting messages just for this user');

  const unsendMsgObjects = getUnsendMessagesObjects1o1OrLegacyGroups(msgsToDelete);

  // sending to our other devices all the messages separately for now
  await Promise.all(
    unsendMsgObjects.map(unsendObject =>
      MessageQueue.use()
        .sendSyncMessage({ namespace: SnodeNamespaces.Default, message: unsendObject })
        .catch(window?.log?.error)
    )
  );
  await deleteMessagesFromSwarmAndCompletelyLocally(conversation, msgsToDelete);

  // Update view and trigger update
  window.inboxStore?.dispatch(resetSelectedMessageIds());
  ToastUtils.pushDeleted(unsendMsgObjects.length);
}

/**
 * Attempt to delete the messages from the SOGS.
 * Note: this function does not check if the user is allowed to delete the messages.
 * The call will just fail if the user is not allowed to delete the messages, silently, so make
 * sure to check the user permissions before calling this function and to display only valid actions for the user's permissions.
 */
async function doDeleteSelectedMessagesInSOGS(
  selectedMessages: Array<MessageModel>,
  conversation: ConversationModel
) {
  const toDeleteLocallyIds = await deleteOpenGroupMessages(selectedMessages, conversation);
  if (toDeleteLocallyIds.length === 0) {
    // Failed to delete those messages from the sogs.
    ToastUtils.pushToastError('errorGeneric', tr('errorGeneric'));
    return;
  }

  await deleteMessagesLocallyOnly({
    conversation,
    messages: selectedMessages,
    deletionType: 'complete',
  });

  // successful deletion
  ToastUtils.pushDeleted(toDeleteLocallyIds.length);
  window.inboxStore?.dispatch(resetSelectedMessageIds());
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
  if (!convo.isPublic()) {
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
  destination: PubkeyType,
  msgsToDelete: Array<MessageModel>
) {
  const unsendMsgObjects = getUnsendMessagesObjects1o1OrLegacyGroups(msgsToDelete);

  if (!conversation.isPrivate()) {
    throw new Error('unsendMessagesForEveryone1o1 only works with private conversations');
  }

  // sending to recipient all the messages separately for now
  await Promise.all(
    unsendMsgObjects.map(unsendObject =>
      MessageQueue.use()
        .sendToPubKey(new PubKey(destination), unsendObject, SnodeNamespaces.Default)
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
    return;
  }

  await MessageQueue.use().sendToGroupV2NonDurably({
    message: new GroupUpdateDeleteMemberContentMessage({
      createAtNetworkTimestamp: NetworkTime.now(),
      expirationType: 'unknown', // GroupUpdateDeleteMemberContentMessage is not displayed so not expiring.
      expireTimer: 0,
      groupPk,
      memberSessionIds: allMessagesFrom,
      messageHashes: messageHashesToUnsend,
      sodium: await getSodiumRenderer(),
      secretKey: group?.secretKey || undefined,
    }),
  });
}

function getUnsendMessagesObjects1o1OrLegacyGroups(messages: Array<MessageModel>) {
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
      });
    })
  );
}
