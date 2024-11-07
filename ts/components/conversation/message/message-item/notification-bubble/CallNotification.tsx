import { CallNotificationType, PropsForCallNotification } from '../../../../../state/ducks/types';

import { useSelectedNicknameOrProfileNameOrShortenedPubkey } from '../../../../../state/selectors/selectedConversation';
import type { LocalizerToken } from '../../../../../types/localizer';
import { SessionIconType } from '../../../../icon';
import { ExpirableReadableMessage } from '../ExpirableReadableMessage';
import { NotificationBubble } from './NotificationBubble';
import { Localizer } from '../../../../basic/Localizer';

type StyleType = Record<
  CallNotificationType,
  { notificationTextKey: LocalizerToken; iconType: SessionIconType; iconColor: string }
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

export const CallNotification = (props: PropsForCallNotification) => {
  const { messageId, notificationType } = props;

  const name = useSelectedNicknameOrProfileNameOrShortenedPubkey() ?? window.i18n('unknown');

  const { iconColor, iconType, notificationTextKey } = style[notificationType];

  return (
    <ExpirableReadableMessage
      messageId={messageId}
      key={`readable-message-${messageId}`}
      dataTestId={`call-notification-${notificationType}`}
      isControlMessage={true}
    >
      <NotificationBubble iconType={iconType} iconColor={iconColor}>
        <Localizer token={notificationTextKey} args={{ name }} />
      </NotificationBubble>
    </ExpirableReadableMessage>
  );
};
