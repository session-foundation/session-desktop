import { ExpirableReadableMessage } from './ExpirableReadableMessage';
import { NotificationBubble } from './notification-bubble/NotificationBubble';
import { Localizer } from '../../../basic/Localizer';
import { useMessageAuthor, useMessageDataExtractionType } from '../../../../state/selectors';
import { useConversationUsernameWithFallback } from '../../../../hooks/useParamSelector';
import type { WithContextMenuId, WithMessageId } from '../../../../session/types/with';
import { SignalService } from '../../../../protobuf';
import { LUCIDE_ICONS_UNICODE } from '../../../icon/lucide';
import type { WithPopoverPosition, WithSetPopoverPosition } from '../../../SessionTooltip';

export const DataExtractionNotification = (
  props: WithMessageId & WithPopoverPosition & WithSetPopoverPosition & WithContextMenuId
) => {
  const { messageId } = props;
  const author = useMessageAuthor(messageId);
  const authorName = useConversationUsernameWithFallback(true, author);

  const dataExtractionType = useMessageDataExtractionType(messageId);

  if (!author || !dataExtractionType) {
    return null;
  }

  return (
    <ExpirableReadableMessage
      messageId={messageId}
      contextMenuId={props.contextMenuId}
      setTriggerPosition={props.setTriggerPosition}
      dataTestId="data-extraction-notification"
      key={`readable-message-${messageId}`}
    >
      <NotificationBubble unicode={LUCIDE_ICONS_UNICODE.ARROW_DOWN_TO_LINE}>
        <Localizer
          token={
            dataExtractionType === SignalService.DataExtractionNotification.Type.MEDIA_SAVED
              ? 'attachmentsMediaSaved'
              : 'screenshotTaken'
          }
          name={authorName}
        />
      </NotificationBubble>
    </ExpirableReadableMessage>
  );
};
