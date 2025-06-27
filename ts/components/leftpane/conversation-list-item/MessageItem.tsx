import { isEmpty } from 'lodash';
import clsx from 'clsx';

import { useConvoIdFromContext } from '../../../contexts/ConvoIdContext';
import {
  useHasUnread,
  useIsPrivate,
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

export const MessageItem = () => {
  const conversationId = useConvoIdFromContext();
  const lastMessage = useLastMessage(conversationId);
  const isGroup = !useIsPrivate(conversationId);

  const hasUnread = useHasUnread(conversationId);
  const isConvoTyping = useIsTyping(conversationId);
  const isMessageRequest = useIsMessageRequestOverlayShown();

  const isSearching = useIsSearchingForType('global');

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
  const withoutHtmlTags = text.replaceAll(/(<([^>]+)>)/gi, '');

  return (
    <div className="module-conversation-list-item__message">
      <div
        className={clsx(
          'module-conversation-list-item__message__text',
          hasUnread ? 'module-conversation-list-item__message__text--has-unread' : null
        )}
      >
        {isConvoTyping ? (
          <TypingAnimation />
        ) : (
          <MessageBody
            text={withoutHtmlTags}
            disableJumbomoji={true}
            disableLinks={true}
            isGroup={isGroup}
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
          unicode={LUCIDE_ICONS_UNICODE.OCTAGON_ALERT}
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
