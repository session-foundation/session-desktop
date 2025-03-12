import { ConversationInteractionStatus, ConversationInteractionType } from '../interactions/types';
import { ConvoHub } from '../session/conversations';
import { InteractionNotificationType } from '../state/ducks/types';
import { assertUnreachable } from '../types/sqlSharedTypes';

function formatInteractionNotification(
  interactionNotification: InteractionNotificationType,
  conversationId: string
) {
  const { interactionType, interactionStatus } = interactionNotification;

  // NOTE For now we only show interaction errors in the message history
  if (interactionStatus === ConversationInteractionStatus.Error) {
    const convo = ConvoHub.use().get(conversationId);

    if (convo) {
      const isGroup = !convo.isPrivate();
      const isCommunity = convo.isPublic();
      const conversationName = convo?.getRealSessionUsername() || window.i18n('unknown');

      switch (interactionType) {
        case ConversationInteractionType.Hide:
          // there is no text for hiding changes
          return '';
        case ConversationInteractionType.Leave:
          return isCommunity
            ? window.i18n('communityLeaveError', { community_name: conversationName })
            : isGroup
              ? window.i18n('groupLeaveErrorFailed', { group_name: conversationName })
              : null;
        default:
          assertUnreachable(
            interactionType,
            `Message.getDescription: Missing case error "${interactionType}"`
          );
      }
    }
  }

  window.log.error('formatInteractionNotification: Unsupported case');
  return null;
}

export const FormatNotifications = {
  formatInteractionNotification,
};
