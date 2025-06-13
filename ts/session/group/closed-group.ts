import { ConversationModel } from '../../models/conversation';
import { MessageModel } from '../../models/message';
import { MessageAttributesOptionals, MessageGroupUpdate } from '../../models/messageType';
import { PropsForGroupUpdateType } from '../../state/ducks/conversations';
import { DisappearingMessages } from '../disappearing_messages';
import { WithDisappearingMessageUpdate } from '../disappearing_messages/types';
import { UserUtils } from '../utils';
import type { WithMessageHashOrNull } from '../types/with';

export type GroupDiff = PropsForGroupUpdateType;

async function addUpdateMessage({
  convo,
  diff,
  sender,
  sentAt,
  expireUpdate,
  markAlreadySent,
  messageHash,
}: WithMessageHashOrNull & {
  convo: ConversationModel;
  diff: GroupDiff;
  sender: string;
  sentAt: number;
  markAlreadySent: boolean;
} & WithDisappearingMessageUpdate): Promise<MessageModel> {
  const groupUpdate: MessageGroupUpdate = {};

  if (!convo.isClosedGroupV2()) {
    throw new Error('addUpdateMessage only supports 03-groups now');
  }

  if (diff.type === 'name' && diff.newName) {
    groupUpdate.name = diff.newName;
  } else if (diff.type === 'add' && diff.added) {
    if (diff.withHistory) {
      groupUpdate.joinedWithHistory = diff.added;
    } else {
      groupUpdate.joined = diff.added;
    }
  } else if (diff.type === 'left' && diff.left) {
    groupUpdate.left = diff.left;
  } else if (diff.type === 'kicked' && diff.kicked) {
    groupUpdate.kicked = diff.kicked;
  } else if (diff.type === 'promoted' && diff.promoted) {
    groupUpdate.promoted = diff.promoted;
  } else if (diff.type === 'avatarChange') {
    groupUpdate.avatarChange = true;
  } else {
    throw new Error('addUpdateMessage with unknown type of change');
  }

  const isUs = UserUtils.isUsFromCache(sender);
  const msgAttrs: MessageAttributesOptionals = {
    sent_at: sentAt,
    group_update: groupUpdate,
    source: sender,
    conversationId: convo.id,
    type: isUs ? 'outgoing' : 'incoming',
    messageHash: messageHash || undefined,
  };

  /**
   * When we receive an update from our linked device, it is an outgoing message
   *   but which was obviously already synced (as we got it).
   * When that's the case we need to mark the message as sent right away,
   *   so the MessageStatus 'sending' state is not shown for the last message in the left pane.
   */
  if (msgAttrs.type === 'outgoing' && markAlreadySent) {
    msgAttrs.sent = true;
  }

  if (convo && expireUpdate && expireUpdate.expirationType && expireUpdate.expirationTimer > 0) {
    const { expirationTimer, expirationType } = expireUpdate;

    msgAttrs.expirationType = expirationType === 'deleteAfterSend' ? 'deleteAfterSend' : 'unknown';
    msgAttrs.expireTimer = msgAttrs.expirationType === 'deleteAfterSend' ? expirationTimer : 0;

    // NOTE Triggers disappearing for an incoming groupUpdate message
    if (expirationType === 'deleteAfterSend') {
      msgAttrs.expirationStartTimestamp = DisappearingMessages.setExpirationStartTimestamp(
        expirationType,
        sentAt,
        'addUpdateMessage'
      );
    }
  }

  return isUs
    ? convo.addSingleOutgoingMessage(msgAttrs)
    : convo.addSingleIncomingMessage({
        ...msgAttrs,
        source: sender,
      });
}

export const ClosedGroup = {
  addUpdateMessage,
};
