import { GroupPubkeyType, PubkeyType } from 'libsession_util_nodejs';
import { compact, isEmpty } from 'lodash';
import { SessionButtonColor } from '../../components/basic/SessionButton';
import { Data } from '../../data/data';
import { ConversationModel } from '../../models/conversation';
import { MessageModel } from '../../models/message';
import { deleteSogsMessageByServerIds } from '../../session/apis/open_group_api/sogsv3/sogsV3DeleteMessages';
import { SnodeAPI } from '../../session/apis/snode_api/SNodeAPI';
import { SnodeNamespaces } from '../../session/apis/snode_api/namespaces';
import { ConvoHub } from '../../session/conversations';
import { getSodiumRenderer } from '../../session/crypto';
import { UnsendMessage } from '../../session/messages/outgoing/controlMessage/UnsendMessage';
import { GroupUpdateDeleteMemberContentMessage } from '../../session/messages/outgoing/controlMessage/group_v2/to_group/GroupUpdateDeleteMemberContentMessage';
import { PubKey } from '../../session/types';
import { ToastUtils, UserUtils } from '../../session/utils';
import { closeRightPanel, resetSelectedMessageIds } from '../../state/ducks/conversations';
import { updateConfirmModal } from '../../state/ducks/modalDialog';
import { ed25519Str } from '../../session/utils/String';

import { UserGroupsWrapperActions } from '../../webworker/workers/browser/libsession_worker_interface';
import { NetworkTime } from '../../util/NetworkTime';
import { MessageQueue } from '../../session/sending';
import { WithLocalMessageDeletionType } from '../../session/types/with';
import { tr, type TrArgs } from '../../localization/localeTools';
import { sectionActions } from '../../state/ducks/section';

async function unsendMessagesForEveryone1o1AndLegacy(
  conversation: ConversationModel,
  destination: PubkeyType,
  msgsToDelete: Array<MessageModel>
) {
  const unsendMsgObjects = getUnsendMessagesObjects1o1OrLegacyGroups(msgsToDelete);

  if (conversation.isClosedGroupV2()) {
    throw new Error('unsendMessagesForEveryone1o1AndLegacy not compatible with group v2');
  }

  if (conversation.isPrivate()) {
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
    return;
  }
  if (conversation.isClosedGroup()) {
    // legacy groups are readonly
  }
}

export async function unsendMessagesForEveryoneGroupV2({
  allMessagesFrom,
  groupPk,
  msgsToDelete,
}: {
  groupPk: GroupPubkeyType;
  msgsToDelete: Array<MessageModel>;
  allMessagesFrom: Array<PubkeyType>;
}) {
  const messageHashesToUnsend = getMessageHashes(msgsToDelete);
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
      userProfile: null,
    }),
  });
}

/**
 * Deletes messages for everyone in a 1-1 or everyone in a closed group conversation.
 */
async function unsendMessagesForEveryone(
  conversation: ConversationModel,
  msgsToDelete: Array<MessageModel>,
  { deletionType }: WithLocalMessageDeletionType
) {
  window?.log?.info('Deleting messages for all users in this conversation');
  const destinationId = conversation.id;
  if (!destinationId) {
    return;
  }
  if (conversation.isOpenGroupV2()) {
    throw new Error(
      'Cannot unsend a message for an opengroup v2. This has to be a deleteMessage api call'
    );
  }

  if (
    conversation.isPrivate() ||
    (conversation.isClosedGroup() && !conversation.isClosedGroupV2())
  ) {
    if (!PubKey.is05Pubkey(conversation.id)) {
      throw new Error('unsendMessagesForEveryone1o1AndLegacy requires a 05 key');
    }
    await unsendMessagesForEveryone1o1AndLegacy(conversation, conversation.id, msgsToDelete);
  } else if (conversation.isClosedGroupV2()) {
    if (!PubKey.is03Pubkey(destinationId)) {
      throw new Error('invalid conversation id (03) for unsendMessageForEveryone');
    }
    await unsendMessagesForEveryoneGroupV2({
      groupPk: destinationId,
      msgsToDelete,
      allMessagesFrom: [], // currently we cannot remove all the messages from a specific pubkey but we do already handle them on the receiving side
    });
  }
  if (deletionType === 'complete') {
    await deleteMessagesFromSwarmAndCompletelyLocally(conversation, msgsToDelete);
  } else {
    await deleteMessagesFromSwarmAndMarkAsDeletedLocally(conversation, msgsToDelete);
  }

  window.inboxStore?.dispatch(resetSelectedMessageIds());
  ToastUtils.pushDeleted(msgsToDelete.length);
}

function getUnsendMessagesObjects1o1OrLegacyGroups(messages: Array<MessageModel>) {
  // #region building request
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
  // #endregion
}

function getMessageHashes(messages: Array<MessageModel>) {
  return compact(
    messages.map(message => {
      return message.get('messageHash');
    })
  );
}

function isStringArray(value: unknown): value is Array<string> {
  return Array.isArray(value) && value.every(val => typeof val === 'string');
}

/**
 * Do a single request to the swarm with all the message hashes to delete from the swarm.
 *
 * It does not delete anything locally.
 *
 * Returns true if no errors happened, false in an error happened
 */
export async function deleteMessagesFromSwarmOnly(
  messages: Array<MessageModel> | Array<string>,
  pubkey: PubkeyType | GroupPubkeyType
) {
  const deletionMessageHashes = isStringArray(messages) ? messages : getMessageHashes(messages);

  try {
    if (isEmpty(messages)) {
      return false;
    }

    if (!deletionMessageHashes.length) {
      window.log?.warn(
        'deleteMessagesFromSwarmOnly: We do not have hashes for some of those messages'
      );
      return false;
    }
    const hashesAsSet = new Set(deletionMessageHashes);
    if (PubKey.is03Pubkey(pubkey)) {
      return await SnodeAPI.networkDeleteMessagesForGroup(hashesAsSet, pubkey);
    }
    return await SnodeAPI.networkDeleteMessageOurSwarm(hashesAsSet, pubkey);
  } catch (e) {
    window.log?.error(
      `deleteMessagesFromSwarmOnly: Error deleting message from swarm of ${ed25519Str(pubkey)}, hashes: ${deletionMessageHashes}`,
      e
    );
    return false;
  }
}

/**
 * Delete the messages from the swarm with an unsend request and if it worked, delete those messages locally.
 * If an error happened, we just return false, Toast an error, and do not remove the messages locally at all.
 */
export async function deleteMessagesFromSwarmAndCompletelyLocally(
  conversation: ConversationModel,
  messages: Array<MessageModel>
) {
  // If this is a private chat, we can only delete messages on our own swarm, so use our "side" of the conversation
  const pubkey = conversation.isPrivate() ? UserUtils.getOurPubKeyStrFromCache() : conversation.id;
  if (!PubKey.is03Pubkey(pubkey) && !PubKey.is05Pubkey(pubkey)) {
    throw new Error('deleteMessagesFromSwarmAndCompletelyLocally needs a 03 or 05 pk');
  }
  if (PubKey.is05Pubkey(pubkey) && pubkey !== UserUtils.getOurPubKeyStrFromCache()) {
    window.log.warn(
      'deleteMessagesFromSwarmAndCompletelyLocally with 05 pk can only delete for ourself'
    );
    return;
  }
  // LEGACY GROUPS -- we cannot delete on the swarm (just unsend which is done separately)
  if (conversation.isClosedGroup() && PubKey.is05Pubkey(pubkey)) {
    window.log.info('Cannot delete message from a closed group swarm, so we just complete delete.');
    await deleteMessagesLocallyOnly({ conversation, messages, deletionType: 'complete' });
    return;
  }
  window.log.info(
    'Deleting from swarm of ',
    ed25519Str(pubkey),
    ' hashes: ',
    messages.map(m => m.get('messageHash'))
  );
  const deletedFromSwarm = await deleteMessagesFromSwarmOnly(messages, pubkey);
  if (!deletedFromSwarm) {
    window.log.warn(
      'deleteMessagesFromSwarmAndCompletelyLocally: some messages failed to be deleted. Maybe they were already deleted?'
    );
  }
  await deleteMessagesLocallyOnly({ conversation, messages, deletionType: 'complete' });
}

/**
 * Delete the messages from the swarm with an unsend request and if it worked, mark those messages locally as deleted but do not remove them.
 * If an error happened, we still mark the message locally as deleted.
 */
export async function deleteMessagesFromSwarmAndMarkAsDeletedLocally(
  conversation: ConversationModel,
  messages: Array<MessageModel>
) {
  // legacy groups cannot delete messages on the swarm (just "unsend")
  if (conversation.isClosedGroup() && PubKey.is05Pubkey(conversation.id)) {
    window.log.info(
      'Cannot delete messages from a legacy closed group swarm, so we just markDeleted.'
    );
    await deleteMessagesLocallyOnly({ conversation, messages, deletionType: 'markDeleted' });

    return;
  }

  // we can only delete messages on the swarm when they are on our own swarm, or it is a groupv2 that we are the admin off
  const pubkeyToDeleteFrom = PubKey.is03Pubkey(conversation.id)
    ? conversation.id
    : UserUtils.getOurPubKeyStrFromCache();

  // if this is a groupv2 and we don't have the admin key, it will fail and return false.
  const deletedFromSwarm = await deleteMessagesFromSwarmOnly(messages, pubkeyToDeleteFrom);
  if (!deletedFromSwarm) {
    window.log.warn(
      'deleteMessagesFromSwarmAndMarkAsDeletedLocally: some messages failed to be deleted but still removing the messages content... '
    );
  }
  await deleteMessagesLocallyOnly({ conversation, messages, deletionType: 'markDeleted' });
}

/**
 * Deletes a message completely or mark it as deleted only. Does not interact with the swarm at all
 * @param message Message to delete
 * @param deletionType 'complete' means completely delete the item from the database, markDeleted means empty the message content but keep an entry
 */
async function deleteMessagesLocallyOnly({
  conversation,
  messages,
  deletionType,
}: WithLocalMessageDeletionType & {
  conversation: ConversationModel;
  messages: Array<MessageModel>;
}) {
  for (let index = 0; index < messages.length; index++) {
    const message = messages[index];
    if (deletionType === 'complete') {
      // remove the message from the database
      // eslint-disable-next-line no-await-in-loop
      await conversation.removeMessage(message.id);
    } else {
      // just mark the message as deleted but still show in conversation
      // eslint-disable-next-line no-await-in-loop
      await message.markAsDeleted();
    }
  }

  conversation.updateLastMessage();
}

/**
 * Send an UnsendMessage synced message so our devices removes those messages locally,
 * and send an unsend request on our swarm so this message is effectively removed.
 *
 * Show a toast on error/success and reset the selection
 */
async function unsendMessageJustForThisUser(
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

const doDeleteSelectedMessagesInSOGS = async (
  selectedMessages: Array<MessageModel>,
  conversation: ConversationModel,
  isAllOurs: boolean
) => {
  const ourDevicePubkey = UserUtils.getOurPubKeyStrFromCache();
  if (!ourDevicePubkey) {
    return;
  }
  // #region open group v2 deletion
  // Get our Moderator status
  const isAdmin = conversation.weAreAdminUnblinded();
  const isModerator = conversation.isModerator(ourDevicePubkey);

  if (!isAllOurs && !(isAdmin || isModerator)) {
    ToastUtils.pushMessageDeleteForbidden();
    window.inboxStore?.dispatch(resetSelectedMessageIds());
    return;
  }

  const toDeleteLocallyIds = await deleteOpenGroupMessages(selectedMessages, conversation);
  if (toDeleteLocallyIds.length === 0) {
    // Message failed to delete from server, show error?
    return;
  }
  await Promise.all(
    toDeleteLocallyIds.map(async id => {
      const msgToDeleteLocally = await Data.getMessageById(id);
      if (msgToDeleteLocally) {
        return deleteMessagesLocallyOnly({
          conversation,
          messages: [msgToDeleteLocally],
          deletionType: 'complete',
        });
      }
      return null;
    })
  );
  // successful deletion
  ToastUtils.pushDeleted(toDeleteLocallyIds.length);
  window.inboxStore?.dispatch(resetSelectedMessageIds());
  // #endregion
};

/**
 * Effectively delete the messages from a conversation.
 * This call is to be called by the user on a confirmation dialog for instance.
 *
 * It does what needs to be done on a user action to delete messages for each conversation type
 */
const doDeleteSelectedMessages = async ({
  conversation,
  selectedMessages,
  deleteForEveryone,
}: {
  selectedMessages: Array<MessageModel>;
  conversation: ConversationModel;
  deleteForEveryone: boolean;
}) => {
  const ourDevicePubkey = UserUtils.getOurPubKeyStrFromCache();
  if (!ourDevicePubkey) {
    return;
  }

  const areAllOurs = selectedMessages.every(message => message.getSource() === ourDevicePubkey);
  if (conversation.isPublic()) {
    await doDeleteSelectedMessagesInSOGS(selectedMessages, conversation, areAllOurs);
    return;
  }

  //  Note: a groupv2 member can delete messages for everyone if they are the admin, or if that message is theirs.

  if (deleteForEveryone) {
    if (conversation.isClosedGroupV2()) {
      const convoId = conversation.id;
      if (!PubKey.is03Pubkey(convoId)) {
        throw new Error('unsend request for groupv2 but not a 03 key is impossible possible');
      }
      // only lookup adminKey if we need to
      if (!areAllOurs) {
        const group = await UserGroupsWrapperActions.getGroup(convoId);
        const weHaveAdminKey = !isEmpty(group?.secretKey);
        if (!weHaveAdminKey) {
          ToastUtils.pushMessageDeleteForbidden();
          window.inboxStore?.dispatch(resetSelectedMessageIds());
          return;
        }
      }
      // if they are all ours, of not but we are an admin, we can move forward
      await unsendMessagesForEveryone(conversation, selectedMessages, {
        deletionType: 'markDeleted', // 03 groups: mark as deleted
      });
      return;
    }

    if (!areAllOurs) {
      ToastUtils.pushMessageDeleteForbidden();
      window.inboxStore?.dispatch(resetSelectedMessageIds());
      return;
    }
    await unsendMessagesForEveryone(conversation, selectedMessages, { deletionType: 'complete' }); // not 03 group: delete completely
    return;
  }

  // delete just for me in a groupv2 only means delete locally (not even synced to our other devices)
  if (conversation.isClosedGroupV2()) {
    await deleteMessagesLocallyOnly({
      conversation,
      messages: selectedMessages,
      deletionType: 'markDeleted',
    });
    ToastUtils.pushDeleted(selectedMessages.length);

    return;
  }

  // delete just for me in a legacy closed group only means delete locally
  if (conversation.isClosedGroup()) {
    await deleteMessagesFromSwarmAndMarkAsDeletedLocally(conversation, selectedMessages);

    // Update view and trigger update
    window.inboxStore?.dispatch(resetSelectedMessageIds());
    ToastUtils.pushDeleted(selectedMessages.length);
    return;
  }
  // otherwise, delete that message locally, from our swarm and from our other devices
  await unsendMessageJustForThisUser(conversation, selectedMessages);
};

/**
 * Either delete for everyone or not, based on the props
 */
export async function deleteMessagesForX(
  messageIds: Array<string>,
  conversationId: string,
  /** should only be enforced for messages successfully sent on communities */
  enforceDeleteServerSide: boolean
) {
  if (conversationId) {
    if (enforceDeleteServerSide) {
      await deleteMessagesByIdForEveryone(messageIds, conversationId);
    } else {
      await deleteMessagesById(messageIds, conversationId);
    }
  }
}

export async function deleteMessagesByIdForEveryone(
  messageIds: Array<string>,
  conversationId: string
) {
  const conversation = ConvoHub.use().getOrThrow(conversationId);
  const isMe = conversation.isMe();
  const selectedMessages = compact(
    await Promise.all(messageIds.map(m => Data.getMessageById(m, false)))
  );

  const closeDialog = () => window.inboxStore?.dispatch(updateConfirmModal(null));

  window.inboxStore?.dispatch(
    updateConfirmModal({
      title: isMe ? tr('deleteMessageDevicesAll') : tr('clearMessagesForEveryone'),
      i18nMessage: { token: 'deleteMessageConfirm', count: selectedMessages.length },
      okText: isMe ? tr('deleteMessageDevicesAll') : tr('clearMessagesForEveryone'),
      okTheme: SessionButtonColor.Danger,
      onClickOk: async () => {
        await doDeleteSelectedMessages({ selectedMessages, conversation, deleteForEveryone: true });

        // explicitly close modal for this case.
        closeDialog();
      },
      onClickCancel: closeDialog,
      onClickClose: closeDialog,
    })
  );
}

export async function deleteMessagesById(messageIds: Array<string>, conversationId: string) {
  const conversation = ConvoHub.use().getOrThrow(conversationId);
  const selectedMessages = compact(
    await Promise.all(messageIds.map(m => Data.getMessageById(m, false)))
  );

  const isMe = conversation.isMe();
  const count = messageIds.length;

  const closeDialog = () => window.inboxStore?.dispatch(updateConfirmModal(null));
  const clearMessagesForEveryone = 'clearMessagesForEveryone';

  // Note: the isMe case has no radio buttons, so we just show the description below
  const i18nMessage: TrArgs | undefined = isMe
    ? { token: 'deleteMessageDescriptionDevice', count }
    : undefined;

  window.inboxStore?.dispatch(
    updateConfirmModal({
      title: tr('deleteMessage', { count: selectedMessages.length }),
      radioOptions: !isMe
        ? [
            {
              label: tr('clearMessagesForMe'),
              value: 'clearMessagesForMe' as const,
              inputDataTestId: 'input-deleteJustForMe' as const,
              labelDataTestId: 'label-deleteJustForMe' as const,
            },
            {
              label: tr('clearMessagesForEveryone'),
              value: clearMessagesForEveryone,
              inputDataTestId: 'input-deleteForEveryone' as const,
              labelDataTestId: 'label-deleteForEveryone' as const,
            },
          ]
        : undefined,
      i18nMessage,
      okText: tr('delete'),
      okTheme: SessionButtonColor.Danger,
      onClickOk: async args => {
        await doDeleteSelectedMessages({
          selectedMessages,
          conversation,
          deleteForEveryone: args === clearMessagesForEveryone,
        });
        window.inboxStore?.dispatch(updateConfirmModal(null));
        window.inboxStore?.dispatch(closeRightPanel());
        window.inboxStore?.dispatch(sectionActions.resetRightOverlayMode());
      },
      onClickClose: closeDialog,
    })
  );
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
