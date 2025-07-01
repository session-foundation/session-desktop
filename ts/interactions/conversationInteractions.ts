import { isEmpty, uniq } from 'lodash';
import { PubkeyType, WithGroupPubkey } from 'libsession_util_nodejs';
import AbortController from 'abort-controller';
import { READ_MESSAGE_STATE } from '../models/conversationAttributes';
import { CallManager, PromiseUtils, ToastUtils, UserUtils } from '../session/utils';

import { SessionButtonColor } from '../components/basic/SessionButton';
import { getCallMediaPermissionsSettings } from '../components/settings/SessionSettings';
import { Data } from '../data/data';
import { SettingsKey } from '../data/settings-key';
import { ConversationTypeEnum } from '../models/types';
import { OpenGroupUtils } from '../session/apis/open_group_api/utils';
import { getSwarmPollingInstance } from '../session/apis/snode_api';
import { ConvoHub } from '../session/conversations';
import { DisappearingMessageConversationModeType } from '../session/disappearing_messages/types';
import { PubKey } from '../session/types';
import { perfEnd, perfStart } from '../session/utils/Performance';
import { sleepFor, timeoutWithAbort } from '../session/utils/Promise';
import { ed25519Str } from '../session/utils/String';
import { SessionUtilContact } from '../session/utils/libsession/libsession_utils_contacts';
import {
  conversationReset,
  quoteMessage,
  resetConversationExternal,
} from '../state/ducks/conversations';
import {
  updateConfirmModal,
  updateConversationSettingsModal,
  updateGroupMembersModal,
  updateGroupNameModal,
} from '../state/ducks/modalDialog';
import { Storage } from '../util/storage';
import { UserGroupsWrapperActions } from '../webworker/workers/browser/libsession_worker_interface';
import { ConversationInteractionStatus, ConversationInteractionType } from './types';
import { BlockedNumberController } from '../util';
import { sendInviteResponseToGroup } from '../session/sending/group/GroupInviteResponse';
import { NetworkTime } from '../util/NetworkTime';
import { ClosedGroup } from '../session/group/closed-group';
import { GroupUpdateMessageFactory } from '../session/messages/message_factory/group/groupUpdateMessageFactory';
import { MessageSender } from '../session/sending';
import { StoreGroupRequestFactory } from '../session/apis/snode_api/factories/StoreGroupRequestFactory';
import { DURATION } from '../session/constants';
import { GroupInvite } from '../session/utils/job_runners/jobs/GroupInviteJob';
import type { LocalizerProps } from '../components/basic/Localizer';
import { localize } from '../localization/localeTools';

export async function copyPublicKeyByConvoId(convoId: string) {
  if (OpenGroupUtils.isOpenGroupV2(convoId)) {
    const fromWrapper = await UserGroupsWrapperActions.getCommunityByFullUrl(convoId);

    if (!fromWrapper) {
      window.log.warn('opengroup to copy was not found in the UserGroupsWrapper');
      return;
    }

    if (fromWrapper.fullUrlWithPubkey) {
      window.clipboard.writeText(fromWrapper.fullUrlWithPubkey);
      ToastUtils.pushCopiedToClipBoard();
    }
  } else {
    window.clipboard.writeText(convoId);
  }
}

/**
 * Accept if needed the message request from this user.
 * Note: approvalMessageTimestamp is provided to be able to insert the "You've accepted the message request" at the right place.
 * When accepting a message request by sending a message, we need to make sure the "You've accepted the message request" is before the
 * message we are sending to the user.
 *
 */
export const handleAcceptConversationRequest = async ({
  convoId,
  approvalMessageTimestamp,
}: {
  convoId: string;
  approvalMessageTimestamp: number;
}) => {
  const convo = ConvoHub.use().get(convoId);
  if (!convo || convo.isApproved() || (!convo.isPrivate() && !convo.isClosedGroupV2())) {
    window?.log?.info('Conversation is already approved or not private/03group');

    return null;
  }

  const previousIsApproved = convo.isApproved();
  const previousDidApprovedMe = convo.didApproveMe();
  // Note: we don't mark as approvedMe = true, as we do not know if they did send us a message yet.
  await convo.setIsApproved(true, false);
  await convo.commit();

  if (convo.isPrivate()) {
    // we only need the approval message (and sending a reply) when we are accepting a message request. i.e. someone sent us a message already and we didn't accept it yet.
    if (!previousIsApproved && previousDidApprovedMe) {
      await convo.addOutgoingApprovalMessage(approvalMessageTimestamp);
      await convo.sendMessageRequestResponse();
    }

    return null;
  }
  if (PubKey.is03Pubkey(convoId)) {
    const found = await UserGroupsWrapperActions.getGroup(convoId);
    if (!found) {
      window.log.warn('cannot approve a non existing group in user group');
      return null;
    }
    // this updates the wrapper and refresh the redux slice
    await UserGroupsWrapperActions.setGroup({ ...found, invitePending: false });

    // nothing else to do (and especially not wait for first poll) when the convo was already approved
    if (previousIsApproved) {
      return null;
    }
    const pollAndSendResponsePromise = new Promise(resolve => {
      getSwarmPollingInstance().addGroupId(convoId, async () => {
        // we need to do a first poll to fetch the keys etc before we can send our invite response
        // this is pretty hacky, but also an admin seeing a message from that user in the group will mark it as not pending anymore
        await sleepFor(2000);
        if (!previousIsApproved) {
          await sendInviteResponseToGroup({ groupPk: convoId });
        }

        window.log.info(
          `handleAcceptConversationRequest: first poll for group ${ed25519Str(convoId)} happened, we should have encryption keys now`
        );
        return resolve(true);
      });
    });

    // try at most 10s for the keys, and everything to come before continuing processing.
    // Note: this is important as otherwise the polling just hangs when sending a message to a group (as the cb in addGroupId() is never called back)
    const timeout = 10000;
    try {
      await PromiseUtils.timeout(pollAndSendResponsePromise, timeout);
    } catch (e) {
      window.log.warn(
        `handleAcceptConversationRequest: waited ${timeout}ms for first poll of group ${ed25519Str(convoId)} to happen, but timed out with: ${e.message}`
      );
    }
  }
  return null;
};

export async function declineConversationWithoutConfirm({
  alsoBlock,
  conversationId,
  currentlySelectedConvo,
  conversationIdOrigin,
}: {
  conversationId: string;
  currentlySelectedConvo: string | undefined;
  alsoBlock: boolean;
  conversationIdOrigin: string | null;
}) {
  const conversationToDecline = ConvoHub.use().get(conversationId);

  if (
    !conversationToDecline ||
    (!conversationToDecline.isPrivate() && !conversationToDecline.isClosedGroupV2())
  ) {
    window?.log?.info('No conversation to decline.');
    return;
  }
  window.log.debug(
    `declineConversationWithoutConfirm of ${ed25519Str(conversationId)}, alsoBlock:${alsoBlock}, conversationIdOrigin:${conversationIdOrigin ? ed25519Str(conversationIdOrigin) : '<none>'}`
  );

  // Note: declining a message request just hides it.
  await conversationToDecline.setHidden(false);

  if (conversationToDecline.isClosedGroupV2()) {
    // this can only be done for groupv2 convos
    await conversationToDecline.setOriginConversationID('', false);
  }
  // this will update the value in the wrapper if needed but not remove the entry if we want it gone. The remove is done below with removeContactFromWrapper
  await conversationToDecline.commit();
  if (alsoBlock) {
    if (PubKey.is03Pubkey(conversationId)) {
      // Note: if we do want to block this convo, we actually want to block the person who invited us, not the 03 pubkey itself.
      // Also, we don't want to show the block/unblock modal in this case
      // (we are on the WithoutConfirm function)
      if (conversationIdOrigin && !PubKey.is03Pubkey(conversationIdOrigin)) {
        // restoring from seed we can be missing the conversationIdOrigin, so we wouldn't be able to block the person who invited us
        await BlockedNumberController.block(conversationIdOrigin);
      }
    } else {
      await BlockedNumberController.block(conversationId);
    }
  }
  // when removing a message request, without blocking it, we actually have no need to store the conversation in the wrapper. So just remove the entry

  if (
    conversationToDecline.isPrivate() &&
    !SessionUtilContact.isContactToStoreInWrapper(conversationToDecline)
  ) {
    await SessionUtilContact.removeContactFromWrapper(conversationToDecline.id);
  }

  if (PubKey.is03Pubkey(conversationId)) {
    // when deleting a 03 group message request, we also need to remove the conversation altogether
    await ConvoHub.use().deleteGroup(conversationId, {
      deleteAllMessagesOnSwarm: false,
      deletionType: 'doNotKeep',
      forceDestroyForAllMembers: false,
      fromSyncMessage: false,
      sendLeaveMessage: false,
      clearFetchedHashes: false,
    });
  }

  if (currentlySelectedConvo && currentlySelectedConvo === conversationId) {
    window?.inboxStore?.dispatch(resetConversationExternal());
  }
}

export const declineConversationWithConfirm = ({
  conversationId,
  alsoBlock,
  currentlySelectedConvo,
  conversationIdOrigin,
}: {
  conversationId: string;
  currentlySelectedConvo: string | undefined;
  syncToDevices: boolean;
  alsoBlock: boolean;
  conversationIdOrigin: string | null;
}) => {
  const isGroupV2 = PubKey.is03Pubkey(conversationId);
  // restoring from seed we might not have the sender of that invite, so we need to take care of not having one (and not block)
  const originNameToBlock =
    alsoBlock && !!conversationIdOrigin
      ? ConvoHub.use().get(conversationIdOrigin)?.getNicknameOrRealUsernameOrPlaceholder()
      : null;

  const convoName = ConvoHub.use().get(conversationId)?.getNicknameOrRealUsernameOrPlaceholder();

  const i18nMessage: LocalizerProps = isGroupV2
    ? alsoBlock && originNameToBlock
      ? { token: 'blockDescription', args: { name: originNameToBlock } } // groupv2, and blocking by sender name
      : { token: 'groupInviteDelete' } // groupv2, and no info about the sender, falling back to delete only
    : alsoBlock
      ? { token: 'blockDescription', args: { name: convoName } }
      : { token: 'messageRequestsDelete' };

  window?.inboxStore?.dispatch(
    updateConfirmModal({
      okText: alsoBlock ? window.i18n('block') : window.i18n('delete'),
      cancelText: window.i18n('cancel'),
      title: alsoBlock ? window.i18n('block') : window.i18n('delete'),
      i18nMessage,
      okTheme: SessionButtonColor.Danger,
      onClickOk: async () => {
        await declineConversationWithoutConfirm({
          conversationId,
          currentlySelectedConvo,
          alsoBlock,
          conversationIdOrigin,
        });
      },
      onClickCancel: () => {
        window?.inboxStore?.dispatch(updateConfirmModal(null));
      },
      onClickClose: () => {
        window?.inboxStore?.dispatch(updateConfirmModal(null));
      },
    })
  );
};

export async function showUpdateGroupNameByConvoId(conversationId: string) {
  const conversation = ConvoHub.use().get(conversationId);
  if (conversation.isClosedGroup()) {
    // make sure all the members' convo exists so we can add or remove them
    await Promise.all(
      conversation
        .getGroupMembers()
        .map(m => ConvoHub.use().getOrCreateAndWait(m, ConversationTypeEnum.PRIVATE))
    );
  }
  window.inboxStore?.dispatch(updateGroupNameModal({ conversationId }));
}

export async function showUpdateGroupMembersByConvoId(conversationId: string) {
  const conversation = ConvoHub.use().get(conversationId);
  if (conversation.isClosedGroup()) {
    // make sure all the members' convo exists so we can add or remove them
    await Promise.all(
      conversation
        .getGroupMembers()
        .map(m => ConvoHub.use().getOrCreateAndWait(m, ConversationTypeEnum.PRIVATE))
    );
  }
  window.inboxStore?.dispatch(updateGroupMembersModal({ conversationId }));
}

export async function leaveGroupOrCommunityByConvoId({
  conversationId,
  sendLeaveMessage,
  isPublic,
  onClickClose,
}: {
  conversationId: string;
  isPublic: boolean;
  sendLeaveMessage: boolean;
  onClickClose?: () => void;
}) {
  try {
    if (onClickClose) {
      onClickClose();
    }

    if (isPublic) {
      await ConvoHub.use().deleteCommunity(conversationId);
      return;
    }
    // for groups, we have a "leaving..." state that we don't need for communities.
    // that's because communities can be left always, whereas for groups we need to send a leave message (and so have some encryption keypairs)
    await updateConversationInteractionState({
      conversationId,
      type: ConversationInteractionType.Leave,
      status: ConversationInteractionStatus.Start,
    });

    if (PubKey.is05Pubkey(conversationId)) {
      await ConvoHub.use().deleteLegacyGroup(conversationId, {
        fromSyncMessage: false,
        sendLeaveMessage,
      });
    } else if (PubKey.is03Pubkey(conversationId)) {
      await ConvoHub.use().deleteGroup(conversationId, {
        fromSyncMessage: false,
        sendLeaveMessage,
        deleteAllMessagesOnSwarm: false,
        deletionType: 'doNotKeep',
        forceDestroyForAllMembers: false,
        clearFetchedHashes: true,
      });
    }
    await clearConversationInteractionState({ conversationId });
  } catch (err) {
    window.log.warn(`showLeaveGroupByConvoId error: ${err}`);
    await saveConversationInteractionErrorAsMessage({
      conversationId,
      interactionType: ConversationInteractionType.Leave,
    });
  }
}

export async function showLeaveGroupByConvoId(conversationId: string, name: string | undefined) {
  const conversation = ConvoHub.use().get(conversationId);

  if (!conversation.isClosedGroup()) {
    throw new Error('showLeaveGroupDialog() called with a non group convo.');
  }

  const admins = conversation.getGroupAdmins();
  const weAreAdmin = admins.includes(UserUtils.getOurPubKeyStrFromCache());
  const weAreLastAdmin =
    (PubKey.is05Pubkey(conversationId) || PubKey.is03Pubkey(conversationId)) &&
    weAreAdmin &&
    admins.length === 1;

  // if this is a community, or we legacy group are not admin, we can just show a confirmation dialog

  const onClickClose = () => {
    window?.inboxStore?.dispatch(updateConfirmModal(null));
  };

  const onClickOk = async () => {
    await leaveGroupOrCommunityByConvoId({
      conversationId,
      isPublic: false,
      sendLeaveMessage: !weAreLastAdmin, // we don't need to send a leave message when we are the last admin: the group is removed.
      onClickClose,
    });
    window?.inboxStore?.dispatch(updateConversationSettingsModal(null));
  };

  if (weAreLastAdmin) {
    window?.inboxStore?.dispatch(
      updateConfirmModal({
        title: window.i18n('groupLeave'),
        i18nMessage: {
          token: 'groupDeleteDescription',
          args: { group_name: name || window.i18n('unknown') },
        },
        onClickOk,
        okText: window.i18n('leave'),
        okTheme: SessionButtonColor.Danger,
        onClickClose,
        conversationId,
      })
    );
    return;
  }
  window?.inboxStore?.dispatch(
    updateConfirmModal({
      title: localize('groupLeave').toString(),
      i18nMessage: { token: 'groupLeaveDescription', args: { group_name: name ?? '' } },
      onClickOk,
      okText: window.i18n('leave'),
      okTheme: SessionButtonColor.Danger,
      onClickClose,
      conversationId,
    })
  );
}

/**
 * Can be used to show a dialog asking confirmation about deleting a group.
 * Communities are explicitly forbidden.
 * This function won't attempt to send a leave message. Use `showLeaveGroupByConvoId` for that purpose
 */
export async function showDeleteGroupByConvoId(conversationId: string, name: string | undefined) {
  const conversation = ConvoHub.use().get(conversationId);

  const isPublic = conversation.isPublic();

  if (!conversation.isGroup() || isPublic) {
    throw new Error('showDeleteGroupByConvoId() called with a non group convo.');
  }

  const onClickClose = () => {
    window?.inboxStore?.dispatch(updateConfirmModal(null));
  };

  const onClickOk = async () => {
    await leaveGroupOrCommunityByConvoId({
      conversationId,
      isPublic, // we check for isPublic above, and throw if it's true
      sendLeaveMessage: false,
      onClickClose,
    });
    window?.inboxStore?.dispatch(updateConversationSettingsModal(null));
  };

  window?.inboxStore?.dispatch(
    updateConfirmModal({
      title: window.i18n('groupDelete'),
      i18nMessage: { token: 'groupDeleteDescriptionMember', args: { group_name: name ?? '' } },
      onClickOk,
      okText: window.i18n('delete'),
      okTheme: SessionButtonColor.Danger,
      onClickClose,
      conversationId,
    })
  );
}

export async function markAllReadByConvoId(conversationId: string) {
  const conversation = ConvoHub.use().get(conversationId);
  perfStart(`markAllReadByConvoId-${conversationId}`);

  await conversation?.markAllAsRead();

  perfEnd(`markAllReadByConvoId-${conversationId}`, 'markAllReadByConvoId');
}

export async function deleteAllMessagesByConvoIdNoConfirmation(conversationId: string) {
  const conversation = ConvoHub.use().get(conversationId);
  await Data.removeAllMessagesInConversation(conversationId);

  // destroy message keeps the active timestamp set so the
  // conversation still appears on the conversation list but is empty
  conversation.set({
    lastMessage: null,
    lastMessageInteractionType: null,
    lastMessageInteractionStatus: null,
  });

  await conversation.commit();
  window.inboxStore?.dispatch(conversationReset(conversationId));
}

export async function setDisappearingMessagesByConvoId(
  conversationId: string,
  expirationMode: DisappearingMessageConversationModeType,
  seconds?: number
) {
  const conversation = ConvoHub.use().get(conversationId);

  const canSetDisappearing = !conversation.isOutgoingRequest() && !conversation.isIncomingRequest();

  if (!canSetDisappearing) {
    return;
  }

  if (!expirationMode || expirationMode === 'off' || !seconds || seconds <= 0) {
    await conversation.updateExpireTimer({
      providedDisappearingMode: 'off',
      providedExpireTimer: 0,
      fromSync: false,
      fromCurrentDevice: true,
      fromConfigMessage: false,
      messageHash: null,
    });
  } else {
    await conversation.updateExpireTimer({
      providedDisappearingMode: expirationMode,
      providedExpireTimer: seconds,
      fromSync: false,
      fromCurrentDevice: true,
      fromConfigMessage: false,
      messageHash: null,
    });
  }
}
export async function replyToMessage(messageId: string) {
  const quotedMessageModel = await Data.getMessageById(messageId);
  if (!quotedMessageModel) {
    window.log.warn('Failed to find message to reply to');
    return false;
  }
  const conversationModel = ConvoHub.use().getOrThrow(quotedMessageModel.get('conversationId'));

  const quotedMessageProps = await conversationModel.makeQuote(quotedMessageModel);

  if (quotedMessageProps) {
    window.inboxStore?.dispatch(quoteMessage(quotedMessageProps));
  } else {
    window.inboxStore?.dispatch(quoteMessage(undefined));
  }

  return true;
}

export async function resendMessage(messageId: string) {
  const foundMessageModel = await Data.getMessageById(messageId);

  if (!foundMessageModel) {
    window.log.warn('Failed to find message to resend');
    return false;
  }

  await foundMessageModel.retrySend();
  return true;
}

/**
 * Check if what is pasted is a URL and prompt confirmation for a setting change
 * @param e paste event
 */
export async function showLinkSharingConfirmationModalDialog(e: any) {
  const pastedText = e.clipboardData.getData('text');
  if (isURL(pastedText) && !window.getSettingValue(SettingsKey.settingsLinkPreview, false)) {
    const alreadyDisplayedPopup =
      (await Data.getItemById(SettingsKey.hasLinkPreviewPopupBeenDisplayed))?.value || false;
    if (!alreadyDisplayedPopup) {
      window.inboxStore?.dispatch(
        updateConfirmModal({
          title: window.i18n('linkPreviewsEnable'),
          i18nMessage: { token: 'linkPreviewsFirstDescription' },
          okTheme: SessionButtonColor.Danger,
          onClickOk: async () => {
            await window.setSettingValue(SettingsKey.settingsLinkPreview, true);
          },
          onClickClose: async () => {
            await Storage.put(SettingsKey.hasLinkPreviewPopupBeenDisplayed, true);
          },
          okText: window.i18n('enable'),
        })
      );
    }
  }
}

/**
 *
 * @param str String to evaluate
 * @returns boolean if the string is true or false
 */
function isURL(str: string) {
  const urlRegex =
    '^(?!mailto:)(?:(?:http|https|ftp)://)(?:\\S+(?::\\S*)?@)?(?:(?:(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}(?:\\.(?:[0-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))|(?:(?:[a-z\\u00a1-\\uffff0-9]+-?)*[a-z\\u00a1-\\uffff0-9]+)(?:\\.(?:[a-z\\u00a1-\\uffff0-9]+-?)*[a-z\\u00a1-\\uffff0-9]+)*(?:\\.(?:[a-z\\u00a1-\\uffff]{2,})))|localhost)(?::\\d{2,5})?(?:(/|\\?|#)[^\\s]*)?$';
  const url = new RegExp(urlRegex, 'i');
  return str.length < 2083 && url.test(str);
}

export async function callRecipient(pubkey: string, canCall: boolean) {
  const convo = ConvoHub.use().get(pubkey);

  if (!canCall) {
    ToastUtils.pushUnableToCall();
    return;
  }

  if (!getCallMediaPermissionsSettings()) {
    ToastUtils.pushVideoCallPermissionNeeded();
    return;
  }

  if (convo && convo.isPrivate() && !convo.isMe()) {
    await CallManager.USER_callRecipient(convo.id);
  }
}

/**
 * Updates the interaction state for a conversation. Remember to run clearConversationInteractionState() when the interaction is complete and we don't want to show it in the UI anymore.
 * @param conversationId id of the conversation we want to interact with
 * @param type the type of conversation interaction we are doing
 * @param status the status of that interaction
 */
export async function updateConversationInteractionState({
  conversationId,
  type,
  status,
}: {
  conversationId: string;
  type: ConversationInteractionType;
  status: ConversationInteractionStatus;
}) {
  const convo = ConvoHub.use().get(conversationId);
  if (
    convo &&
    (type !== convo.get('lastMessageInteractionType') ||
      status !== convo.get('lastMessageInteractionStatus'))
  ) {
    convo.setKey('lastMessageInteractionType', type);
    convo.setKey('lastMessageInteractionStatus', status);

    await convo.commit();
    window.log.debug(
      `updateConversationInteractionState for ${conversationId} to ${type} ${status}`
    );
  }
}

/**
 * Clears the interaction state for a conversation. We would use this when we don't need to show anything in the UI once an action is complete.
 * @param conversationId id of the conversation whose interaction we want to clear
 */
export async function clearConversationInteractionState({
  conversationId,
}: {
  conversationId: string;
}) {
  const convo = ConvoHub.use().get(conversationId);
  if (
    convo &&
    (convo.get('lastMessageInteractionType') || convo.get('lastMessageInteractionStatus'))
  ) {
    convo.setKey('lastMessageInteractionType', null);
    convo.setKey('lastMessageInteractionStatus', null);

    await convo.commit();
    window.log.debug(`clearConversationInteractionState for ${conversationId}`);
  }
}

async function saveConversationInteractionErrorAsMessage({
  conversationId,
  interactionType,
}: {
  conversationId: string;
  interactionType: ConversationInteractionType;
}) {
  const conversation = ConvoHub.use().get(conversationId);
  if (!conversation) {
    return;
  }

  const interactionStatus = ConversationInteractionStatus.Error;

  await updateConversationInteractionState({
    conversationId,
    type: interactionType,
    status: interactionStatus,
  });

  // NOTE at this time we don't have visible control messages in communities
  if (conversation.isPublic()) {
    return;
  }

  // Add an error message to the database so we can view it in the message history
  await conversation?.addSingleIncomingMessage({
    source: NetworkTime.now().toString(),
    sent_at: Date.now(),
    interactionNotification: {
      interactionType,
      interactionStatus,
    },
    unread: READ_MESSAGE_STATE.read,
    expireTimer: 0,
  });

  conversation.updateLastMessage();
}

export async function promoteUsersInGroup({
  groupPk,
  toPromote,
}: { toPromote: Array<PubkeyType> } & WithGroupPubkey) {
  if (!toPromote.length) {
    window.log.debug('promoteUsersInGroup: no users to promote');
    return;
  }

  const convo = ConvoHub.use().get(groupPk);
  if (!convo) {
    window.log.debug('promoteUsersInGroup: group convo not found');
    return;
  }

  const groupInWrapper = await UserGroupsWrapperActions.getGroup(groupPk);
  if (!groupInWrapper || !groupInWrapper.secretKey || isEmpty(groupInWrapper.secretKey)) {
    window.log.debug('promoteUsersInGroup: groupInWrapper not found or no secretkey');
    return;
  }

  // push one group change message where initial members are added to the group
  const membersHex = uniq(toPromote);
  const sentAt = NetworkTime.now();
  const us = UserUtils.getOurPubKeyStrFromCache();
  const msgModel = await ClosedGroup.addUpdateMessage({
    diff: { type: 'promoted', promoted: membersHex },
    expireUpdate: null,
    sender: us,
    sentAt,
    convo,
    markAlreadySent: false, // the store below will mark the message as sent with dbMsgIdentifier
    messageHash: null,
  });
  const groupMemberChange = await GroupUpdateMessageFactory.getPromotedControlMessage({
    adminSecretKey: groupInWrapper.secretKey,
    convo,
    groupPk,
    promoted: membersHex,
    createAtNetworkTimestamp: sentAt,
    dbMsgIdentifier: msgModel.id,
  });

  if (!groupMemberChange) {
    window.log.warn('promoteUsersInGroup: failed to build group change');
    throw new Error('promoteUsersInGroup: failed to build group change');
  }

  const storeRequests = await StoreGroupRequestFactory.makeGroupMessageSubRequest(
    [groupMemberChange],
    groupInWrapper
  );

  const controller = new AbortController();
  const result = await timeoutWithAbort(
    MessageSender.sendEncryptedDataToSnode({
      destination: groupPk,
      method: 'batch',
      sortedSubRequests: storeRequests,
      abortSignal: controller.signal,
      allow401s: false,
    }),
    2 * DURATION.MINUTES,
    controller
  );

  if (result?.[0].code !== 200) {
    window.log.warn('promoteUsersInGroup: failed to store change');
    throw new Error('promoteUsersInGroup: failed to store change');
  }

  for (let index = 0; index < membersHex.length; index++) {
    const member = membersHex[index];
    // eslint-disable-next-line no-await-in-loop
    await GroupInvite.addJob({ groupPk, member, inviteAsAdmin: true });
  }
}
