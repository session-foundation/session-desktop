import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { MessageModelType } from '../../models/messageType';
import {
  MessageModelPropsWithConvoProps,
  PropsForAttachment,
  ReduxConversationType,
} from '../ducks/conversations';
import { StateType } from '../reducer';
import { getIsMessageSelected, getMessagePropsByMessageId } from './conversations';
import { useSelectedIsPrivate } from './selectedConversation';
import { LastMessageStatusType } from '../ducks/types';
import { PubKey } from '../../session/types';
import { useIsMe } from '../../hooks/useParamSelector';
import { UserUtils } from '../../session/utils';
import { tr } from '../../localization/localeTools';
import { getDataFeatureFlagMemo } from '../ducks/types/releasedFeaturesReduxTypes';

function useMessagePropsByMessageId(messageId: string | undefined) {
  const props = useSelector((state: StateType) => getMessagePropsByMessageId(state, messageId));
  return useMemo(() => props, [props]);
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

// NOTE: [react-compiler] this convinces the compiler the hook is static
const useIsMeInternal = useIsMe;

export const useAuthorProfileName = (messageId: string): string | null => {
  const msg = useMessagePropsByMessageId(messageId);
  const senderProps = useSenderConvoProps(msg);
  const senderIsUs = useIsMeInternal(msg?.propsForMessage?.sender);
  if (!msg || !senderProps) {
    return null;
  }

  const authorProfileName = senderIsUs
    ? tr('you')
    : senderProps.nickname ||
      senderProps.displayNameInProfile ||
      PubKey.shorten(msg.propsForMessage.sender);
  return authorProfileName || tr('unknown');
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
  const previews = useMessagePropsByMessageId(messageId)?.propsForMessage.previews;
  return previews;
};

export const useMessageAttachments = (
  messageId: string | undefined
): Array<PropsForAttachment> | undefined => {
  const attachments = useMessagePropsByMessageId(messageId)?.propsForMessage.attachments;
  return attachments;
};

export const useMessageSenderIsAdmin = (messageId: string | undefined): boolean => {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.isSenderAdmin || false;
};

export const useMessageStatus = (
  messageId: string | undefined
): LastMessageStatusType | undefined => {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.status;
};

/**
 * Returns true if
 *  - the message is incoming (i.e. we've fetched it from the server/swarm)
 *  - the message was sent or already read by the recipient, false otherwise.
 *
 * @see MessageModel.isOnline()
 */
export const useMessageIsOnline = (messageId: string | undefined): boolean => {
  const status = useMessageStatus(messageId);
  const direction = useMessageDirection(messageId);
  if (direction === 'incoming') {
    return true;
  }
  return status === 'sent' || status === 'read';
};

export function useMessageSender(messageId: string | undefined) {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.sender;
}

export function useMessageIsControlMessage(messageId: string | undefined) {
  return useMessagePropsByMessageId(messageId)?.isControlMessage;
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

export const useMessageQuote = (messageId: string | undefined) => {
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

export function useMessageType(messageId: string | undefined) {
  return useMessagePropsByMessageId(messageId)?.messageType;
}

export const useMessageText = (messageId: string | undefined): string | undefined => {
  return useMessagePropsByMessageId(messageId)?.propsForMessage.text;
};

export function useHideAvatarInMsgList(messageId?: string, isDetailView?: boolean) {
  const messageDirection = useMessageDirection(messageId);
  const selectedIsPrivate = useSelectedIsPrivate();
  return isDetailView || messageDirection === 'outgoing' || selectedIsPrivate;
}

export function useMessageSelected(messageId?: string) {
  return useSelector((state: StateType) => getIsMessageSelected(state, messageId));
}

export function useMessageSentWithProFeatures(messageId?: string) {
  const msgProps = useMessagePropsByMessageId(messageId);
  const mockedFeatureFlags = getDataFeatureFlagMemo('mockMessageProFeatures');
  const proFeatures = mockedFeatureFlags ?? msgProps?.propsForMessage.proFeaturesUsed;

  return proFeatures ?? null;
}

/**
 *  ==================================================
 *  Below are selectors for community invitation props
 *  ==================================================
 */

function useCommunityInvitationProps(messageId: string | undefined) {
  const props = useMessagePropsByMessageId(messageId);
  if (!props) {
    return null;
  }
  if (props.messageType !== 'community-invitation') {
    throw new Error('useCommunityInvitationProps: messageType is not community-invitation');
  }
  return props?.propsForCommunityInvitation;
}

/**
 * Return the full url needed to join a community through a community invitation message
 */
export function useMessageCommunityInvitationFullUrl(messageId: string) {
  return useCommunityInvitationProps(messageId)?.fullUrl;
}

/**
 * Return the community display name to have a guess of what a community is about
 */
export function useMessageCommunityInvitationCommunityName(messageId: string) {
  return useCommunityInvitationProps(messageId)?.serverName;
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
  const props = useMessagePropsByMessageId(messageId);
  if (!props) {
    return null;
  }
  if (props.messageType !== 'call-notification') {
    throw new Error('useCommunityInvitationProps: messageType is not call-notification');
  }
  return props.propsForCallNotification?.notificationType;
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
  const props = useMessagePropsByMessageId(messageId);
  if (!props) {
    return null;
  }
  if (props.messageType !== 'data-extraction-notification') {
    throw new Error(
      'useMessageDataExtractionType: messageType is not data-extraction-notification'
    );
  }
  return props?.propsForDataExtractionNotification?.type;
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
  const props = useMessagePropsByMessageId(messageId);
  if (!props) {
    return null;
  }
  if (props.messageType !== 'interaction-notification') {
    throw new Error('useMessageDataExtractionType: messageType is not interaction-notification');
  }
  return props?.propsForInteractionNotification?.notificationType;
}

/**
 *  ================================================
 *  Below are selectors for expiration timer updates
 *  ================================================
 */

function useExpirationTimerUpdateProps(messageId: string | undefined) {
  const props = useMessagePropsByMessageId(messageId);
  if (!props) {
    return null;
  }
  if (props.messageType !== 'timer-update-notification') {
    throw new Error('useExpirationTimerUpdateProps: messageType is not timer-update-notification');
  }
  return props?.propsForTimerNotification;
}

/**
 * Return the expiration update mode linked to the specified message
 */
export function useMessageExpirationUpdateMode(messageId: string) {
  return useExpirationTimerUpdateProps(messageId)?.expirationMode || 'off';
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
  return useExpirationTimerUpdateProps(messageId)?.timespanSeconds;
}

/**
 * Return the timespan in text (localised) built from the field timespanSeconds
 */
export function useMessageExpirationUpdateTimespanText(messageId: string) {
  return useExpirationTimerUpdateProps(messageId)?.timespanText || '';
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
  const props = useMessagePropsByMessageId(messageId);
  if (!props) {
    return undefined;
  }
  if (props.messageType !== 'group-update-notification') {
    throw new Error('useExpirationTimerUpdateProps: messageType is not group-update-notification');
  }
  return props?.propsForGroupUpdateMessage?.change;
}
