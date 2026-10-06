import styled from 'styled-components';
import clsx from 'clsx';

import { MessageBody } from './MessageBody';
import {
  useMessageDirection,
  useMessageIsDeleted,
  useMessageIsUnsupported,
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
import { MessageBubble } from './MessageBubble';
import { MessageDeletedType } from '../../../../models/messageType';
import { tr } from '../../../../localization';
import { UNSUPPORTED_MESSAGE_PLACEHOLDER_TEXT } from '../../../../session/unsupported_messages/types';

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

// matches the muted italic placeholder on iOS and Android, so it doesn't read as an ordinary message
const StyledUnsupportedMessage = styled(StyledMessageDeleted)`
  font-style: italic;
  opacity: 0.7;
`;

export const MessageText = ({ messageId }: Props) => {
  const multiSelectMode = useIsMessageSelectionMode();
  const direction = useMessageDirection(messageId);
  const isDeleted = useMessageIsDeleted(messageId);
  const isUnsupported = useMessageIsUnsupported(messageId);
  const text = useMessageText(messageId);
  const isOpenOrClosedGroup = useSelectedIsGroupOrCommunity();
  const isPublic = useSelectedIsPublic();
  const contents = text?.trim();

  const iconColor =
    direction === 'incoming'
      ? 'var(--message-bubble-incoming-text-color)'
      : 'var(--message-bubble-outgoing-text-color)';

  if (isUnsupported) {
    return (
      <StyledUnsupportedMessage data-testid="unsupported-message">
        <LucideIcon
          unicode={LUCIDE_ICONS_UNICODE.CIRCLE_ALERT}
          iconSize="small"
          iconColor={iconColor}
          style={{ padding: '0 var(--margins-xs)' }}
        />
        {UNSUPPORTED_MESSAGE_PLACEHOLDER_TEXT}
      </StyledUnsupportedMessage>
    );
  }

  if (isDeleted) {
    return (
      <StyledMessageDeleted>
        <LucideIcon
          unicode={LUCIDE_ICONS_UNICODE.TRASH2}
          iconSize="small"
          iconColor={iconColor}
          style={{ padding: '0 var(--margins-xs)' }}
        />
        {isDeleted === MessageDeletedType.deletedGlobally
          ? tr('deleteMessageDeletedGlobally')
          : isDeleted === MessageDeletedType.deletedLocally
            ? tr('deleteMessageDeletedLocally')
            : null}
      </StyledMessageDeleted>
    );
  }

  if (!contents) {
    return null;
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
