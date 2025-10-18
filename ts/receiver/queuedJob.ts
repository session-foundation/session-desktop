import _, { isEmpty, isNumber, toNumber } from 'lodash';
import { queueAttachmentDownloads } from './attachments';

import { Data } from '../data/data';
import { ConversationModel } from '../models/conversation';
import { MessageModel } from '../models/message';
import { ConvoHub } from '../session/conversations';
import { Quote } from './types';

import { MessageDirection } from '../models/messageType';
import { ConversationTypeEnum } from '../models/types';
import { SignalService } from '../protobuf';
import { DisappearingMessages } from '../session/disappearing_messages';
import { ProfileManager } from '../session/profile_manager/ProfileManager';
import { PubKey } from '../session/types';
import { UserUtils } from '../session/utils';
import {
  MessageModelPropsWithoutConvoProps,
  lookupQuote,
  pushQuotedMessageDetails,
} from '../state/ducks/conversations';
import { showMessageRequestBannerOutsideRedux } from '../state/ducks/userConfig';
import { selectMemberInviteSentOutsideRedux } from '../state/selectors/groups';
import { getHideMessageRequestBannerOutsideRedux } from '../state/selectors/userConfig';
import { LinkPreviews } from '../util/linkPreviews';
import { GroupV2Receiver } from './groupv2/handleGroupV2Message';
import { Constants } from '../session';
import { Timestamp } from '../types/timestamp/timestamp';

function isMessageModel(
  msg: MessageModel | MessageModelPropsWithoutConvoProps
): msg is MessageModel {
  return (msg as MessageModel).get !== undefined;
}

/**
 * Note: this function does not trigger a write to the db nor trigger redux update.
 * You have to call msg.commit() once you are done with the handling of this message
 */
async function copyFromQuotedMessage(
  msg: MessageModel,
  quote?: SignalService.DataMessage.IQuote | null
): Promise<void> {
  if (!quote) {
    return;
  }
  const { id: quoteId, author } = quote;

  const quoteLocal: Quote = {
    attachments: null,
    author,
    id: _.toNumber(quoteId),
    text: null,
    referencedMessageNotFound: false,
  };

  const id = _.toNumber(quoteId);

  // First we try to look for the quote in memory
  const stateConversations = window.inboxStore?.getState().conversations;
  const { messages, quotes } = stateConversations;
  let quotedMessage: MessageModelPropsWithoutConvoProps | MessageModel | undefined = lookupQuote(
    quotes,
    messages,
    id,
    quote.author
  );

  // If the quote is not found in memory, we try to find it in the DB
  if (!quotedMessage) {
    // We always look for the quote by sentAt timestamp, for opengroups, closed groups and session chats
    // this will return an array of sent messages by id that we have locally.
    const quotedMessagesCollection = await Data.getMessagesBySenderAndSentAt([
      {
        timestamp: id,
        source: quote.author,
      },
    ]);

    if (quotedMessagesCollection?.length) {
      quotedMessage = quotedMessagesCollection.at(0);
    }
  }

  if (!quotedMessage) {
    window?.log?.warn(`We did not found quoted message ${id} with author ${author}.`);
    quoteLocal.referencedMessageNotFound = true;
    msg.setQuote(quoteLocal);
    return;
  }

  window?.log?.info(`Found quoted message id: ${id}`);
  quoteLocal.referencedMessageNotFound = false;

  if (isMessageModel(quotedMessage)) {
    window.inboxStore?.dispatch(pushQuotedMessageDetails(quotedMessage.getMessageModelProps()));
  } else {
    window.inboxStore?.dispatch(pushQuotedMessageDetails(quotedMessage));
  }

  msg.setQuote(quoteLocal);
}

/**
 * Note: This does not trigger a redux update, nor write to the DB
 */
function handleLinkPreviews(messageBody: string, messagePreview: any, message: MessageModel) {
  const urls = LinkPreviews.findLinks(messageBody);
  const incomingPreview = messagePreview || [];
  const preview = incomingPreview
    .filter((item: any) => (item.image || item.title) && urls.includes(item.url))
    .map((p: any) => ({
      ...p,
      pending: true,
    }));
  if (preview.length < incomingPreview.length) {
    window?.log?.info(
      `${message.idForLogging()}: Eliminated ${
        preview.length - incomingPreview.length
      } previews with invalid urls'`
    );
  }

  message.setPreview(preview);
}

export type RegularMessageType = Pick<
  SignalService.DataMessage,
  | 'attachments'
  | 'body'
  | 'flags'
  | 'openGroupInvitation'
  | 'quote'
  | 'preview'
  | 'reaction'
  | 'profile'
  | 'profileKey'
  | 'blocksCommunityMessageRequests'
> & { isRegularMessage: true };

/**
 * This function is just used to make sure we do not forward things we shouldn't in the incoming message pipeline
 */
export function toRegularMessage(rawDataMessage: SignalService.DataMessage): RegularMessageType {
  return {
    ..._.pick(rawDataMessage, [
      'attachments',
      'preview',
      'reaction',
      'body',
      'flags',
      'profileKey',
      'openGroupInvitation',
      'quote',
      'profile',
      'blocksCommunityMessageRequests',
    ]),
    isRegularMessage: true,
  };
}

async function toggleMsgRequestBannerIfNeeded(
  conversation: ConversationModel,
  message: MessageModel,
  source: string
) {
  if (!conversation.isPrivate() || !message.isIncoming()) {
    return;
  }

  const incomingMessageCount = await Data.getMessageCountByType(
    conversation.id,
    MessageDirection.incoming
  );
  const isFirstRequestMessage = incomingMessageCount < 2;
  if (
    conversation.isIncomingRequest() &&
    isFirstRequestMessage &&
    getHideMessageRequestBannerOutsideRedux()
  ) {
    showMessageRequestBannerOutsideRedux();
  }

  // For edge case when messaging a client that's unable to explicitly send request approvals
  if (conversation.isOutgoingRequest()) {
    // Conversation was not approved before so a sync is needed
    await conversation.addIncomingApprovalMessage(toNumber(message.get('sent_at')) - 1, source);
  }
  // should only occur after isOutgoing request as it relies on didApproveMe being false.
  await conversation.setDidApproveMe(true);
}

async function handleMessageFromPendingMember(
  conversation: ConversationModel,
  message: MessageModel,
  source: string
) {
  const convoId = conversation.id;
  if (
    !conversation.isClosedGroupV2() ||
    !message.isIncoming() ||
    !conversation.weAreAdminUnblinded() || // this checks on libsession of that group if we are an admin
    !conversation.getGroupMembers().includes(source) || // this check that the sender of that message is indeed a member of the group
    !PubKey.is03Pubkey(convoId) ||
    !PubKey.is05Pubkey(source)
  ) {
    return;
  }

  const isMemberInviteSent = selectMemberInviteSentOutsideRedux(source, convoId);
  if (!isMemberInviteSent) {
    return; // nothing else to do
  }
  // we are an admin and we received a message from a member whose invite is `pending`. Update that member state now and push a change.
  await GroupV2Receiver.handleGroupUpdateInviteResponseMessage({
    groupPk: convoId,
    author: source,
    change: { isApproved: true },
    messageHash: null,
  });
}

async function handleRegularMessage(
  conversation: ConversationModel,
  sendingDeviceConversation: ConversationModel,
  message: MessageModel,
  rawDataMessage: RegularMessageType,
  source: string,
  messageHash: string
): Promise<void> {
  // this does not trigger a UI update nor write to the db
  await copyFromQuotedMessage(message, rawDataMessage.quote);

  if (rawDataMessage.openGroupInvitation) {
    message.set({ groupInvitation: rawDataMessage.openGroupInvitation });
  }

  handleLinkPreviews(rawDataMessage.body, rawDataMessage.preview, message);

  // TODO: Once pro proof validation is available make this dynamic
  // const maxChars = isSenderPro
  //   ? Constants.CONVERSATION.MAX_MESSAGE_CHAR_COUNT_PRO
  //   : Constants.CONVERSATION.MAX_MESSAGE_CHAR_COUNT_STANDARD;
  // NOTE: The truncation value must be the Pro count so when Pro is released older clients wont truncate pro messages.
  const maxChars = Constants.CONVERSATION.MAX_MESSAGE_CHAR_COUNT_PRO;

  const body =
    rawDataMessage.body.length > maxChars
      ? rawDataMessage.body.slice(0, maxChars)
      : rawDataMessage.body;

  message.set({
    // quote: rawDataMessage.quote, // do not do this copy here, it must be done only in copyFromQuotedMessage()
    attachments: rawDataMessage.attachments?.map(m => ({
      ...m,
      pending: true,
    })),
    body,
    conversationId: conversation.id,
    messageHash,
    errors: undefined,
  });

  const serverTimestamp = message.get('serverTimestamp');
  if (
    conversation.isPublic() &&
    PubKey.isBlinded(sendingDeviceConversation.id) &&
    isNumber(serverTimestamp)
  ) {
    const updateBlockTimestamp = !rawDataMessage.blocksCommunityMessageRequests
      ? 0
      : serverTimestamp;
    await sendingDeviceConversation.updateBlocksSogsMsgReqsTimestamp(updateBlockTimestamp, false);
  }

  await toggleMsgRequestBannerIfNeeded(conversation, message, source);
  await handleMessageFromPendingMember(conversation, message, source);

  const conversationActiveAt = conversation.getActiveAt();
  if (
    !conversationActiveAt ||
    conversation.isHidden() ||
    (message.get('sent_at') || 0) > conversationActiveAt
  ) {
    const interactionNotification = message.getInteractionNotification();
    conversation.setActiveAt(message.get('sent_at'));
    conversation.setLastMessage(message.getNotificationText());
    conversation.setLastMessageInteraction(
      interactionNotification
        ? {
            type: interactionNotification.interactionType,
            status: interactionNotification.interactionStatus,
          }
        : null
    );

    // a new message was received for that conversation. If it was not it should not be hidden anymore
    await conversation.unhideIfNeeded(false);
  }

  // we just received a message from that user so we reset the typing indicator for this convo
  await conversation.notifyTypingNoCommit({
    isTyping: false,
    sender: source,
  });
}

async function markConvoAsReadIfOutgoingMessage(
  conversation: ConversationModel,
  message: MessageModel
) {
  const isOutgoingMessage =
    message.get('type') === 'outgoing' || message.get('direction') === 'outgoing';
  if (isOutgoingMessage) {
    const sentAt = message.get('serverTimestamp') || message.get('sent_at');
    if (sentAt) {
      const expirationType = message.getExpirationType();
      const expireTimer = message.getExpireTimerSeconds();
      // NOTE starting disappearing messages timer for all outbound messages
      if (
        expirationType &&
        expireTimer > 0 &&
        Boolean(message.getExpirationStartTimestamp()) === false
      ) {
        const expirationMode = DisappearingMessages.changeToDisappearingConversationMode(
          conversation,
          expirationType,
          expireTimer
        );

        if (expirationMode !== 'off') {
          message.setMessageExpirationStartTimestamp(
            DisappearingMessages.setExpirationStartTimestamp(
              expirationMode,
              message.get('sent_at'),
              'markConvoAsReadIfOutgoingMessage',
              message.id
            )
          );
          await message.commit();
        }
      }
      conversation.markConversationRead({
        newestUnreadDate: sentAt,
        fromConfigMessage: false,
      });
    }
  }
}

export async function handleMessageJob(
  messageModel: MessageModel,
  conversation: ConversationModel,
  regularDataMessage: RegularMessageType,
  confirm: () => void,
  source: string,
  messageHash: string
) {
  window?.log?.info(
    `Starting handleMessageJob for message ${messageModel.idForLogging()}, ${
      messageModel.get('serverTimestamp') || messageModel.get('timestamp')
    } in conversation ${conversation.idForLogging()}, messageHash:${messageHash}`
  );

  const sendingDeviceConversation = await ConvoHub.use().getOrCreateAndWait(
    source,
    ConversationTypeEnum.PRIVATE
  );

  try {
    // NOTE we handle incoming disappear after send messages and sync messages here
    if (
      conversation &&
      messageModel.getExpireTimerSeconds() > 0 &&
      !messageModel.getExpirationStartTimestamp()
    ) {
      const expirationMode = DisappearingMessages.changeToDisappearingConversationMode(
        conversation,
        messageModel.getExpirationType(),
        messageModel.getExpireTimerSeconds()
      );
      const expireTimer = messageModel.getExpireTimerSeconds();

      if (expirationMode === 'deleteAfterSend' && expireTimer > 0) {
        const expirationStartTimestamp = DisappearingMessages.setExpirationStartTimestamp(
          expirationMode,
          messageModel.get('sent_at'),
          'handleMessageJob',
          messageModel.id
        );
        if (expirationStartTimestamp) {
          messageModel.setMessageExpirationStartTimestamp(expirationStartTimestamp);
          messageModel.setExpiresAt(expirationStartTimestamp + expireTimer * 1000);
        }
      }
    }

    if (messageModel.isExpirationTimerUpdate()) {
      // NOTE if we turn off disappearing messages from a legacy client expirationTimerUpdate can be undefined but the flags value is correctly set
      const expirationTimerUpdate = messageModel.getExpirationTimerUpdate();
      if (!expirationTimerUpdate || isEmpty(expirationTimerUpdate)) {
        window.log.debug(
          `[handleMessageJob] The ExpirationTimerUpdate is not defined correctly message: ${messageModel.get(
            'id'
          )}\nexpirationTimerUpdate: ${JSON.stringify(expirationTimerUpdate)}`
        );
        confirm?.();
        return;
      }

      const expireTimerUpdate = expirationTimerUpdate?.expireTimer || 0;
      const expirationModeUpdate = DisappearingMessages.changeToDisappearingConversationMode(
        conversation,
        expirationTimerUpdate?.expirationType,
        expireTimerUpdate
      );

      await conversation.updateExpireTimer({
        providedDisappearingMode: expirationModeUpdate,
        providedExpireTimer: expireTimerUpdate,
        providedSource: source,
        fromSync: source === UserUtils.getOurPubKeyStrFromCache(),
        sentAt: messageModel.get('received_at'),
        existingMessage: messageModel,
        shouldCommitConvo: false,
        fromCurrentDevice: false,
        fromConfigMessage: false,
        messageHash,
        // NOTE we don't commit yet because we want to get the message id, see below
      });
    } else {
      // this does not commit to db nor UI unless we need to approve a convo
      await handleRegularMessage(
        conversation,
        sendingDeviceConversation,
        messageModel,
        regularDataMessage,
        source,
        messageHash
      );
    }

    // save the message model to the db and then save the messageId generated to our in-memory copy
    const id = await messageModel.commit();
    messageModel.setId(id);

    // Note that this can save the message again, if jobs were queued. We need to
    //   call it after we have an id for this message, because the jobs refer back
    //   to their source message.

    conversation.setActiveAt(
      Math.max(conversation.getActiveAt() || 0, messageModel.get('sent_at') || 0)
    );
    // this is a throttled call and will only run once every 1 sec at most
    conversation.updateLastMessage();
    await conversation.commit();

    if (conversation.id !== sendingDeviceConversation.id) {
      await sendingDeviceConversation.commit();
    }

    void queueAttachmentDownloads(messageModel, conversation);
    // Check if we need to update any profile names
    // the only profile we don't update with what is coming here is ours,
    // as our profile is shared across our devices with libsession
    if (messageModel.isIncoming() && regularDataMessage.profile) {
      await ProfileManager.updateProfileOfContact({
        pubkey: sendingDeviceConversation.id,
        displayName: regularDataMessage.profile.displayName,
        profileUrl: regularDataMessage.profile.profilePicture,
        profileKey: regularDataMessage.profileKey,
        profileUpdatedAtSeconds: new Timestamp({
          value: regularDataMessage.profile.lastProfileUpdateSeconds ?? 0,
        }).seconds(),
      });
    }

    await markConvoAsReadIfOutgoingMessage(conversation, messageModel);
    if (messageModel.get('unread')) {
      conversation.throttledNotify(messageModel);
    }
    confirm?.();
  } catch (error) {
    const errorForLog = error && error.stack ? error.stack : error;
    window?.log?.error('handleMessageJob', messageModel.idForLogging(), 'error:', errorForLog);
  }
}
