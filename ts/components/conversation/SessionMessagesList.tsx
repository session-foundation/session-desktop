import { RefObject, useLayoutEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';

import useKey from 'react-use/lib/useKey';
import styled from 'styled-components';
import {
  getOldBottomMessageId,
  getOldTopMessageId,
  getSortedMessagesTypesOfSelectedConversation,
  useFocusedMessageId,
} from '../../state/selectors/conversations';
import { useSelectedConversationKey } from '../../state/selectors/selectedConversation';
import { MessageDateBreak } from './message/message-item/DateBreak';

import { IsDetailMessageViewContext } from '../../contexts/isDetailViewContext';
import { SessionLastSeenIndicator } from './SessionLastSeenIndicator';
import { useKeyboardShortcut } from '../../hooks/useKeyboardShortcut';
import { KbdShortcut } from '../../util/keyboardShortcuts';
import { useMessageCopyText, useMessageReply } from '../../hooks/useMessageInteractions';
import { GenericReadableInteractableMessage } from './message/message-item/GenericReadableInteractableMessage';
import { StyledMessageBubble } from './message/message-content/MessageBubble';
import { StyledMentionAnother } from './AddMentions';
import { MessagesContainerRefContext } from '../../contexts/MessagesContainerRefContext';
import {
  ScrollToLoadedMessageContext,
  ScrollToLoadedReasons,
} from '../../contexts/ScrollToLoadedMessage';
import { TypingBubble } from './TypingBubble';
import { ReduxConversationType } from '../../state/ducks/conversations';
import { SessionScrollButton } from '../SessionScrollButton';
import { ConvoHub } from '../../session/conversations';
import { SessionMessageInteractables } from './SessionMessageInteractables';

const StyledMessagesContainer = styled.div`
  display: flex;
  gap: var(--margins-sm);
  flex-direction: column;
  justify-items: end;
  position: relative;
  overflow-x: hidden;
  scrollbar-width: 4px;
  padding-top: var(--margins-sm);
  padding-bottom: var(--margins-xl);
  padding-left: var(--margins-lg);
  padding-right: var(--margins-lg);

  .session-icon-button {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 40px;
    width: 40px;
    border-radius: 50%;
  }

  ${StyledMessageBubble} {
    user-select: text;
  }

  ${StyledMentionAnother} {
    user-select: all;
  }
`;

// NOTE Must always match the padding of the StyledReadableMessage
const StyledTypingBubbleContainer = styled.div`
  padding: var(--margins-xs) var(--margins-lg) 0;
`;

function isNotTextboxEvent(e: KeyboardEvent) {
  return (e?.target as any)?.type === undefined;
}

let previousRenderedConvo: string | undefined;

export const SessionMessagesListInner = (props: {
  scrollAfterLoadMore: (
    messageIdToScrollTo: string,
    type: 'load-more-top' | 'load-more-bottom'
  ) => void;
  onPageUpPressed: () => void;
  onPageDownPressed: () => void;
  onHomePressed: () => void;
  onEndPressed: () => void;
  convoReactionsEnabled?: boolean;
}) => {
  const messagesProps = useSelector(getSortedMessagesTypesOfSelectedConversation);
  const convoKey = useSelectedConversationKey();

  const [didScroll, setDidScroll] = useState(false);
  const oldTopMessageId = useSelector(getOldTopMessageId);
  const oldBottomMessageId = useSelector(getOldBottomMessageId);
  const focusedMessageId = useFocusedMessageId() ?? undefined;
  const reply = useMessageReply(focusedMessageId);
  const copyText = useMessageCopyText(focusedMessageId);

  useKeyboardShortcut({ shortcut: KbdShortcut.messageToggleReply, handler: reply, scopeId: 'all' });
  useKeyboardShortcut({ shortcut: KbdShortcut.messageCopyText, handler: copyText, scopeId: 'all' });

  useLayoutEffect(() => {
    const newTopMessageId = messagesProps.length
      ? messagesProps[messagesProps.length - 1].messageId
      : undefined;

    if (oldTopMessageId !== newTopMessageId && oldTopMessageId && newTopMessageId) {
      props.scrollAfterLoadMore(oldTopMessageId, 'load-more-top');
    }

    const newBottomMessageId = messagesProps.length ? messagesProps[0].messageId : undefined;

    if (newBottomMessageId !== oldBottomMessageId && oldBottomMessageId && newBottomMessageId) {
      props.scrollAfterLoadMore(oldBottomMessageId, 'load-more-bottom');
    }
  });

  useKey('PageUp', () => {
    props.onPageUpPressed();
  });

  useKey('PageDown', () => {
    props.onPageDownPressed();
  });

  useKey('Home', e => {
    if (isNotTextboxEvent(e)) {
      props.onHomePressed();
    }
  });

  useKey('End', e => {
    if (isNotTextboxEvent(e)) {
      props.onEndPressed();
    }
  });

  if (didScroll && previousRenderedConvo !== convoKey) {
    setDidScroll(false);
    previousRenderedConvo = convoKey;
  }

  return (
    <IsDetailMessageViewContext.Provider value={false}>
      {messagesProps
        .map(messageProps => {
          const { messageId } = messageProps;

          const unreadIndicator = messageProps.showUnreadIndicator ? (
            <SessionLastSeenIndicator
              key={'unread-indicator'}
              messageId={messageId}
              didScroll={didScroll}
              setDidScroll={setDidScroll}
            />
          ) : null;

          const dateBreak =
            messageProps.showDateBreak !== undefined ? (
              <MessageDateBreak
                key={`date-break-${messageId}`}
                timestamp={messageProps.showDateBreak}
                messageId={messageId}
              />
            ) : null;

          return [
            dateBreak,
            unreadIndicator,
            <GenericReadableInteractableMessage
              key={messageId}
              messageId={messageId}
              convoReactionsEnabled={props.convoReactionsEnabled}
            />,
          ];
        })
        // TODO: check if we reverse this upstream, we might be reversing twice
        .toReversed()}
    </IsDetailMessageViewContext.Provider>
  );
};

export const messageContainerDomID = 'messages-container';
export const messageContextMenuID = 'message-context-menu';
type SessionMessagesListProps = {
  messageContainerRef: RefObject<HTMLDivElement | null>;
  conversation: ReduxConversationType;
  scrollToLoadedMessage: (loadedMessageToScrollTo: string, reason: ScrollToLoadedReasons) => void;
  scrollToMessage: (messageId: string, reason: ScrollToLoadedReasons) => void;
  scrollToNow: () => Promise<unknown>;
  handleScroll: () => void;
  onPageUpPressed: () => void;
  onPageDownPressed: () => void;
  onHomePressed: () => void;
  onEndPressed: () => void;
};

export function SessionMessagesList({
  messageContainerRef,
  conversation,
  scrollToLoadedMessage,
  scrollToMessage,
  scrollToNow,
  handleScroll,
  onEndPressed,
  onHomePressed,
  onPageDownPressed,
  onPageUpPressed,
}: SessionMessagesListProps) {
  const convoReactionsEnabled = useMemo(() => {
    if (conversation.id) {
      const conversationModel = ConvoHub.use().get(conversation.id);
      if (conversationModel) {
        return conversationModel.hasReactions();
      }
    }
    return true;
  }, [conversation.id]);

  return (
    <MessagesContainerRefContext.Provider value={messageContainerRef}>
      <StyledMessagesContainer
        className="messages-container"
        id={messageContainerDomID}
        onScroll={handleScroll}
        ref={messageContainerRef}
        data-testid="messages-container"
      >
        <ScrollToLoadedMessageContext.Provider value={scrollToLoadedMessage}>
          <SessionMessagesListInner
            scrollAfterLoadMore={(
              messageIdToScrollTo: string,
              type: 'load-more-top' | 'load-more-bottom'
            ) => {
              scrollToMessage(messageIdToScrollTo, type);
            }}
            onPageDownPressed={onPageDownPressed}
            onPageUpPressed={onPageUpPressed}
            onHomePressed={onHomePressed}
            onEndPressed={onEndPressed}
            convoReactionsEnabled={convoReactionsEnabled}
          />
        </ScrollToLoadedMessageContext.Provider>
        <StyledTypingBubbleContainer>
          <TypingBubble
            conversationType={conversation.type}
            isTyping={!!conversation.isTyping}
            key="typing-bubble"
          />
        </StyledTypingBubbleContainer>
      </StyledMessagesContainer>
      <SessionScrollButton onClickScrollBottom={scrollToNow} key="scroll-down-button" />
      <SessionMessageInteractables
        contextMenuId={messageContextMenuID}
        convoReactionsEnabled={convoReactionsEnabled}
      />
    </MessagesContainerRefContext.Provider>
  );
}
