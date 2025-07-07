import styled from 'styled-components';
import clsx from 'clsx';

import { SessionIcon } from '../../../icon';
import { MessageBody } from './MessageBody';
import {
  useMessageDirection,
  useMessageIsDeleted,
  useMessageText,
} from '../../../../state/selectors';
import {
  useIsMessageSelectionMode,
  useSelectedIsGroupOrCommunity,
  useSelectedIsPublic,
} from '../../../../state/selectors/selectedConversation';
import type { WithMessageId } from '../../../../session/types/with';
import { localize } from '../../../../localization/localeTools';
import { MessageBubble } from './MessageBubble';

type Props = WithMessageId;

const StyledMessageText = styled.div<{ isDeleted?: boolean }>`
  white-space: pre-wrap;

  svg {
    margin-inline-end: var(--margins-xs);
  }

  ${({ isDeleted }) =>
    isDeleted &&
    `
    display: flex;
    align-items: center;
    `}
`;

export const MessageText = ({ messageId }: Props) => {
  const multiSelectMode = useIsMessageSelectionMode();
  const direction = useMessageDirection(messageId);
  const isDeleted = useMessageIsDeleted(messageId);
  const text = useMessageText(messageId);
  const isOpenOrClosedGroup = useSelectedIsGroupOrCommunity();
  const isPublic = useSelectedIsPublic();
  const contents = isDeleted ? localize('deleteMessageDeletedGlobally').toString() : text?.trim();

  if (!contents) {
    return null;
  }

  const iconColor =
    direction === 'incoming'
      ? 'var(--message-bubbles-received-text-color)'
      : 'var(--message-bubbles-sent-text-color)';

  return (
    <StyledMessageText dir="auto" className={clsx('module-message__text')} isDeleted={isDeleted}>
      {isDeleted && <SessionIcon iconType="delete" iconSize="small" iconColor={iconColor} />}
      <MessageBubble>
        <MessageBody
          text={contents || ''}
          disableRichContent={multiSelectMode}
          disableJumbomoji={false}
          isGroup={isOpenOrClosedGroup}
          isPublic={isPublic}
        />
      </MessageBubble>
    </StyledMessageText>
  );
};
