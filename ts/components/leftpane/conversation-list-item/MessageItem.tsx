import { isEmpty } from 'lodash';
import type { CSSProperties } from 'styled-components';

import { useConvoIdFromContext } from '../../../contexts/ConvoIdContext';
import {
  useHasUnread,
  useIsPrivate,
  useIsPublic,
  useIsTyping,
  useLastMessage,
} from '../../../hooks/useParamSelector';
import { LastMessageStatusType } from '../../../state/ducks/types';
import { useIsSearchingForType } from '../../../state/selectors/search';
import { useIsMessageRequestOverlayShown } from '../../../state/selectors/section';
import { assertUnreachable } from '../../../types/sqlSharedTypes';
import { TypingAnimation } from '../../conversation/TypingAnimation';
import { MessageBody } from '../../conversation/message/message-content/MessageBody';
import { InteractionItem } from './InteractionItem';
import { LucideIcon } from '../../icon/LucideIcon';
import { LUCIDE_ICONS_UNICODE } from '../../icon/lucide';
import { useSelectedConversationKey } from '../../../state/selectors/selectedConversation';

export function getStyleForMessageItemText(
  hasUnread: boolean,
  isSelectedConvo: boolean
): CSSProperties {
  return {
    flexGrow: 1,
    flexShrink: 1,

    fontSize: 'var(--font-size-sm)',

    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    color: 'var(--text-secondary-color)',
    userSelect: 'none',
    ...(hasUnread && {
      fontWeight: '400',
      color: 'var(--conversation-tab-text-unread-color)',
    }),
    ...(isSelectedConvo && {
      color: 'var(--conversation-tab-text-selected-color)',
    }),
  };
}

export const MessageItem = () => {
  const conversationId = useConvoIdFromContext();
  const lastMessage = useLastMessage(conversationId);
  const isGroup = !useIsPrivate(conversationId);
  const isPublic = useIsPublic(conversationId);

  const hasUnread = useHasUnread(conversationId);
  const isConvoTyping = useIsTyping(conversationId);
  const isMessageRequest = useIsMessageRequestOverlayShown();

  const isSearching = useIsSearchingForType('global');

  const isSelectedConvo = useSelectedConversationKey() === conversationId;

  if (lastMessage?.interactionType && lastMessage?.interactionStatus) {
    return <InteractionItem conversationId={conversationId} lastMessage={lastMessage} />;
  }

  if (!lastMessage && !isConvoTyping) {
    return null;
  }

  const text = lastMessage?.text || '';

  if (isEmpty(text)) {
    return null;
  }

  return (
    <div className="module-conversation-list-item__message">
      <div style={getStyleForMessageItemText(hasUnread, isSelectedConvo)}>
        {isConvoTyping ? (
          <TypingAnimation />
        ) : (
          <MessageBody
            text={text}
            disableJumbomoji={true}
            disableRichContent={true}
            isGroup={isGroup}
            isPublic={isPublic}
          />
        )}
      </div>
      {!isSearching && lastMessage && lastMessage.status && !isMessageRequest ? (
        <IconMessageStatus status={lastMessage.status} />
      ) : null}
    </div>
  );
};

function IconMessageStatus({ status }: { status: LastMessageStatusType }) {
  const nonErrorIconColor = 'var(--text-secondary-color)';
  switch (status) {
    case 'error':
      return (
        <LucideIcon
          unicode={LUCIDE_ICONS_UNICODE.TRIANGLE_ALERT}
          iconColor={'var(--danger-color)'}
          iconSize="small"
          style={{ flexShrink: 0 }}
        />
      );
    case 'read':
      return (
        <LucideIcon
          unicode={LUCIDE_ICONS_UNICODE.EYE}
          iconColor={nonErrorIconColor}
          iconSize="small"
          style={{ flexShrink: 0 }}
        />
      );
    case 'sending':
      return (
        <LucideIcon
          unicode={LUCIDE_ICONS_UNICODE.CIRCLE_ELLIPSES}
          iconColor={nonErrorIconColor}
          iconSize="small"
          style={{ flexShrink: 0 }}
        />
      );
    case 'sent':
      return (
        <LucideIcon
          unicode={LUCIDE_ICONS_UNICODE.CIRCLE_CHECK}
          iconColor={nonErrorIconColor}
          iconSize="small"
          style={{ flexShrink: 0 }}
        />
      );
    case undefined:
      return null;
    default:
      assertUnreachable(status, 'missing case error');
  }
}
