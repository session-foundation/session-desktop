import { ExpirableReadableMessage } from './ExpirableReadableMessage';
import { NotificationBubble } from './notification-bubble/NotificationBubble';
import { Localizer } from '../../../basic/Localizer';
import { useMessageAuthor, useMessageDataExtractionType } from '../../../../state/selectors';
import { useNicknameOrProfileNameOrShortenedPubkey } from '../../../../hooks/useParamSelector';
import type { WithMessageId } from '../../../../session/types/with';
import { SignalService } from '../../../../protobuf';
import { LUCIDE_ICONS_UNICODE } from '../../../icon/lucide';

export const DataExtractionNotification = (props: WithMessageId) => {
  const { messageId } = props;
  const author = useMessageAuthor(messageId);
  const authorName = useNicknameOrProfileNameOrShortenedPubkey(author);

  const dataExtractionType = useMessageDataExtractionType(messageId);

  if (!author || !dataExtractionType) {
    return null;
  }

  return (
    <ExpirableReadableMessage
      messageId={messageId}
      dataTestId="data-extraction-notification"
      key={`readable-message-${messageId}`}
      isControlMessage={true}
    >
      <NotificationBubble unicode={LUCIDE_ICONS_UNICODE.DOWNLOAD}>
        <Localizer
          token={
            dataExtractionType === SignalService.DataExtractionNotification.Type.MEDIA_SAVED
              ? 'attachmentsMediaSaved'
              : 'screenshotTaken'
          }
          args={{ name: authorName }}
        />
      </NotificationBubble>
    </ExpirableReadableMessage>
  );
};
