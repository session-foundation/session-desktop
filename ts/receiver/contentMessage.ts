import { compact, flatten, isEmpty, isFinite } from 'lodash';

import { handleSwarmDataMessage } from './dataMessage';
import { type BaseDecodedEnvelope, type SwarmDecodedEnvelope } from './types';

import { SignalService } from '../protobuf';
import { PubKey } from '../session/types';

import { Data } from '../data/data';
import { SettingsKey } from '../data/settings-key';
import {
  deleteMessagesFromSwarmAndCompletelyLocally,
  deleteMessagesFromSwarmAndMarkAsDeletedLocally,
} from '../interactions/conversations/unsendingInteractions';
import { findCachedBlindedMatchOrLookupOnAllServers } from '../session/apis/open_group_api/sogsv3/knownBlindedkeys';
import { ConvoHub } from '../session/conversations';
import { getSodiumRenderer } from '../session/crypto';
import { DisappearingMessages } from '../session/disappearing_messages';
import { ReadyToDisappearMsgUpdate } from '../session/disappearing_messages/types';
import { ProfileManager } from '../session/profile_manager/ProfileManager';
import { UserUtils } from '../session/utils';
import { perfEnd, perfStart } from '../session/utils/Performance';
import { ed25519Str } from '../session/utils/String';
import { isUsFromCache } from '../session/utils/User';
import { BlockedNumberController } from '../util';
import { ReadReceipts } from '../util/readReceipts';
import { Storage } from '../util/storage';
import {
  ContactsWrapperActions,
  MetaGroupWrapperActions,
} from '../webworker/workers/browser/libsession_worker_interface';
import { handleCallMessage } from './callMessage';
import { sentAtMoreRecentThanWrapper } from './sentAtMoreRecent';
import { CONVERSATION_PRIORITIES, ConversationTypeEnum } from '../models/types';
import { shouldProcessContentMessage } from './common';
import { longOrNumberToNumber } from '../types/long/longOrNumberToNumber';
import { buildPrivateProfileChangeFromMsgRequestResponse } from '../models/profile';

async function shouldDropIncomingPrivateMessage(
  envelope: BaseDecodedEnvelope,
  content: SignalService.Content
) {
  const isUs = UserUtils.isUsFromCache(envelope.source);
  // sentAtMoreRecentThanWrapper is going to be true, if the latest contact wrapper we processed was roughly more recent that this message timestamp
  const moreRecentOrNah = await sentAtMoreRecentThanWrapper(
    envelope.sentAtMs,
    isUs ? 'UserConfig' : 'ContactsConfig'
  );
  const isSyncedMessage = isUsFromCache(envelope.source);

  if (moreRecentOrNah === 'wrapper_more_recent') {
    // we need to check if that conversation is already in the wrapper
    try {
      // let's check if the corresponding conversation is hidden in the contacts wrapper or not.
      // the corresponding conversation is syncTarget when this is a synced message only, so we need to rely on it first, then the envelope.source.
      const syncTargetOrSource = isSyncedMessage
        ? content.dataMessage?.syncTarget || undefined
        : envelope.source;

      // handle the `us` case first, as we will never find ourselves in the contacts wrapper. The NTS details are in the UserProfile wrapper.
      if (isUs) {
        const us = ConvoHub.use().get(envelope.source);
        const ourPriority = us?.getPriority() || CONVERSATION_PRIORITIES.default;
        if (us && ourPriority <= CONVERSATION_PRIORITIES.hidden) {
          // if the wrapper data is more recent than this message and the NTS conversation is hidden, just drop this incoming message to avoid showing the NTS conversation again.
          window.log.info(
            `shouldDropIncomingPrivateMessage: received message in NTS which appears to be hidden in our most recent libsession user config, sentAt: ${envelope.sentAtMs}. Dropping it`
          );
          return true;
        }
        window.log.info(
          `shouldDropIncomingPrivateMessage: received message on conversation ${syncTargetOrSource} which appears to NOT be hidden/removed in our most recent libsession user config, sentAt: ${envelope.sentAtMs}. `
        );
        return false;
      }

      if (!syncTargetOrSource) {
        return false;
      }

      if (syncTargetOrSource.startsWith('05')) {
        const privateConvoInWrapper = await ContactsWrapperActions.get(syncTargetOrSource);
        if (
          !privateConvoInWrapper ||
          privateConvoInWrapper.priority <= CONVERSATION_PRIORITIES.hidden
        ) {
          // the wrapper is more recent that this message and there is no such private conversation. Just drop this incoming message.
          window.log.info(
            `shouldDropIncomingPrivateMessage: received message on conversation ${syncTargetOrSource} which appears to be hidden/removed in our most recent libsession contact config, sentAt: ${envelope.sentAtMs}. Dropping it`
          );
          return true;
        }

        window.log.info(
          `shouldDropIncomingPrivateMessage: received message on conversation ${syncTargetOrSource} which appears to NOT be hidden/removed in our most recent libsession contact config, sentAt: ${envelope.sentAtMs}. `
        );
      } else {
        window.log.info(
          `shouldDropIncomingPrivateMessage: received message on conversation ${syncTargetOrSource} but neither NTS not 05. Probably nothing to do but let it through. `
        );
      }
    } catch (e) {
      window.log.warn('shouldDropIncomingPrivateMessage: failed with', e.message);
    }
  }
  return false;
}

function shouldDropBlockedUserMessage(
  content: SignalService.Content,
  fromSwarmOf: string
): boolean {
  // Even if the user is blocked, we should allow a group control message message if:
  //   - it is a group message AND
  //   - the group exists already on the db (to not join a closed group created by a blocked user) AND
  //   - the group is not blocked AND
  //   - the message is a LegacyControlMessage or GroupUpdateMessage
  // In addition to the above, we also want to allow a groupUpdatePromote message (sent as a 1o1 message)

  if (!fromSwarmOf) {
    return true;
  }

  const convo = ConvoHub.use().get(fromSwarmOf);
  if (!convo || !content.dataMessage || isEmpty(content.dataMessage)) {
    // returning true means that we drop that message
    return true;
  }

  if (convo.isClosedGroup() && convo.isBlocked()) {
    // when we especially blocked a group, we don't want to process anything from it
    return true;
  }

  const data = content.dataMessage as SignalService.DataMessage; // forcing it as we do know this field is set based on last line

  if (convo.isPrivate()) {
    const isGroupV2PromoteMessage = !isEmpty(
      content.dataMessage?.groupUpdateMessage?.promoteMessage
    );
    if (isGroupV2PromoteMessage) {
      // we want to allow a group v2 promote message sent by a blocked user (because that user is an admin of a group)
      return false;
    }
  }

  if (!convo.isClosedGroup()) {
    // 1o1 messages are handled above.
    // if we get here and it's not part a closed group, we should drop that message.
    // it might be a message sent to a community from a user we've blocked
    return true;
  }

  const isGroupV2UpdateMessage = !isEmpty(data.groupUpdateMessage);

  return !isGroupV2UpdateMessage;
}

async function dropIncomingGroupMessage(envelope: BaseDecodedEnvelope) {
  try {
    if (PubKey.is03Pubkey(envelope.source)) {
      const infos = await MetaGroupWrapperActions.infoGet(envelope.source);

      if (!infos) {
        return false;
      }

      if (
        envelope.sentAtMs &&
        ((infos.deleteAttachBeforeSeconds &&
          envelope.sentAtMs <= infos.deleteAttachBeforeSeconds * 1000) ||
          (infos.deleteBeforeSeconds && envelope.sentAtMs <= infos.deleteBeforeSeconds * 1000))
      ) {
        window?.log?.info(
          `Incoming message sent before the group ${ed25519Str(envelope.source)} deleteBeforeSeconds or deleteAttachBeforeSeconds. Dropping it.`
        );
        return true;
      }
    }
  } catch (e) {
    window?.log?.warn(
      `dropIncomingGroupMessage failed for group ${ed25519Str(envelope.source)} with `,
      e.message
    );
  }
  return false;
}

export async function innerHandleSwarmContentMessage({
  decodedEnvelope,
}: {
  decodedEnvelope: BaseDecodedEnvelope;
}): Promise<void> {
  try {
    window.log.info('innerHandleSwarmContentMessage');

    const content = SignalService.Content.decode(new Uint8Array(decodedEnvelope.contentDecrypted));
    // This function gets called with an inbox content from a community. When that's the case,
    // the messageHash is empty.
    // `shouldProcessContentMessage` is a lot less strict in terms of timestamps for community messages, and needs to be.
    // Not having this isCommunity flag set to true would make any incoming message from a blinded message request be dropped.
    if (
      !shouldProcessContentMessage({
        sentAtMs: decodedEnvelope.sentAtMs,
        sigTimestampMs: longOrNumberToNumber(content.sigTimestamp),
        isCommunity: !decodedEnvelope.messageHash,
      })
    ) {
      window.log.info(
        `innerHandleSwarmContentMessage: dropping invalid content message sentAtMs: ${decodedEnvelope.sentAtMs}`
      );
      return;
    }

    /**
     * senderIdentity is set ONLY if that message is a closed group message.
     * If the current message is a closed group message,
     * envelope.source is going to be the real sender of that message.
     *
     * When receiving a message from a user which we blocked, we need to make let
     * a control message through (if the associated closed group is not blocked)
     */

    const blocked = BlockedNumberController.isBlocked(decodedEnvelope.getAuthor());
    if (blocked) {
      const envelopeSource = decodedEnvelope.source;
      // We want to allow a blocked user message if that's a control message for a known group and the group is not blocked
      if (shouldDropBlockedUserMessage(content, envelopeSource)) {
        window?.log?.info(
          `Dropping blocked user message ${ed25519Str(decodedEnvelope.getAuthor())}`
        );
        return;
      }
      window?.log?.info(
        `Allowing control/update message only from blocked user ${ed25519Str(decodedEnvelope.senderIdentity)} in group: ${ed25519Str(decodedEnvelope.source)}`
      );
    }

    if (await dropIncomingGroupMessage(decodedEnvelope)) {
      // message removed from cache in `dropIncomingGroupMessage` already
      return;
    }

    // if this is a direct message, envelope.senderIdentity is undefined
    // if this is a closed group message, envelope.senderIdentity is the sender's pubkey and envelope.source is the closed group's pubkey
    const isPrivateConversationMessage = !decodedEnvelope.senderIdentity;

    if (isPrivateConversationMessage) {
      if (await shouldDropIncomingPrivateMessage(decodedEnvelope, content)) {
        return;
      }
    }

    /**
     * For a closed group message, this holds the conversation with that specific user outside of the closed group.
     * For a private conversation message, this is just the conversation with that user
     */
    const senderConversationModel = await ConvoHub.use().getOrCreateAndWait(
      isPrivateConversationMessage ? decodedEnvelope.source : decodedEnvelope.senderIdentity,
      ConversationTypeEnum.PRIVATE
    );

    // We need to make sure that we trigger the outdated client banner ui on the correct model for the conversation and not the author (for closed groups)
    let conversationModelForUIUpdate = senderConversationModel;

    // For a private synced message, we need to make sure we have the conversation with the syncTarget
    if (isPrivateConversationMessage && content.dataMessage?.syncTarget) {
      conversationModelForUIUpdate = await ConvoHub.use().getOrCreateAndWait(
        content.dataMessage.syncTarget,
        ConversationTypeEnum.PRIVATE
      );
    }

    /**
     * For a closed group message, this holds the closed group's conversation.
     * For a private conversation message, this is just the conversation with that user
     */
    if (!isPrivateConversationMessage) {
      // this is a group message,
      // we have a second conversation to make sure exists: the group conversation
      conversationModelForUIUpdate = PubKey.is03Pubkey(decodedEnvelope.source)
        ? await ConvoHub.use().getOrCreateAndWait(
            decodedEnvelope.source,
            ConversationTypeEnum.GROUPV2
          )
        : await ConvoHub.use().getOrCreateAndWait(
            decodedEnvelope.source,
            ConversationTypeEnum.GROUP
          );
    }

    const expireUpdate = await DisappearingMessages.checkForExpireUpdateInContentMessage(
      content,
      conversationModelForUIUpdate,
      decodedEnvelope.messageExpirationFromRetrieve
    );
    if (content.dataMessage) {
      // because typescript is funky with incoming protobufs
      if (isEmpty(content.dataMessage.profileKey)) {
        content.dataMessage.profileKey = null;
      }

      await handleSwarmDataMessage({
        decodedEnvelope,
        rawDataMessage: content.dataMessage as SignalService.DataMessage,
        senderConversationModel,
        expireUpdate: expireUpdate || null,
      });

      return;
    }

    if (content.receiptMessage) {
      perfStart(`handleReceiptMessage-${decodedEnvelope.id}`);

      await handleReceiptMessage(decodedEnvelope, content.receiptMessage);
      perfEnd(`handleReceiptMessage-${decodedEnvelope.id}`, 'handleReceiptMessage');
      return;
    }
    if (content.typingMessage) {
      perfStart(`handleTypingMessage-${decodedEnvelope.id}`);

      await handleTypingMessage(
        decodedEnvelope,
        content.typingMessage as SignalService.TypingMessage
      );
      perfEnd(`handleTypingMessage-${decodedEnvelope.id}`, 'handleTypingMessage');
      return;
    }

    if (content.dataExtractionNotification) {
      perfStart(`handleDataExtractionNotification-${decodedEnvelope.id}`);

      await handleDataExtractionNotification({
        decodedEnvelope,
        dataExtractionNotification:
          content.dataExtractionNotification as SignalService.DataExtractionNotification,
        expireUpdate,
      });
      perfEnd(
        `handleDataExtractionNotification-${decodedEnvelope.id}`,
        'handleDataExtractionNotification'
      );
      return;
    }
    if (content.unsendRequest) {
      await handleUnsendMessage(
        decodedEnvelope,
        content.unsendRequest as SignalService.UnsendRequest
      );
      return;
    }
    if (content.callMessage) {
      await handleCallMessage(decodedEnvelope, content.callMessage as SignalService.CallMessage, {
        expireDetails: expireUpdate,
        messageHash: decodedEnvelope.messageHash,
      });
      return;
    }
    if (content.messageRequestResponse) {
      await handleMessageRequestResponse(
        decodedEnvelope,
        content.messageRequestResponse as SignalService.MessageRequestResponse
      );
      return;
    }

    // If we get here, we don't know how to handle that envelope. probably a very old type of message, or something we don't support.
    // There is not much we can do expect drop it
    window?.log?.warn('Incoming message not supported. Dropping it.');
  } catch (e) {
    window?.log?.warn(e.message);
  }
}

async function onReadReceipt(readAt: number, timestamp: number, source: string) {
  window?.log?.info('read receipt', source, timestamp);

  if (!Storage.get(SettingsKey.settingsReadReceipt)) {
    return;
  }

  // Calling this directly so we can wait for completion
  await ReadReceipts.onReadReceipt({
    source,
    timestamp,
    readAt,
  });
}

async function handleReceiptMessage(
  envelope: SwarmDecodedEnvelope,
  receiptMessage: SignalService.IReceiptMessage
) {
  const receipt = receiptMessage as SignalService.ReceiptMessage;

  const { type, timestamp } = receipt;

  const results = [];
  if (type === SignalService.ReceiptMessage.Type.READ) {
    // eslint-disable-next-line no-restricted-syntax
    for (const ts of timestamp) {
      const promise = onReadReceipt(envelope.sentAtMs, longOrNumberToNumber(ts), envelope.source);
      results.push(promise);
    }
  }
  await Promise.all(results);
}

async function handleTypingMessage(
  envelope: SwarmDecodedEnvelope,
  typingMessage: SignalService.TypingMessage
): Promise<void> {
  const { timestamp, action } = typingMessage;
  const { source } = envelope;

  // We don't do anything with incoming typing messages if the setting is disabled
  if (!Storage.get(SettingsKey.settingsTypingIndicator)) {
    return;
  }

  if (envelope.sentAtMs && timestamp) {
    const typingTimestamp = longOrNumberToNumber(timestamp);

    if (typingTimestamp !== envelope.sentAtMs) {
      window?.log?.warn(
        `Typing message envelope timestamp (${envelope.sentAtMs}) did not match typing timestamp (${typingTimestamp})`
      );
      return;
    }
  }

  // typing message are only working with direct chats/ not groups
  const conversation = ConvoHub.use().get(source);

  const started = action === SignalService.TypingMessage.Action.STARTED;

  if (conversation) {
    // this does not commit, instead the caller should commit to trigger UI updates
    await conversation.notifyTypingNoCommit({
      isTyping: started,
      sender: source,
    });
    await conversation.commit();
  }
}

/**
 * delete message from user swarm and delete locally upon receiving unsend request
 * @param unsendMessage data required to delete message
 */
async function handleUnsendMessage(
  envelope: SwarmDecodedEnvelope,
  unsendMessage: SignalService.UnsendRequest
) {
  const { author: messageAuthor, timestamp } = unsendMessage;
  window.log.info(`handleUnsendMessage from ${messageAuthor}: of timestamp: ${timestamp}`);
  if (messageAuthor !== envelope.getAuthor()) {
    window?.log?.error(
      'handleUnsendMessage: Dropping request as the author and the sender differs.'
    );

    return;
  }
  if (!unsendMessage) {
    window?.log?.error('handleUnsendMessage: Invalid parameters -- dropping message.');

    return;
  }
  if (!timestamp) {
    window?.log?.error('handleUnsendMessage: Invalid timestamp -- dropping message');

    return;
  }
  const messageToDelete = (
    await Data.getMessagesBySenderAndSentAt([
      {
        source: messageAuthor,
        timestamp: longOrNumberToNumber(timestamp),
      },
    ])
  )?.[0];
  const messageHash = messageToDelete?.get('messageHash');

  if (messageHash && messageToDelete) {
    window.log.info('handleUnsendMessage: got a request to delete ', messageHash);
    const conversation = ConvoHub.use().get(messageToDelete.get('conversationId'));
    if (!conversation) {
      return;
    }
    if (messageToDelete.getSource() === UserUtils.getOurPubKeyStrFromCache()) {
      // a message we sent is completely removed when we get a unsend request for it
      void deleteMessagesFromSwarmAndCompletelyLocally(conversation, [messageToDelete]);
    } else {
      void deleteMessagesFromSwarmAndMarkAsDeletedLocally(conversation, [messageToDelete]);
    }
  } else {
    window.log.info(
      'handleUnsendMessage: got a request to delete an unknown messageHash:',
      messageHash,
      ' and found messageToDelete:',
      messageToDelete?.id
    );
  }
}

/**
 * Sets approval fields for conversation depending on response's values. If request is approving, pushes notification and
 */
async function handleMessageRequestResponse(
  envelope: SwarmDecodedEnvelope,
  messageRequestResponse: SignalService.MessageRequestResponse
) {
  // no one cares about the is `messageRequestResponse.isApproved` field currently.
  if (!messageRequestResponse || !messageRequestResponse.isApproved) {
    window?.log?.error('handleMessageRequestResponse: Invalid parameters -- dropping message.');
    return;
  }

  const sodium = await getSodiumRenderer();

  const convosToMerge = findCachedBlindedMatchOrLookupOnAllServers(envelope.source, sodium);
  const unblindedConvoId = envelope.source;
  window?.log?.debug(
    `handleMessageRequestResponse: src:${ed25519Str(envelope.source)}, unblindedConvo: ${ed25519Str(unblindedConvoId)}`
  );

  if (!PubKey.is05Pubkey(unblindedConvoId)) {
    window?.log?.warn(
      'handleMessageRequestResponse: Invalid unblindedConvoId -- dropping message.'
    );
    return;
  }

  const conversationToApprove = await ConvoHub.use().getOrCreateAndWait(
    unblindedConvoId,
    ConversationTypeEnum.PRIVATE
  );
  let mostRecentActiveAt = Math.max(...compact(convosToMerge.map(m => m.getActiveAt())));
  if (!isFinite(mostRecentActiveAt) || mostRecentActiveAt <= 0) {
    mostRecentActiveAt = envelope.sentAtMs;
  }

  const previousApprovedMe = conversationToApprove.didApproveMe();
  await conversationToApprove.setDidApproveMe(true, false);

  conversationToApprove.setActiveAt(mostRecentActiveAt);
  await conversationToApprove.unhideIfNeeded(false);
  await conversationToApprove.commit();

  // grab the profile details from the msg request response
  const profile = buildPrivateProfileChangeFromMsgRequestResponse({
    convo: conversationToApprove,
    messageRequestResponse,
    decodedEnvelope: envelope,
  });

  if (profile) {
    await ProfileManager.updateProfileOfContact(profile);
  }

  if (convosToMerge.length) {
    await conversationToApprove.setIsApproved(convosToMerge[0].isApproved(), false);
    // nickname might be set already in conversationToApprove, so don't overwrite it

    // we have to merge all of those to a single conversation under the unblinded. including the messages
    window.log.info(
      `We just found out ${unblindedConvoId} matches some blinded conversations. Merging them together:`,
      convosToMerge.map(m => m.id)
    );
    // get all the messages from each conversations we have to merge
    const allMessagesCollections = await Promise.all(
      convosToMerge.map(async convoToMerge =>
        // this call will fetch like 60 messages for each conversation. I don't think we want to merge an unknown number of messages
        // so lets stick to this behavior
        Data.getMessagesByConversation(convoToMerge.id, {
          skipTimerInit: undefined,
          messageId: null,
        })
      )
    );

    const allMessageModels = flatten(allMessagesCollections.map(m => m.messages));
    allMessageModels.forEach(messageModel => {
      messageModel.setConversationId(unblindedConvoId);

      if (messageModel.get('source') !== UserUtils.getOurPubKeyStrFromCache()) {
        messageModel.setSource(unblindedConvoId);
      }
    });
    // this is based on the messageId as  primary key. So this should overwrite existing messages with new merged data
    await Data.saveMessages(allMessageModels.map(m => m.cloneAttributes()));

    for (let index = 0; index < convosToMerge.length; index++) {
      const element = convosToMerge[index];
      // eslint-disable-next-line no-await-in-loop
      await ConvoHub.use().deleteBlindedContact(element.id);
    }
  }
  if (previousApprovedMe) {
    await conversationToApprove.commit();

    window.log.info(
      `convo ${ed25519Str(conversationToApprove.id)} previousApprovedMe is already true. Nothing to do `
    );
    return;
  }

  // Conversation was not approved before so a sync is needed
  await conversationToApprove.addIncomingApprovalMessage(envelope.sentAtMs, unblindedConvoId);
}

/**
 * A DataExtractionNotification message can only come from a 1o1 conversation.
 *
 * We drop them if the convo is not a 1o1 conversation.
 */

export async function handleDataExtractionNotification({
  decodedEnvelope,
  expireUpdate,
  dataExtractionNotification,
}: {
  decodedEnvelope: SwarmDecodedEnvelope;
  dataExtractionNotification: SignalService.DataExtractionNotification;
  expireUpdate: ReadyToDisappearMsgUpdate | undefined;
}): Promise<void> {
  // Note: we currently don't care about the timestamp included in the field itself, just the timestamp of the envelope

  const { source, sentAtMs } = decodedEnvelope;

  const convo = ConvoHub.use().get(source);
  if (!convo || !convo.isPrivate()) {
    window?.log?.info('Got DataNotification for unknown or non-private convo');

    return;
  }

  if (!source || !sentAtMs) {
    window?.log?.info('DataNotification pre check failed');

    return;
  }

  let created = await convo.addSingleIncomingMessage({
    source,
    messageHash: decodedEnvelope.messageHash,
    sent_at: sentAtMs,
    dataExtractionNotification: {
      type: dataExtractionNotification.type,
    },
  });

  created = DisappearingMessages.getMessageReadyToDisappear(
    convo,
    created,
    0,
    expireUpdate || undefined
  );
  await created.commit();
  await convo.commit();
  convo.updateLastMessage();
}
