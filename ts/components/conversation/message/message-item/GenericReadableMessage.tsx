import type { HTMLProps } from 'react';
import clsx from 'clsx';
import styled, { keyframes } from 'styled-components';
import { MessageRenderingProps } from '../../../../models/messageType';
import {
  useMessageDirectionIncoming,
  useMessageIsControlMessage,
  useMessageType,
} from '../../../../state/selectors';
import { MessageContentWithStatuses } from '../message-content/MessageContentWithStatus';
import { StyledMessageReactionsContainer } from '../message-content/MessageReactions';
import { type UIMessageType } from '../../../../state/ducks/conversations';
import type { WithMessageId } from '../../../../session/types/with';
import { CommunityInvitation } from './CommunityInvitation';
import { DataExtractionNotification } from './DataExtractionNotification';
import { TimerNotification } from '../../TimerNotification';
import { GroupUpdateMessage } from './GroupUpdateMessage';
import { CallNotification } from './notification-bubble/CallNotification';
import { InteractionNotification } from './InteractionNotification';
import { MessageRequestResponse } from './MessageRequestResponse';
import { useIsDetailMessageView } from '../../../../contexts/isDetailViewContext';

export type GenericReadableMessageSelectorProps = Pick<
  MessageRenderingProps,
  'direction' | 'convoId' | 'isKickedFromGroup'
>;

const highlightedMessageAnimation = keyframes`
  1% { background-color: var(--primary-color); }
`;

type StyledReadableMessageProps = {
  selected?: boolean;
  // TODO: remove this, we can add styles to the message list
  $isDetailView?: boolean;
  $focusedKeyboard?: boolean;
  $forceFocusStyle?: boolean;
  $isIncoming?: boolean;
  $isControlMessage?: boolean;
};

const StyledReadableMessage = styled.div<StyledReadableMessageProps>`
  display: flex;
  flex-direction: column;
  align-items: ${props => (props.$isIncoming ? 'flex-start' : 'flex-end')};
  width: 100%;
  letter-spacing: 0.03rem;
  padding-left: ${props =>
    props.$isDetailView || props.$isIncoming || props.$isControlMessage ? 0 : '25%'};
  padding-right: ${props =>
    props.$isDetailView || !props.$isIncoming || props.$isControlMessage ? 0 : '25%'};

  &.message-highlighted {
    animation: ${highlightedMessageAnimation} var(--duration-message-highlight) ease-in-out;
  }

  ${StyledMessageReactionsContainer} {
    margin-top: var(--margins-xs);
  }

  ${props =>
    props.$focusedKeyboard
      ? `&:focus-visible {
    background-color: var(--conversation-tab-background-selected-color);
  }`
      : ''}

  ${props =>
    props.$forceFocusStyle
      ? 'background-color: var(--conversation-tab-background-selected-color);'
      : ''}
`;

function getMessageComponent(messageType: UIMessageType) {
  switch (messageType) {
    case 'community-invitation':
      return CommunityInvitation;
    case 'data-extraction-notification':
      return DataExtractionNotification;
    case 'timer-update-notification':
      return TimerNotification;
    case 'group-update-notification':
      return GroupUpdateMessage;
    case 'call-notification':
      return CallNotification;
    case 'interaction-notification':
      return InteractionNotification;
    case 'message-request-response':
      return MessageRequestResponse;
    case 'regular-message':
      return MessageContentWithStatuses;
    default:
      return null;
  }
}

type GenericReadableMessageProps = Partial<
  HTMLProps<HTMLDivElement> & Omit<StyledReadableMessageProps, '$isDetailView'> & WithMessageId
>;

export const GenericReadableMessage = ({
  ref,
  messageId,
  selected,
  children,
  ...rest
}: GenericReadableMessageProps) => {
  const messageType = useMessageType(messageId);
  const isDetailView = useIsDetailMessageView();
  const isControlMessage = useMessageIsControlMessage(messageId);
  const isIncoming = useMessageDirectionIncoming(messageId, isDetailView);

  if (!messageId || !messageType) {
    return null;
  }

  const CmpToRender = getMessageComponent(messageType);

  if (!CmpToRender) {
    throw new Error(`Couldn't find a component for message type ${messageType}`);
  }

  return (
    <StyledReadableMessage
      ref={ref}
      className={clsx(selected ? 'message-selected' : undefined)}
      selected={selected}
      $isIncoming={isIncoming}
      $isControlMessage={isControlMessage}
      {...rest}
      $isDetailView={isDetailView}
    >
      <CmpToRender messageId={messageId} />
      {children}
    </StyledReadableMessage>
  );
};
