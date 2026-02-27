import { useLayoutEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import useKey from 'react-use/lib/useKey';
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

function isNotTextboxEvent(e: KeyboardEvent) {
  return (e?.target as any)?.type === undefined;
}

let previousRenderedConvo: string | undefined;

export const SessionMessagesList = (props: {
  scrollAfterLoadMore: (
    messageIdToScrollTo: string,
    type: 'load-more-top' | 'load-more-bottom'
  ) => void;
  onPageUpPressed: () => void;
  onPageDownPressed: () => void;
  onHomePressed: () => void;
  onEndPressed: () => void;
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
            <GenericReadableInteractableMessage key={messageId} messageId={messageId} />,
          ];
        })
        // TODO: check if we reverse this upstream, we might be reversing twice
        .toReversed()}
    </IsDetailMessageViewContext.Provider>
  );
};
