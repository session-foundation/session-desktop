import { isEmpty } from 'lodash';
import clsx from 'clsx';

import { useConvoIdFromContext } from '../../../contexts/ConvoIdContext';
import {
  useHasUnread,
  useIsOutgoingRequest,
  useIsPrivate,
  useIsTyping,
  useLastMessage,
} from '../../../hooks/useParamSelector';
import { LastMessageStatusType } from '../../../state/ducks/types';
import { useIsSearching } from '../../../state/selectors/search';
import { useIsMessageRequestOverlayShown } from '../../../state/selectors/section';
import { assertUnreachable } from '../../../types/sqlSharedTypes';
import { TypingAnimation } from '../../conversation/TypingAnimation';
import { MessageBody } from '../../conversation/message/message-content/MessageBody';
import { SessionIcon } from '../../icon';
import { InteractionItem } from './InteractionItem';

export const MessageItem = () => {
  const conversationId = useConvoIdFromContext();
  const lastMessage = useLastMessage(conversationId);
  const isGroup = !useIsPrivate(conversationId);

  const hasUnread = useHasUnread(conversationId);
  const isConvoTyping = useIsTyping(conversationId);
  const isMessageRequest = useIsMessageRequestOverlayShown();
  const isOutgoingRequest = useIsOutgoingRequest(conversationId);

  const isSearching = useIsSearching();

  if (isOutgoingRequest) {
    return null;
  }

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
  const nonErrorIconColor = 'var(--text-secondary-color';
  switch (status) {
    case 'error':
      return (
        <SessionIcon
          iconColor={'var(--danger-color'}
          iconType="error"
          iconSize="tiny"
          style={{ flexShrink: 0 }}
        />
      );
    case 'read':
      return (
        <SessionIcon
          iconColor={nonErrorIconColor}
          iconType="doubleCheckCircleFilled"
          iconSize="tiny"
          style={{ flexShrink: 0 }}
        />
      );
    case 'sending':
      return (
        <SessionIcon
          rotateDuration={2}
          iconColor={nonErrorIconColor}
          iconType="sending"
          iconSize="tiny"
          style={{ flexShrink: 0 }}
        />
      );
    case 'sent':
      return (
        <SessionIcon
          iconColor={nonErrorIconColor}
          iconType="circleCheck"
          iconSize="tiny"
          style={{ flexShrink: 0 }}
        />
      );
    case undefined:
      return null;
    default:
      assertUnreachable(status, 'missing case error');
  }
}
