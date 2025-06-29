import styled from 'styled-components';
import clsx from 'clsx';

import { MessageBody } from './MessageBody';
import {
  useMessageDirection,
  useMessageIsDeleted,
  useMessageText,
} from '../../../../state/selectors';
import {
  useIsMessageSelectionMode,
  useSelectedIsGroupOrCommunity,
} from '../../../../state/selectors/selectedConversation';
import type { WithMessageId } from '../../../../session/types/with';
import { LucideIcon } from '../../../icon/LucideIcon';
import { LUCIDE_ICONS_UNICODE } from '../../../icon/lucide';

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
  const contents = isDeleted ? window.i18n('deleteMessageDeletedGlobally') : text?.trim();

  if (!contents) {
    return null;
  }

  const iconColor =
    direction === 'incoming'
      ? 'var(--message-bubbles-received-text-color)'
      : 'var(--message-bubbles-sent-text-color)';

  return (
    <StyledMessageText dir="auto" className={clsx('module-message__text')} isDeleted={isDeleted}>
      {isDeleted && (
        <LucideIcon
          unicode={LUCIDE_ICONS_UNICODE.TRASH2}
          iconSize="small"
          iconColor={iconColor}
          style={{ padding: '0 var(--margins-xs)' }}
        />
      )}
      <MessageBody
        text={contents || ''}
        disableLinks={multiSelectMode}
        disableJumbomoji={false}
        isGroup={isOpenOrClosedGroup}
      />
    </StyledMessageText>
  );
};
