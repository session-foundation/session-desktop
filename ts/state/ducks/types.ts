import {
  ConversationInteractionStatus,
  ConversationInteractionType,
} from '../../interactions/types';

export type CallNotificationType = 'missed-call' | 'started-call' | 'answered-a-call';

export type PropsForCallNotification = {
  messageId: string;
  notificationType: CallNotificationType;
};

export type PropsForMessageRequestResponse = {
  // keeping this an object in case we need to add some details here
};

export type LastMessageStatusType = 'sending' | 'sent' | 'read' | 'error' | undefined;

export type LastMessageType = {
  status: LastMessageStatusType;
  text: string | null;
  interactionType: ConversationInteractionType | null;
  interactionStatus: ConversationInteractionStatus | null;
};

export type InteractionNotificationType = {
  interactionType: ConversationInteractionType;
  interactionStatus: ConversationInteractionStatus;
};

export type PropsForInteractionNotification = {
  notificationType: InteractionNotificationType;
};
