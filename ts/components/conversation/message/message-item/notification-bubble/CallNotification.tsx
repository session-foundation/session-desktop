import { CallNotificationType } from '../../../../../state/ducks/types';

import { useSelectedNicknameOrProfileNameOrShortenedPubkey } from '../../../../../state/selectors/selectedConversation';
import { ExpirableReadableMessage } from '../ExpirableReadableMessage';
import { NotificationBubble } from './NotificationBubble';
import { Localizer } from '../../../../basic/Localizer';
import { MergedLocalizerTokens } from '../../../../../localization/localeTools';
import type { WithMessageId } from '../../../../../session/types/with';
import { useMessageCallNotificationType } from '../../../../../state/selectors';
import { LUCIDE_ICONS_UNICODE } from '../../../../icon/lucide';

type StyleType = Record<
  CallNotificationType,
  { notificationTextKey: MergedLocalizerTokens; unicode: LUCIDE_ICONS_UNICODE; iconColor: string }
>;

const style = {
  'missed-call': {
    notificationTextKey: 'callsMissedCallFrom',
    unicode: LUCIDE_ICONS_UNICODE.PHONE_MISSED,
    iconColor: 'var(--danger-color)',
  },
  'started-call': {
    notificationTextKey: 'callsYouCalled',
    unicode: LUCIDE_ICONS_UNICODE.PHONE_OUTGOING,
    iconColor: 'inherit',
  },
  'answered-a-call': {
    notificationTextKey: 'callsInProgress',
    unicode: LUCIDE_ICONS_UNICODE.PHONE_INCOMING,
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

  const { iconColor, unicode, notificationTextKey } = style[notificationType];

  return (
    <ExpirableReadableMessage
      messageId={messageId}
      key={`readable-message-${messageId}`}
      dataTestId={`call-notification-${notificationType}`}
      isControlMessage={true}
    >
      <NotificationBubble unicode={unicode} iconColor={iconColor}>
        {notificationTextKey === 'callsInProgress' ? (
          <Localizer token={notificationTextKey} />
        ) : (
          <Localizer token={notificationTextKey} args={{ name }} />
        )}
      </NotificationBubble>
    </ExpirableReadableMessage>
  );
};
