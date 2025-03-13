import { CallNotificationType } from '../../../../../state/ducks/types';

import { useSelectedNicknameOrProfileNameOrShortenedPubkey } from '../../../../../state/selectors/selectedConversation';
import { SessionIconType } from '../../../../icon';
import { ExpirableReadableMessage } from '../ExpirableReadableMessage';
import { NotificationBubble } from './NotificationBubble';
import { Localizer } from '../../../../basic/Localizer';
import { MergedLocalizerTokens } from '../../../../../localization/localeTools';
import type { WithMessageId } from '../../../../../session/types/with';
import { useMessageCallNotificationType } from '../../../../../state/selectors';

type StyleType = Record<
  CallNotificationType,
  { notificationTextKey: MergedLocalizerTokens; iconType: SessionIconType; iconColor: string }
>;

const style = {
  'missed-call': {
    notificationTextKey: 'callsMissedCallFrom',
    iconType: 'callMissed',
    iconColor: 'var(--danger-color)',
  },
  'started-call': {
    notificationTextKey: 'callsYouCalled',
    iconType: 'callOutgoing',
    iconColor: 'inherit',
  },
  'answered-a-call': {
    notificationTextKey: 'callsInProgress',
    iconType: 'callIncoming',
    iconColor: 'inherit',
  },
} satisfies StyleType;

export const CallNotification = (props: WithMessageId) => {
  const { messageId } = props;

  const notificationType = useMessageCallNotificationType(messageId);

  const name = useSelectedNicknameOrProfileNameOrShortenedPubkey() ?? window.i18n('unknown');

  if (!notificationType) {
    return null;
  }

  const { iconColor, iconType, notificationTextKey } = style[notificationType];

  return (
    <ExpirableReadableMessage
      messageId={messageId}
      key={`readable-message-${messageId}`}
      dataTestId={`call-notification-${notificationType}`}
      isControlMessage={true}
    >
      <NotificationBubble iconType={iconType} iconColor={iconColor}>
        {notificationTextKey === 'callsInProgress' ? (
          <Localizer token={notificationTextKey} />
        ) : (
          <Localizer token={notificationTextKey} args={{ name }} />
        )}
      </NotificationBubble>
    </ExpirableReadableMessage>
  );
};
