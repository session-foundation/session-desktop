import { SessionDataTestId } from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';
import { useMessageExpirationPropsById } from '../../../../hooks/useParamSelector';
import { useMessageStatus } from '../../../../state/selectors';

import { useIsDetailMessageView } from '../../../../contexts/isDetailViewContext';
import { getMostRecentOutgoingMessageId } from '../../../../state/selectors/conversations';
import { useSelectedIsGroupOrCommunity } from '../../../../state/selectors/selectedConversation';
import { SpacerXS } from '../../../basic/Text';
import { ExpireTimer } from '../../ExpireTimer';
import { saveLogToDesktop } from '../../../../util/logger/renderer_process_logging';
import { LUCIDE_ICONS_UNICODE, type WithLucideUnicode } from '../../../icon/lucide';
import { LucideIcon } from '../../../icon/LucideIcon';
import { tr } from '../../../../localization/localeTools';

type Props = {
  messageId: string;
  dataTestId: SessionDataTestId;
};

/**
 * MessageStatus is used to display the status of an outgoing OR incoming message.
 * There are 3 parts to this status: a status text, a status icon and a expiring stopwatch.
 * At all times, we either display `text + icon` OR `text + stopwatch`.
 *
 * The logic to display the text is :
 *   - if the message is expiring:
 *        - if the message is incoming: display its 'read' state and the stopwatch icon (1)
 *        - if the message is outgoing: display its status and the stopwatch, unless when the status is error or sending (just display icon and text in this case, no stopwatch) (2)
 *   - if the message is not expiring:
 *        - if the message is incoming: do not show anything (3)
 *        - if the message is outgoing: show the text for the last message, or a message sending, or in the error state. (4)
 */
export const MessageStatus = ({ messageId, dataTestId }: Props) => {
  const isDetailView = useIsDetailMessageView();

  const status = useMessageStatus(messageId);
  const selected = useMessageExpirationPropsById(messageId);

  if (!messageId || !selected || isDetailView) {
    return null;
  }
  const isIncoming = selected.direction === 'incoming';

  if (isIncoming) {
    if (selected.isUnread || !selected.expirationDurationMs || !selected.expirationTimestamp) {
      return null; // incoming and not expiring, this is case (3) above
    }
    // incoming and  expiring, this is case (1) above
    return <MessageStatusRead dataTestId={dataTestId} messageId={messageId} isIncoming={true} />;
  }

  switch (status) {
    case 'sending':
      return <MessageStatusSending dataTestId={dataTestId} messageId={messageId} />; // we always show sending state
    case 'sent':
      return <MessageStatusSent dataTestId={dataTestId} messageId={messageId} />;
    case 'read':
      return <MessageStatusRead dataTestId={dataTestId} messageId={messageId} isIncoming={false} />; // read is used for both incoming and outgoing messages, but not with the same UI
    case 'error':
      return <MessageStatusError dataTestId={dataTestId} messageId={messageId} />; // we always show error state
    default:
      return null;
  }
};

const MessageStatusContainer = styled.div<{
  isIncoming: boolean;
  isGroup: boolean;
  clickable: boolean;
}>`
  display: inline-block;
  align-self: ${props => (props.isIncoming ? 'flex-start' : 'flex-end')};
  flex-direction: ${props =>
    props.isIncoming
      ? 'row-reverse'
      : 'row'}; // we want {icon}{text} for incoming read messages, but {text}{icon} for outgoing messages

  margin-bottom: 2px;
  margin-inline-start: 5px;
  cursor: ${props => (props.clickable ? 'pointer' : 'inherit')};
  display: flex;
  align-items: center;
  margin-inline-start: ${props =>
    props.isGroup || !props.isIncoming ? 'var(--width-avatar-group-msg-list)' : 0};
`;

const StyledStatusText = styled.div<{ $textColor: string }>`
  font-size: small;
  color: ${props => props.$textColor};
`;

const TextDetails = ({ text, textColor }: { text: string; textColor: string }) => {
  return (
    <>
      <StyledStatusText $textColor={textColor}>{text}</StyledStatusText>
      <SpacerXS />
    </>
  );
};

function IconNormal({ unicode }: WithLucideUnicode) {
  return (
    <LucideIcon iconColor={'var(--text-secondary-color)'} unicode={unicode} iconSize="small" />
  );
}

function useIsExpiring(messageId: string) {
  const selected = useMessageExpirationPropsById(messageId);
  return (
    selected && selected.expirationDurationMs && selected.expirationTimestamp && !selected.isExpired
  );
}

function useIsMostRecentOutgoingMessage(messageId: string) {
  const mostRecentOutgoingMessageId = useSelector(getMostRecentOutgoingMessageId);
  return mostRecentOutgoingMessageId === messageId;
}

function MessageStatusExpireTimer(props: Pick<Props, 'messageId'>) {
  const selected = useMessageExpirationPropsById(props.messageId);
  if (
    !selected ||
    !selected.expirationDurationMs ||
    !selected.expirationTimestamp ||
    selected.isExpired
  ) {
    return null;
  }
  return (
    <ExpireTimer
      expirationDurationMs={selected.expirationDurationMs}
      expirationTimestamp={selected.expirationTimestamp}
    />
  );
}

const MessageStatusSending = ({ dataTestId }: Omit<Props, 'isDetailView'>) => {
  // while sending, we do not display the expire timer at all.
  return (
    <MessageStatusContainer
      data-testid={dataTestId}
      data-testtype="sending"
      isIncoming={false}
      isGroup={false}
      clickable={false}
    >
      <TextDetails text={tr('sending')} textColor="var(--text-secondary-color)" />
      <IconNormal unicode={LUCIDE_ICONS_UNICODE.CIRCLE_ELLIPSES} />
    </MessageStatusContainer>
  );
};

/**
 * Returns the correct expiring stopwatch icon if this message is expiring, or a normal status icon otherwise.
 * Only to be used with the status "read" and "sent"
 */
function IconForExpiringMessageId({
  messageId,
  unicode,
}: Pick<Props, 'messageId'> & WithLucideUnicode) {
  const isExpiring = useIsExpiring(messageId);

  return isExpiring ? (
    <MessageStatusExpireTimer messageId={messageId} />
  ) : (
    <IconNormal unicode={unicode} />
  );
}

const MessageStatusSent = ({ dataTestId, messageId }: Omit<Props, 'isDetailView'>) => {
  const isExpiring = useIsExpiring(messageId);
  const isMostRecentOutgoingMessage = useIsMostRecentOutgoingMessage(messageId);
  const isGroup = useSelectedIsGroupOrCommunity();

  // we hide the "sent" message status for a non-expiring messages unless it's the most recent outgoing message
  if (!isExpiring && !isMostRecentOutgoingMessage) {
    return null;
  }
  return (
    <MessageStatusContainer
      data-testid={dataTestId}
      data-testtype="sent"
      isIncoming={false}
      isGroup={isGroup}
      clickable={false}
    >
      <TextDetails text={tr('disappearingMessagesSent')} textColor="var(--text-secondary-color)" />
      <IconForExpiringMessageId messageId={messageId} unicode={LUCIDE_ICONS_UNICODE.CHECK} />
    </MessageStatusContainer>
  );
};

const MessageStatusRead = ({
  dataTestId,
  messageId,
  isIncoming,
}: Omit<Props, 'isDetailView'> & { isIncoming: boolean }) => {
  const isExpiring = useIsExpiring(messageId);
  const isGroup = useSelectedIsGroupOrCommunity();

  const isMostRecentOutgoingMessage = useIsMostRecentOutgoingMessage(messageId);

  // we hide an outgoing "read" message status which is not expiring except for the most recent message
  if (!isIncoming && !isExpiring && !isMostRecentOutgoingMessage) {
    return null;
  }

  return (
    <MessageStatusContainer
      data-testid={dataTestId}
      data-testtype="read"
      isIncoming={isIncoming}
      isGroup={isGroup}
      clickable={false}
    >
      <TextDetails text={tr('read')} textColor="var(--text-secondary-color)" />
      <IconForExpiringMessageId messageId={messageId} unicode={LUCIDE_ICONS_UNICODE.EYE} />
    </MessageStatusContainer>
  );
};

const MessageStatusError = ({ dataTestId }: Omit<Props, 'isDetailView'>) => {
  // when on error, we do not display the expire timer at all.
  const isGroup = useSelectedIsGroupOrCommunity();

  return (
    <MessageStatusContainer
      data-testid={dataTestId}
      data-testtype="failed"
      title={tr('messageStatusFailedToSend')}
      onClick={() => {
        void saveLogToDesktop();
      }}
      isIncoming={false}
      clickable={true}
      isGroup={isGroup}
    >
      <TextDetails text={tr('messageStatusFailedToSend')} textColor="var(--danger-color)" />
      <LucideIcon
        unicode={LUCIDE_ICONS_UNICODE.TRIANGLE_ALERT}
        iconColor="var(--danger-color)"
        iconSize="small"
      />
    </MessageStatusContainer>
  );
};
