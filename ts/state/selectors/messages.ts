import { useSelector } from 'react-redux';
import { MessageModelType } from '../../models/messageType';
import {
  MessageModelPropsWithConvoProps,
  PropsForAttachment,
  PropsForQuote,
  ReduxConversationType,
} from '../ducks/conversations';
import { StateType } from '../reducer';
import { getIsMessageSelected, getMessagePropsByMessageId } from './conversations';
import { useSelectedIsPrivate } from './selectedConversation';
import { LastMessageStatusType } from '../ducks/types';
import { PubKey } from '../../session/types';
import { useIsMe } from '../../hooks/useParamSelector';
import { UserUtils } from '../../session/utils';

function useMessagePropsByMessageId(messageId: string | undefined) {
  return useSelector((state: StateType) => getMessagePropsByMessageId(state, messageId));
}

const useSenderConvoProps = (
  msgProps: MessageModelPropsWithConvoProps | undefined
): ReduxConversationType | undefined => {
  return useSelector((state: StateType) => {
    const sender = msgProps?.propsForMessage.sender;
    if (!sender) {
      return undefined;
    }
    return state.conversations.conversationLookup[sender] || undefined;
  });
};

export const useAuthorProfileName = (messageId: string): string | null => {
  const msg = useMessagePropsByMessageId(messageId);
  const senderProps = useSenderConvoProps(msg);
  const senderIsUs = useIsMe(msg?.propsForMessage?.sender);
  if (!msg || !senderProps) {
    return null;
  }

  const authorProfileName = senderIsUs
    ? window.i18n('you')
    : senderProps.nickname ||
      senderProps.displayNameInProfile ||
      PubKey.shorten(msg.propsForMessage.sender);
  return authorProfileName || window.i18n('unknown');
};

export const useAuthorName = (messageId: string): string | null => {
  const msg = useMessagePropsByMessageId(messageId);
  const senderProps = useSenderConvoProps(msg);
  if (!msg || !senderProps) {
    return null;
  }

  const authorName = senderProps.nickname || senderProps.displayNameInProfile || null;
  return authorName;
};

export const useAuthorAvatarPath = (messageId: string): string | null => {
  const msg = useMessagePropsByMessageId(messageId);
  const senderProps = useSenderConvoProps(msg);
  if (!msg || !senderProps) {
    return null;
  }

  return senderProps.avatarPath || null;
};

export const useMessageIsDeleted = (messageId: string): boolean => {
  const props = useMessagePropsByMessageId(messageId);
  return !!props?.propsForMessage.isDeleted || false;
};

export const useFirstMessageOfSeries = (messageId: string | undefined): boolean => {
  return useMessagePropsByMessageId(messageId)?.firstMessageOfSeries || false;
};

export const useLastMessageOfSeries = (messageId: string | undefined): boolean => {
  return useMessagePropsByMessageId(messageId)?.lastMessageOfSeries || false;
};

export const useMessageAuthor = (messageId: string | undefined): string | undefined => {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.sender;
};

export const useMessageAuthorIsUs = (messageId: string | undefined): boolean => {
  return UserUtils.isUsFromCache(useMessagePropsByMessageId(messageId)?.propsForMessage.sender);
};

export const useMessageDirection = (
  messageId: string | undefined
): MessageModelType | undefined => {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.direction;
};

export const useMessageLinkPreview = (messageId: string | undefined): Array<any> | undefined => {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.previews;
};

export const useMessageAttachments = (
  messageId: string | undefined
): Array<PropsForAttachment> | undefined => {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.attachments;
};

export const useMessageSenderIsAdmin = (messageId: string | undefined): boolean => {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.isSenderAdmin || false;
};

export const useMessageIsDeletable = (messageId: string | undefined): boolean => {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.isDeletable || false;
};

export const useMessageStatus = (
  messageId: string | undefined
): LastMessageStatusType | undefined => {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.status;
};

export function useMessageSender(messageId: string | undefined) {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.sender;
}

export function useMessageIsDeletableForEveryone(messageId: string | undefined) {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.isDeletableForEveryone;
}

export function useMessageServerTimestamp(messageId: string | undefined) {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.serverTimestamp;
}

export function useMessageReceivedAt(messageId: string | undefined) {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.receivedAt;
}

export function useMessageIsUnread(messageId: string | undefined) {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.isUnread;
}

export function useMessageTimestamp(messageId: string | undefined) {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.timestamp;
}

export function useMessageBody(messageId: string | undefined) {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.text;
}

export const useMessageQuote = (messageId: string | undefined): PropsForQuote | undefined => {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.quote;
};

export const useMessageHash = (messageId: string | undefined) => {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.messageHash;
};

export const useMessageExpirationType = (messageId: string | undefined) => {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.expirationType;
};

export const useMessageExpirationDurationMs = (messageId: string | undefined) => {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.expirationDurationMs;
};

export const useMessageExpirationTimestamp = (messageId: string | undefined) => {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.expirationTimestamp;
};

export const useMessageServerId = (messageId: string | undefined) => {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.serverId;
};

export const useMessageText = (messageId: string | undefined): string | undefined => {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.text;
};

export function useHideAvatarInMsgList(messageId?: string, isDetailView?: boolean) {
  const msgProps = useMessagePropsByMessageId(messageId);
  const selectedIsPrivate = useSelectedIsPrivate();
  return isDetailView || msgProps?.propsForMessage.direction === 'outgoing' || selectedIsPrivate;
}

export function useMessageSelected(messageId?: string) {
  return useSelector((state: StateType) => getIsMessageSelected(state, messageId));
}

/**
 *  ==================================================
 *  Below are selectors for community invitation props
 *  ==================================================
 */

/**
 * Return the full url needed to join a community through a community invitation message
 */
export function useMessageCommunityInvitationFullUrl(messageId: string) {
  return useMessagePropsByMessageId(messageId)?.propsForCommunityInvitation?.fullUrl;
}

/**
 * Return the community display name to have a guess of what a community is about
 */
export function useMessageCommunityInvitationCommunityName(messageId: string) {
  return useMessagePropsByMessageId(messageId)?.propsForCommunityInvitation?.serverName;
}

/**
 *  ==========================================
 *  Below are selectors for call notifications
 *  ==========================================
 */

/**
 * Return the call notification type linked to the specified message
 */
export function useMessageCallNotificationType(messageId: string) {
  return useMessagePropsByMessageId(messageId)?.propsForCallNotification?.notificationType;
}

/**
 *  ====================================================
 *  Below are selectors for data extraction notification
 *  ====================================================
 */

/**
 * Return the data extraction type linked to the specified message
 */
export function useMessageDataExtractionType(messageId: string) {
  return useMessagePropsByMessageId(messageId)?.propsForDataExtractionNotification?.type;
}

/**
 *  ================================================
 *  Below are selectors for interaction notification
 *  ================================================
 */

/**
 * Return the interaction notification type linked to the specified message
 */
export function useMessageInteractionNotification(messageId: string) {
  return useMessagePropsByMessageId(messageId)?.propsForInteractionNotification?.notificationType;
}

/**
 *  ================================================
 *  Below are selectors for expiration timer updates
 *  ================================================
 */

/**
 * Return the expiration update mode linked to the specified message
 */
export function useMessageExpirationUpdateMode(messageId: string) {
  return useMessagePropsByMessageId(messageId)?.propsForTimerNotification?.expirationMode || 'off';
}

/**
 * Return true if the message is disabling expiration timer update (timespanSeconds === 0)
 */
export function useMessageExpirationUpdateDisabled(messageId: string) {
  const timespanSeconds = useMessageExpirationUpdateTimespanSeconds(messageId);
  return timespanSeconds === 0;
}

/**
 * Return the timespan in seconds to which this expiration timer update is set
 */
export function useMessageExpirationUpdateTimespanSeconds(messageId: string) {
  return useMessagePropsByMessageId(messageId)?.propsForTimerNotification?.timespanSeconds;
}

/**
 * Return the timespan in text (localised) built from the field timespanSeconds
 */
export function useMessageExpirationUpdateTimespanText(messageId: string) {
  return useMessagePropsByMessageId(messageId)?.propsForTimerNotification?.timespanText || '';
}

/**
 *  ============================================
 *  Below are selectors for group change updates
 *  ============================================
 */

/**
 * Return the group change corresponding to this message's group update
 */
export function useMessageGroupUpdateChange(messageId: string) {
  return useMessagePropsByMessageId(messageId)?.propsForGroupUpdateMessage?.change;
}
