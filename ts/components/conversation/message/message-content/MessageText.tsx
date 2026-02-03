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
  useSelectedIsPublic,
} from '../../../../state/selectors/selectedConversation';
import type { WithMessageId } from '../../../../session/types/with';
import { LucideIcon } from '../../../icon/LucideIcon';
import { LUCIDE_ICONS_UNICODE } from '../../../icon/lucide';
import { tr } from '../../../../localization/localeTools';
import { MessageBubble } from './MessageBubble';

type Props = WithMessageId;

const StyledMessageText = styled.div`
  white-space: pre-wrap;
`;

const StyledMessageDeleted = styled.div`
  display: flex;
  gap: var(--margins-xs);
  flex-direction: row;
  align-items: center;
`;

export const MessageText = ({ messageId }: Props) => {
  const multiSelectMode = useIsMessageSelectionMode();
  const direction = useMessageDirection(messageId);
  const isDeleted = useMessageIsDeleted(messageId);
  const text = useMessageText(messageId);
  const isOpenOrClosedGroup = useSelectedIsGroupOrCommunity();
  const isPublic = useSelectedIsPublic();
  const contents = isDeleted ? tr('deleteMessageDeletedGlobally') : text?.trim();

  if (!contents) {
    return null;
  }

  const iconColor =
    direction === 'incoming'
      ? 'var(--message-bubble-incoming-text-color)'
      : 'var(--message-bubble-outgoing-text-color)';

  if (isDeleted) {
    return (
      <StyledMessageDeleted>
        <LucideIcon
          unicode={LUCIDE_ICONS_UNICODE.TRASH2}
          iconSize="small"
          iconColor={iconColor}
          style={{ padding: '0 var(--margins-xs)' }}
        />
        {contents}
      </StyledMessageDeleted>
    );
  }

  return (
    <StyledMessageText dir="auto" className={clsx('module-message__text')}>
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
