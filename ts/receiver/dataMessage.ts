/* eslint-disable no-param-reassign */
import { isEmpty, noop, omit, toNumber } from 'lodash';

import { SignalService } from '../protobuf';
import { IncomingMessageCache } from './cache';
import { getEnvelopeId } from './common';
import { EnvelopePlus } from './types';

import { Data } from '../data/data';
import { ConversationModel } from '../models/conversation';
import { ConvoHub } from '../session/conversations';
import { PubKey } from '../session/types';
import { StringUtils, UserUtils } from '../session/utils';
import { handleMessageJob, toRegularMessage } from './queuedJob';

import { MessageModel } from '../models/message';
import {
  createSwarmMessageSentFromNotUs,
  createSwarmMessageSentFromUs,
} from '../models/messageFactory';
import { DisappearingMessages } from '../session/disappearing_messages';
import { WithDisappearingMessageUpdate } from '../session/disappearing_messages/types';
import { ProfileManager } from '../session/profile_manager/ProfileManager';
import { isUsFromCache } from '../session/utils/User';
import { Action, Reaction } from '../types/Reaction';
import { toLogFormat } from '../types/attachments/Errors';
import { Reactions } from '../util/reactions';
import { GroupV2Receiver } from './groupv2/handleGroupV2Message';
import { ConversationTypeEnum } from '../models/types';
import { ed25519Str } from '../session/utils/String';
import { Timestamp } from '../types/timestamp/timestamp';

function cleanAttachment(attachment: SignalService.IAttachmentPointer) {
  return {
    ...omit(attachment, 'thumbnail'),
    id: 0,
    key: attachment.key ? StringUtils.decode(attachment.key, 'base64') : null,
    digest:
      attachment.digest && attachment.digest.length > 0
        ? StringUtils.decode(attachment.digest, 'base64')
        : null,
  };
}

function cleanAttachments(decryptedDataMessage: SignalService.DataMessage) {
  const { quote } = decryptedDataMessage;

  // Here we go from binary to string/base64 in all AttachmentPointer digest/key fields

  // when receiving a message we get keys of attachment as buffer, but we override the data with the decrypted string instead.
  // TODO it would be nice to get rid of that as any here, but not in this PR
  decryptedDataMessage.attachments = (decryptedDataMessage.attachments || []).map(
    cleanAttachment
  ) as any;
  decryptedDataMessage.preview = (decryptedDataMessage.preview || []).map((item: any) => {
    const { image } = item;

    if (!image) {
      return item;
    }

    return {
      ...item,
      image: cleanAttachment(image),
    };
  });

  if (quote) {
    if (quote.id) {
      quote.id = toNumber(quote.id);
    }
  }
}

export function messageHasVisibleContent(message: SignalService.DataMessage) {
  const { flags, body, attachments, quote, preview, openGroupInvitation, reaction } = message;

  return (
    !!flags ||
    !isEmpty(body) ||
    !isEmpty(attachments) ||
    !isEmpty(quote) ||
    !isEmpty(preview) ||
    !isEmpty(openGroupInvitation) ||
    !isEmpty(reaction)
  );
}

export function cleanIncomingDataMessage(rawDataMessage: SignalService.DataMessage) {
  const FLAGS = SignalService.DataMessage.Flags;

  // Now that its decrypted, validate the message and clean it up for consumer
  //   processing
  // Note that messages may (generally) only perform one action and we ignore remaining
  //   fields after the first action.

  if (rawDataMessage.flags == null) {
    rawDataMessage.flags = 0;
  }
  // eslint-disable-next-line no-bitwise
  if (rawDataMessage.flags & FLAGS.EXPIRATION_TIMER_UPDATE) {
    rawDataMessage.body = '';
    rawDataMessage.attachments = [];
  } else if (rawDataMessage.flags !== 0) {
    throw new Error('Unknown flags in message');
  }

  const attachmentCount = rawDataMessage?.attachments?.length || 0;
  const ATTACHMENT_MAX = 32;
  if (attachmentCount > ATTACHMENT_MAX) {
    throw new Error(
      `Too many attachments: ${attachmentCount} included in one message, max is ${ATTACHMENT_MAX}`
    );
  }
  cleanAttachments(rawDataMessage);

  return rawDataMessage;
}

/**
 * We have a few origins possible
 *    - if the message is from a private conversation with a friend and he wrote to us,
 *        the conversation to add the message to is our friend pubkey, so envelope.source
 *    - if the message is from a medium group conversation
 *        * envelope.source is the medium group pubkey
 *        * envelope.senderIdentity is the author pubkey (the one who sent the message)
 *    - at last, if the message is a syncMessage,
 *        * envelope.source is our pubkey (our other device has the same pubkey as us)
 *        * dataMessage.syncTarget is either the group public key OR the private conversation this message is about.
 */
export async function handleSwarmDataMessage({
  envelope,
  messageHash,
  rawDataMessage,
  senderConversationModel,
  sentAtTimestamp,
  expireUpdate,
}: WithDisappearingMessageUpdate & {
  envelope: EnvelopePlus;
  sentAtTimestamp: number;
  rawDataMessage: SignalService.DataMessage;
  messageHash: string;
  senderConversationModel: ConversationModel;
}): Promise<void> {
  window.log.info('handleSwarmDataMessage');

  const cleanDataMessage = cleanIncomingDataMessage(rawDataMessage);

  if (cleanDataMessage.groupUpdateMessage) {
    await GroupV2Receiver.handleGroupUpdateMessage({
      signatureTimestamp: sentAtTimestamp,
      updateMessage: rawDataMessage.groupUpdateMessage as SignalService.GroupUpdateMessage,
      source: envelope.source,
      senderIdentity: envelope.senderIdentity,
      expireUpdate,
      messageHash,
    });
    // Groups update should always be able to be decrypted as we get the keys before trying to decrypt them.
    // If decryption failed once, it will keep failing, so no need to keep it in the cache.
    await IncomingMessageCache.removeFromCache({ id: envelope.id });
    return;
  }

  /**
   * This is a mess, but
   *
   * 1. if syncTarget is set and this is a synced message, syncTarget holds the conversationId in which this message is addressed.
   *    This syncTarget can be a private conversation pubkey or a closed group pubkey
   *
   * 2. for a closed group message, envelope.senderIdentity is the pubkey of the sender and envelope.source is the pubkey of the closed group.
   *
   * 3. for a private conversation message, envelope.senderIdentity and envelope.source are probably the pubkey of the sender.
   */
  const isSyncedMessage = Boolean(cleanDataMessage.syncTarget?.length);
  // no need to remove prefix here, as senderIdentity set => envelope.source is not used (and this is the one having the prefix when this is an opengroup)
  const convoIdOfSender = envelope.senderIdentity || envelope.source;
  const isMe = UserUtils.isUsFromCache(convoIdOfSender);

  if (isSyncedMessage && !isMe) {
    window?.log?.warn('Got a sync message from someone else than me. Dropping it.');
    await IncomingMessageCache.removeFromCache(envelope);
    return;
  }
  const convoIdToAddTheMessageTo = isSyncedMessage ? cleanDataMessage.syncTarget : envelope.source;
  if (convoIdToAddTheMessageTo.startsWith(PubKey.PREFIX_GROUP_TEXTSECURE)) {
    window?.log?.warn(
      'got a message starting with textsecure prefix. can only be legacy group message. dropping.'
    );
    await IncomingMessageCache.removeFromCache(envelope);
    return;
  }

  const isGroupMessage = !!envelope.senderIdentity;
  const isGroupV2Message = isGroupMessage && PubKey.is03Pubkey(envelope.source);
  let typeOfConvo = ConversationTypeEnum.PRIVATE;
  if (isGroupV2Message) {
    typeOfConvo = ConversationTypeEnum.GROUPV2;
  } else if (isGroupMessage) {
    typeOfConvo = ConversationTypeEnum.GROUP;
  }

  window?.log?.info(
    `Handle dataMessage about convo ${ed25519Str(convoIdToAddTheMessageTo)} from user: ${ed25519Str(convoIdOfSender)}`
  );

  // remove the prefix from the source object so this is correct for all other
  const convoToAddMessageTo = await ConvoHub.use().getOrCreateAndWait(
    convoIdToAddTheMessageTo,
    typeOfConvo
  );

  // Check if we need to update any profile names
  if (
    !isMe &&
    senderConversationModel &&
    cleanDataMessage.profile &&
    cleanDataMessage.profileKey?.length
  ) {
    await ProfileManager.updateProfileOfContact({
      pubkey: senderConversationModel.id,
      displayName: cleanDataMessage.profile.displayName,
      profileUrl: cleanDataMessage.profile.profilePicture,
      profileKey: cleanDataMessage.profileKey,
      profileUpdatedAtSeconds: new Timestamp({
        value: cleanDataMessage.profile.lastProfileUpdateSeconds ?? 0,
      }).seconds(),
    });
  }

  if (!messageHasVisibleContent(cleanDataMessage)) {
    window?.log?.warn(`Message ${getEnvelopeId(envelope)} ignored; it was empty`);
    await IncomingMessageCache.removeFromCache(envelope);
    return;
  }

  if (!convoIdToAddTheMessageTo) {
    window?.log?.error('We cannot handle a message without a conversationId');
    await IncomingMessageCache.removeFromCache(envelope);
    return;
  }

  let msgModel =
    isSyncedMessage ||
    (envelope.senderIdentity && isUsFromCache(envelope.senderIdentity)) ||
    (envelope.source && isUsFromCache(envelope.source))
      ? createSwarmMessageSentFromUs({
          conversationId: convoIdToAddTheMessageTo,
          messageHash,
          sentAt: sentAtTimestamp,
        })
      : createSwarmMessageSentFromNotUs({
          conversationId: convoIdToAddTheMessageTo,
          messageHash,
          sender: senderConversationModel.id,
          sentAt: sentAtTimestamp,
        });

  if (!isEmpty(expireUpdate)) {
    msgModel = DisappearingMessages.getMessageReadyToDisappear(
      convoToAddMessageTo,
      msgModel,
      cleanDataMessage.flags,
      expireUpdate
    );
  }

  await handleSwarmMessage(
    msgModel,
    messageHash,
    sentAtTimestamp,
    cleanDataMessage,
    convoToAddMessageTo,
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    () => IncomingMessageCache.removeFromCache(envelope)
  );
}

export async function isSwarmMessageDuplicate({
  source,
  sentAt,
}: {
  source: string;
  sentAt: number;
}) {
  try {
    const result = (
      await Data.getMessagesBySenderAndSentAt([
        {
          source,
          timestamp: sentAt,
        },
      ])
    )?.length;

    return Boolean(result);
  } catch (error) {
    window?.log?.error('isSwarmMessageDuplicate error:', toLogFormat(error));
    return false;
  }
}

export async function handleOutboxMessageModel(
  msgModel: MessageModel,
  messageHash: string,
  sentAt: number,
  rawDataMessage: SignalService.DataMessage,
  convoToAddMessageTo: ConversationModel
) {
  return handleSwarmMessage(
    msgModel,
    messageHash,
    sentAt,
    rawDataMessage,
    convoToAddMessageTo,
    noop
  );
}

async function handleSwarmMessage(
  msgModel: MessageModel,
  messageHash: string,
  sentAt: number,
  rawDataMessage: SignalService.DataMessage,
  convoToAddMessageTo: ConversationModel,
  confirm: () => void
): Promise<void> {
  if (!rawDataMessage || !msgModel) {
    window?.log?.warn('Invalid data passed to handleSwarmMessage.');
    confirm();
    return;
  }

  void convoToAddMessageTo.queueJob(async () => {
    // this call has to be made inside the queueJob!
    // We handle reaction DataMessages separately
    if (!convoToAddMessageTo.isPublic() && rawDataMessage.reaction) {
      await Reactions.handleMessageReaction({
        reaction: rawDataMessage.reaction,
        sender: msgModel.get('source'),
        you: isUsFromCache(msgModel.get('source')),
      });

      if (
        convoToAddMessageTo.isPrivate() &&
        msgModel.get('unread') &&
        rawDataMessage.reaction.action === Action.REACT
      ) {
        msgModel.setKey('reaction', rawDataMessage.reaction as Reaction);
        convoToAddMessageTo.throttledNotify(msgModel);
      }

      confirm();
      return;
    }

    const isDuplicate = await isSwarmMessageDuplicate({
      source: msgModel.get('source'),
      sentAt,
    });

    if (isDuplicate) {
      window?.log?.info('Received duplicate message. Dropping it.');
      confirm();
      return;
    }

    await handleMessageJob(
      msgModel,
      convoToAddMessageTo,
      toRegularMessage(rawDataMessage),
      confirm,
      msgModel.get('source'),
      messageHash
    );
  });
}
