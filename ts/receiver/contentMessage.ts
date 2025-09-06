import { compact, flatten, isEmpty, isFinite, toNumber } from 'lodash';

import { handleSwarmDataMessage } from './dataMessage';
import { EnvelopePlus } from './types';

import { SignalService } from '../protobuf';
import { KeyPrefixType, PubKey } from '../session/types';
import { IncomingMessageCache } from './cache';

import { Data } from '../data/data';
import { SettingsKey } from '../data/settings-key';
import {
  deleteMessagesFromSwarmAndCompletelyLocally,
  deleteMessagesFromSwarmAndMarkAsDeletedLocally,
} from '../interactions/conversations/unsendingInteractions';
import { findCachedBlindedMatchOrLookupOnAllServers } from '../session/apis/open_group_api/sogsv3/knownBlindedkeys';
import { ConvoHub } from '../session/conversations';
import { concatUInt8Array, getSodiumRenderer } from '../session/crypto';
import { removeMessagePadding } from '../session/crypto/BufferPadding';
import { DisappearingMessages } from '../session/disappearing_messages';
import { ReadyToDisappearMsgUpdate } from '../session/disappearing_messages/types';
import { ProfileManager } from '../session/profile_manager/ProfileManager';
import { UserUtils } from '../session/utils';
import { perfEnd, perfStart } from '../session/utils/Performance';
import { ed25519Str, fromHexToArray, toHex } from '../session/utils/String';
import { isUsFromCache } from '../session/utils/User';
import { assertUnreachable } from '../types/sqlSharedTypes';
import { BlockedNumberController } from '../util';
import { ReadReceipts } from '../util/readReceipts';
import { Storage } from '../util/storage';
import {
  ContactsWrapperActions,
  MetaGroupWrapperActions,
} from '../webworker/workers/browser/libsession_worker_interface';
import { handleCallMessage } from './callMessage';
import { sentAtMoreRecentThanWrapper } from './sentAtMoreRecent';
import { ECKeyPair } from './keypairs';
import { CONVERSATION_PRIORITIES, ConversationTypeEnum } from '../models/types';
import { shouldProcessContentMessage } from './common';

export async function handleSwarmContentMessage(
  envelope: EnvelopePlus,
  messageHash: string,
  messageExpirationFromRetrieve: number | null
) {
  try {
    const decryptedForAll = await decrypt(envelope);

    if (!decryptedForAll || !decryptedForAll.decryptedContent || isEmpty(decryptedForAll)) {
      return;
    }

    const sentAtTimestamp = toNumber(envelope.timestamp);

    // swarm messages already comes with a timestamp in milliseconds, so this sentAtTimestamp is correct.
    // the sogs messages do not come as milliseconds but just seconds, so we override it
    await innerHandleSwarmContentMessage({
      envelope,
      sentAtTimestamp,
      contentDecrypted: decryptedForAll.decryptedContent,
      messageHash,
      messageExpirationFromRetrieve,
    });
  } catch (e) {
    window?.log?.warn(e.message);
  }
}

/**
 * This function can be called to decrypt a keypair wrapper for a closed group update
 * or a message sent to a closed group.
 *
 * We do not unpad the result here, as in the case of the keypair wrapper, there is not padding.
 * Instead, it is the caller who needs to removeMessagePadding() the content.
 */
export async function decryptWithSessionProtocol(
  envelope: EnvelopePlus,
  ciphertextObj: ArrayBuffer,
  x25519KeyPair: ECKeyPair,
  isClosedGroup?: boolean
): Promise<{ decryptedContent: ArrayBuffer }> {
  perfStart(`decryptWithSessionProtocol-${envelope.id}`);
  const recipientX25519PrivateKey = x25519KeyPair.privateKeyData;
  const hex = toHex(new Uint8Array(x25519KeyPair.publicKeyData));

  const recipientX25519PublicKey = PubKey.removePrefixIfNeeded(hex);

  const sodium = await getSodiumRenderer();
  const signatureSize = sodium.crypto_sign_BYTES;
  const ed25519PublicKeySize = sodium.crypto_sign_PUBLICKEYBYTES;

  // 1. ) Decrypt the message
  const plaintextWithMetadata = sodium.crypto_box_seal_open(
    new Uint8Array(ciphertextObj),
    fromHexToArray(recipientX25519PublicKey),
    new Uint8Array(recipientX25519PrivateKey)
  );
  if (plaintextWithMetadata.byteLength <= signatureSize + ed25519PublicKeySize) {
    perfEnd(`decryptWithSessionProtocol-${envelope.id}`, 'decryptWithSessionProtocol');

    throw new Error('Decryption failed.'); // throw Error.decryptionFailed;
  }

  // 2. ) Get the message parts
  const signatureStart = plaintextWithMetadata.byteLength - signatureSize;
  const signature = plaintextWithMetadata.subarray(signatureStart);
  const pubkeyStart = plaintextWithMetadata.byteLength - (signatureSize + ed25519PublicKeySize);
  const pubkeyEnd = plaintextWithMetadata.byteLength - signatureSize;
  const senderED25519PublicKey = plaintextWithMetadata.subarray(pubkeyStart, pubkeyEnd);
  const plainTextEnd = plaintextWithMetadata.byteLength - (signatureSize + ed25519PublicKeySize);
  const plaintext = plaintextWithMetadata.subarray(0, plainTextEnd);

  // 3. ) Verify the signature
  const isValid = sodium.crypto_sign_verify_detached(
    signature,
    concatUInt8Array(plaintext, senderED25519PublicKey, fromHexToArray(recipientX25519PublicKey)),
    senderED25519PublicKey
  );

  if (!isValid) {
    perfEnd(`decryptWithSessionProtocol-${envelope.id}`, 'decryptWithSessionProtocol');

    throw new Error('Invalid message signature.');
  }
  // 4. ) Get the sender's X25519 public key
  const senderX25519PublicKey = sodium.crypto_sign_ed25519_pk_to_curve25519(senderED25519PublicKey);
  if (!senderX25519PublicKey) {
    perfEnd(`decryptWithSessionProtocol-${envelope.id}`, 'decryptWithSessionProtocol');

    throw new Error('Decryption failed.'); // Error.decryptionFailed
  }

  // set the sender identity on the envelope itself.
  if (isClosedGroup) {
    // eslint-disable-next-line no-param-reassign
    envelope.senderIdentity = `${KeyPrefixType.standard}${toHex(senderX25519PublicKey)}`;
  } else {
    // eslint-disable-next-line no-param-reassign
    envelope.source = `${KeyPrefixType.standard}${toHex(senderX25519PublicKey)}`;
  }
  perfEnd(`decryptWithSessionProtocol-${envelope.id}`, 'decryptWithSessionProtocol');

  return { decryptedContent: plaintext };
}

/**
 * This function is used to decrypt any messages send to our own pubkey.
 * Either messages deposited into our swarm by other people, or messages we sent to ourselves, or config messages stored on the user namespaces.
 * @param envelope the envelope contaning an encrypted .content field to decrypt
 * @returns the decrypted content, or null
 */
export async function decryptEnvelopeWithOurKey(
  envelope: EnvelopePlus
): Promise<ArrayBuffer | null> {
  try {
    const userX25519KeyPair = await UserUtils.getIdentityKeyPair();

    if (!userX25519KeyPair) {
      throw new Error('Failed to find User x25519 keypair from stage'); // noUserX25519KeyPair
    }

    const ecKeyPair = ECKeyPair.fromArrayBuffer(
      userX25519KeyPair.pubKey,
      userX25519KeyPair.privKey
    );

    const { decryptedContent } = await decryptWithSessionProtocol(
      envelope,
      envelope.content,
      ecKeyPair
    );

    const ret = removeMessagePadding(decryptedContent);

    return ret;
  } catch (e) {
    window?.log?.warn('decryptWithSessionProtocol for unidentified message throw:', e);
    return null;
  }
}

async function decrypt(envelope: EnvelopePlus): Promise<{ decryptedContent: ArrayBuffer } | null> {
  if (envelope.content.byteLength === 0) {
    throw new Error('Received an empty envelope.');
  }

  let decryptedContent: ArrayBuffer | null = null;
  switch (envelope.type) {
    // Only SESSION_MESSAGE and CLOSED_GROUP_MESSAGE are supported
    case SignalService.Envelope.Type.SESSION_MESSAGE:
      decryptedContent = await decryptEnvelopeWithOurKey(envelope);
      break;
    case SignalService.Envelope.Type.CLOSED_GROUP_MESSAGE:
      return null;
    default:
      assertUnreachable(envelope.type, `Unknown message type:${envelope.type}`);
  }

  if (!decryptedContent) {
    // content could not be decrypted.
    await IncomingMessageCache.removeFromCache(envelope);
    return null;
  }

  perfStart(`updateCacheWithDecryptedContent-${envelope.id}`);

  await IncomingMessageCache.updateCacheWithDecryptedContent({ envelope, decryptedContent }).catch(
    error => {
      window?.log?.error(
        'decrypt failed to save decrypted message contents to cache:',
        error && error.stack ? error.stack : error
      );
    }
  );
  perfEnd(`updateCacheWithDecryptedContent-${envelope.id}`, 'updateCacheWithDecryptedContent');

  return { decryptedContent };
}

async function shouldDropIncomingPrivateMessage(
  sentAtTimestamp: number,
  envelope: EnvelopePlus,
  content: SignalService.Content
) {
  const isUs = UserUtils.isUsFromCache(envelope.source);
  // sentAtMoreRecentThanWrapper is going to be true, if the latest contact wrapper we processed was roughly more recent that this message timestamp
  const moreRecentOrNah = await sentAtMoreRecentThanWrapper(
    sentAtTimestamp,
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
        const ourPriority = us?.get('priority') || CONVERSATION_PRIORITIES.default;
        if (us && ourPriority <= CONVERSATION_PRIORITIES.hidden) {
          // if the wrapper data is more recent than this message and the NTS conversation is hidden, just drop this incoming message to avoid showing the NTS conversation again.
          window.log.info(
            `shouldDropIncomingPrivateMessage: received message in NTS which appears to be hidden in our most recent libsession userconfig, sentAt: ${sentAtTimestamp}. Dropping it`
          );
          return true;
        }
        window.log.info(
          `shouldDropIncomingPrivateMessage: received message on conversation ${syncTargetOrSource} which appears to NOT be hidden/removed in our most recent libsession userconfig, sentAt: ${sentAtTimestamp}. `
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
            `shouldDropIncomingPrivateMessage: received message on conversation ${syncTargetOrSource} which appears to be hidden/removed in our most recent libsession contactconfig, sentAt: ${sentAtTimestamp}. Dropping it`
          );
          return true;
        }

        window.log.info(
          `shouldDropIncomingPrivateMessage: received message on conversation ${syncTargetOrSource} which appears to NOT be hidden/removed in our most recent libsession contactconfig, sentAt: ${sentAtTimestamp}. `
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

async function dropIncomingGroupMessage(envelope: EnvelopePlus, sentAtTimestamp: number) {
  try {
    if (PubKey.is03Pubkey(envelope.source)) {
      const infos = await MetaGroupWrapperActions.infoGet(envelope.source);

      if (!infos) {
        return false;
      }

      if (
        sentAtTimestamp &&
        ((infos.deleteAttachBeforeSeconds &&
          sentAtTimestamp <= infos.deleteAttachBeforeSeconds * 1000) ||
          (infos.deleteBeforeSeconds && sentAtTimestamp <= infos.deleteBeforeSeconds * 1000))
      ) {
        window?.log?.info(
          `Incoming message sent before the group ${ed25519Str(envelope.source)} deleteBeforeSeconds or deleteAttachBeforeSeconds. Dropping it.`
        );
        await IncomingMessageCache.removeFromCache(envelope);
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
  contentDecrypted,
  envelope,
  messageHash,
  sentAtTimestamp,
  messageExpirationFromRetrieve,
}: {
  envelope: EnvelopePlus;
  sentAtTimestamp: number;
  contentDecrypted: ArrayBuffer;
  messageHash: string;
  messageExpirationFromRetrieve: number | null;
}): Promise<void> {
  try {
    window.log.info('innerHandleSwarmContentMessage');

    const content = SignalService.Content.decode(new Uint8Array(contentDecrypted));
    // This function gets called with an inbox content from a community. When that's the case,
    // the messageHash is empty.
    // `shouldProcessContentMessage` is a lot less strict in terms of timestamps for community messages, and needs to be.
    // Not having this isCommunity flag set to true would make any incoming message from a blinded message request be dropped.
    if (!shouldProcessContentMessage(envelope, content, !messageHash)) {
      window.log.info(
        `innerHandleSwarmContentMessage: dropping invalid content message ${envelope.timestamp}`
      );
      await IncomingMessageCache.removeFromCache(envelope);
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

    const blocked = BlockedNumberController.isBlocked(envelope.senderIdentity || envelope.source);
    if (blocked) {
      const envelopeSource = envelope.source;
      // We want to allow a blocked user message if that's a control message for a known group and the group is not blocked
      if (shouldDropBlockedUserMessage(content, envelopeSource)) {
        window?.log?.info(
          `Dropping blocked user message ${ed25519Str(envelope.senderIdentity || envelope.source)}`
        );
        return;
      }
      window?.log?.info(
        `Allowing control/update message only from blocked user ${ed25519Str(envelope.senderIdentity)} in group: ${ed25519Str(envelope.source)}`
      );
    }

    if (await dropIncomingGroupMessage(envelope, sentAtTimestamp)) {
      // message removed from cache in `dropIncomingGroupMessage` already
      return;
    }

    // if this is a direct message, envelope.senderIdentity is undefined
    // if this is a closed group message, envelope.senderIdentity is the sender's pubkey and envelope.source is the closed group's pubkey
    const isPrivateConversationMessage = !envelope.senderIdentity;

    if (isPrivateConversationMessage) {
      if (await shouldDropIncomingPrivateMessage(sentAtTimestamp, envelope, content)) {
        await IncomingMessageCache.removeFromCache(envelope);
        return;
      }
    }

    /**
     * For a closed group message, this holds the conversation with that specific user outside of the closed group.
     * For a private conversation message, this is just the conversation with that user
     */
    const senderConversationModel = await ConvoHub.use().getOrCreateAndWait(
      isPrivateConversationMessage ? envelope.source : envelope.senderIdentity,
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
      conversationModelForUIUpdate = PubKey.is03Pubkey(envelope.source)
        ? await ConvoHub.use().getOrCreateAndWait(envelope.source, ConversationTypeEnum.GROUPV2)
        : await ConvoHub.use().getOrCreateAndWait(envelope.source, ConversationTypeEnum.GROUP);
    }

    const expireUpdate = await DisappearingMessages.checkForExpireUpdateInContentMessage(
      content,
      conversationModelForUIUpdate,
      messageExpirationFromRetrieve
    );
    if (content.dataMessage) {
      // because typescript is funky with incoming protobufs
      if (isEmpty(content.dataMessage.profileKey)) {
        content.dataMessage.profileKey = null;
      }

      await handleSwarmDataMessage({
        envelope,
        sentAtTimestamp,
        rawDataMessage: content.dataMessage as SignalService.DataMessage,
        messageHash,
        senderConversationModel,
        expireUpdate: expireUpdate || null,
      });

      return;
    }

    if (content.receiptMessage) {
      perfStart(`handleReceiptMessage-${envelope.id}`);

      await handleReceiptMessage(envelope, content.receiptMessage);
      perfEnd(`handleReceiptMessage-${envelope.id}`, 'handleReceiptMessage');
      return;
    }
    if (content.typingMessage) {
      perfStart(`handleTypingMessage-${envelope.id}`);

      await handleTypingMessage(envelope, content.typingMessage as SignalService.TypingMessage);
      perfEnd(`handleTypingMessage-${envelope.id}`, 'handleTypingMessage');
      return;
    }

    if (content.dataExtractionNotification) {
      perfStart(`handleDataExtractionNotification-${envelope.id}`);

      await handleDataExtractionNotification({
        envelope,
        dataExtractionNotification:
          content.dataExtractionNotification as SignalService.DataExtractionNotification,
        expireUpdate,
        messageHash,
      });
      perfEnd(
        `handleDataExtractionNotification-${envelope.id}`,
        'handleDataExtractionNotification'
      );
      return;
    }
    if (content.unsendMessage) {
      await handleUnsendMessage(envelope, content.unsendMessage as SignalService.Unsend);
      return;
    }
    if (content.callMessage) {
      await handleCallMessage(envelope, content.callMessage as SignalService.CallMessage, {
        expireDetails: expireUpdate,
        messageHash,
      });
      return;
    }
    if (content.messageRequestResponse) {
      await handleMessageRequestResponse(
        envelope,
        content.messageRequestResponse as SignalService.MessageRequestResponse
      );
      return;
    }

    // If we get here, we don't know how to handle that envelope. probably a very old type of message, or something we don't support.
    // There is not much we can do expect drop it
    await IncomingMessageCache.removeFromCache(envelope);
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
  envelope: EnvelopePlus,
  receiptMessage: SignalService.IReceiptMessage
) {
  const receipt = receiptMessage as SignalService.ReceiptMessage;

  const { type, timestamp } = receipt;

  const results = [];
  if (type === SignalService.ReceiptMessage.Type.READ) {
    // eslint-disable-next-line no-restricted-syntax
    for (const ts of timestamp) {
      const promise = onReadReceipt(toNumber(envelope.timestamp), toNumber(ts), envelope.source);
      results.push(promise);
    }
  }
  await Promise.all(results);

  await IncomingMessageCache.removeFromCache(envelope);
}

async function handleTypingMessage(
  envelope: EnvelopePlus,
  typingMessage: SignalService.TypingMessage
): Promise<void> {
  const { timestamp, action } = typingMessage;
  const { source } = envelope;

  await IncomingMessageCache.removeFromCache(envelope);

  // We don't do anything with incoming typing messages if the setting is disabled
  if (!Storage.get(SettingsKey.settingsTypingIndicator)) {
    return;
  }

  if (envelope.timestamp && timestamp) {
    const sentAtTimestamp = toNumber(envelope.timestamp);
    const typingTimestamp = toNumber(timestamp);

    if (typingTimestamp !== sentAtTimestamp) {
      window?.log?.warn(
        `Typing message envelope timestamp (${sentAtTimestamp}) did not match typing timestamp (${typingTimestamp})`
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
async function handleUnsendMessage(envelope: EnvelopePlus, unsendMessage: SignalService.Unsend) {
  const { author: messageAuthor, timestamp } = unsendMessage;
  window.log.info(`handleUnsendMessage from ${messageAuthor}: of timestamp: ${timestamp}`);
  if (messageAuthor !== (envelope.senderIdentity || envelope.source)) {
    window?.log?.error(
      'handleUnsendMessage: Dropping request as the author and the sender differs.'
    );
    await IncomingMessageCache.removeFromCache(envelope);

    return;
  }
  if (!unsendMessage) {
    window?.log?.error('handleUnsendMessage: Invalid parameters -- dropping message.');
    await IncomingMessageCache.removeFromCache(envelope);

    return;
  }
  if (!timestamp) {
    window?.log?.error('handleUnsendMessage: Invalid timestamp -- dropping message');
    await IncomingMessageCache.removeFromCache(envelope);

    return;
  }
  const messageToDelete = (
    await Data.getMessagesBySenderAndSentAt([
      {
        source: messageAuthor,
        timestamp: toNumber(timestamp),
      },
    ])
  )?.[0];
  const messageHash = messageToDelete?.get('messageHash');
  // #endregion

  // #region executing deletion
  if (messageHash && messageToDelete) {
    window.log.info('handleUnsendMessage: got a request to delete ', messageHash);
    const conversation = ConvoHub.use().get(messageToDelete.get('conversationId'));
    if (!conversation) {
      await IncomingMessageCache.removeFromCache(envelope);

      return;
    }
    if (messageToDelete.getSource() === UserUtils.getOurPubKeyStrFromCache()) {
      // a message we sent is completely removed when we get a unsend request
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
  await IncomingMessageCache.removeFromCache(envelope);
}

/**
 * Sets approval fields for conversation depending on response's values. If request is approving, pushes notification and
 */
async function handleMessageRequestResponse(
  envelope: EnvelopePlus,
  messageRequestResponse: SignalService.MessageRequestResponse
) {
  // no one cares about the is `messageRequestResponse.isApproved` field currently.
  if (!messageRequestResponse || !messageRequestResponse.isApproved) {
    window?.log?.error('handleMessageRequestResponse: Invalid parameters -- dropping message.');
    await IncomingMessageCache.removeFromCache(envelope);
    return;
  }

  const sodium = await getSodiumRenderer();

  const convosToMerge = findCachedBlindedMatchOrLookupOnAllServers(envelope.source, sodium);
  const unblindedConvoId = envelope.source;

  if (!PubKey.is05Pubkey(unblindedConvoId)) {
    window?.log?.warn(
      'handleMessageRequestResponse: Invalid unblindedConvoId -- dropping message.'
    );
    await IncomingMessageCache.removeFromCache(envelope);
    return;
  }

  const conversationToApprove = await ConvoHub.use().getOrCreateAndWait(
    unblindedConvoId,
    ConversationTypeEnum.PRIVATE
  );
  let mostRecentActiveAt = Math.max(...compact(convosToMerge.map(m => m.getActiveAt())));
  if (!isFinite(mostRecentActiveAt) || mostRecentActiveAt <= 0) {
    mostRecentActiveAt = toNumber(envelope.timestamp);
  }

  const previousApprovedMe = conversationToApprove.didApproveMe();
  await conversationToApprove.setDidApproveMe(true, false);

  conversationToApprove.set({
    active_at: mostRecentActiveAt,
  });
  await conversationToApprove.unhideIfNeeded(false);
  await conversationToApprove.commit();

  if (convosToMerge.length) {
    // merge fields we care by hand
    conversationToApprove.set({
      profileKey: convosToMerge[0].getProfileKey(),
      displayNameInProfile: convosToMerge[0].getRealSessionUsername(),
      avatarInProfile: convosToMerge[0].getAvatarInProfilePath(),
      fallbackAvatarInProfile: convosToMerge[0].getFallbackAvatarInProfilePath(),
      avatarPointer: convosToMerge[0].getAvatarPointer(), // don't set the avatar pointer
      isApproved: convosToMerge[0].isApproved(),
      // nickname might be set already in conversationToApprove, so don't overwrite it
    });

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
      messageModel.set({ conversationId: unblindedConvoId });

      if (messageModel.get('source') !== UserUtils.getOurPubKeyStrFromCache()) {
        messageModel.set({ source: unblindedConvoId });
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

  if (messageRequestResponse.profile && !isEmpty(messageRequestResponse.profile)) {
    await ProfileManager.updateProfileOfContact(
      conversationToApprove.id,
      messageRequestResponse.profile.displayName,
      messageRequestResponse.profile.profilePicture,
      messageRequestResponse.profileKey
    );
  }

  if (previousApprovedMe) {
    await conversationToApprove.commit();

    window.log.info(
      `convo ${ed25519Str(conversationToApprove.id)} previousApprovedMe is already true. Nothing to do `
    );
    await IncomingMessageCache.removeFromCache(envelope);
    return;
  }

  // Conversation was not approved before so a sync is needed
  await conversationToApprove.addIncomingApprovalMessage(
    toNumber(envelope.timestamp),
    unblindedConvoId
  );
  await IncomingMessageCache.removeFromCache(envelope);
}

/**
 * A DataExtractionNotification message can only come from a 1o1 conversation.
 *
 * We drop them if the convo is not a 1o1 conversation.
 */

export async function handleDataExtractionNotification({
  envelope,
  expireUpdate,
  messageHash,
  dataExtractionNotification,
}: {
  envelope: EnvelopePlus;
  dataExtractionNotification: SignalService.DataExtractionNotification;
  expireUpdate: ReadyToDisappearMsgUpdate | undefined;
  messageHash: string;
}): Promise<void> {
  // Note: we currently don't care about the timestamp included in the field itself, just the timestamp of the envelope

  const { source, timestamp } = envelope;
  await IncomingMessageCache.removeFromCache(envelope);

  const convo = ConvoHub.use().get(source);
  if (!convo || !convo.isPrivate()) {
    window?.log?.info('Got DataNotification for unknown or non-private convo');

    return;
  }

  if (!source || !timestamp) {
    window?.log?.info('DataNotification pre check failed');

    return;
  }

  const sentAtTimestamp = toNumber(timestamp);

  let created = await convo.addSingleIncomingMessage({
    source,
    messageHash,
    sent_at: sentAtTimestamp,
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
