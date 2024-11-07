import { PropsForDataExtractionNotification } from '../../../../models/messageType';
import { SignalService } from '../../../../protobuf';
import { ExpirableReadableMessage } from './ExpirableReadableMessage';
import { NotificationBubble } from './notification-bubble/NotificationBubble';
import { Localizer } from '../../../basic/Localizer';

export const DataExtractionNotification = (props: PropsForDataExtractionNotification) => {
  const { name, type, source, messageId } = props;

  return (
    <ExpirableReadableMessage
      messageId={messageId}
      dataTestId="data-extraction-notification"
      key={`readable-message-${messageId}`}
      isControlMessage={true}
    >
      <NotificationBubble iconType="save">
        <Localizer
          token={
            type === SignalService.DataExtractionNotification.Type.MEDIA_SAVED
              ? 'attachmentsMediaSaved'
              : 'screenshotTaken'
          }
          args={{ name: name || source }}
        />
      </NotificationBubble>
    </ExpirableReadableMessage>
  );
};
