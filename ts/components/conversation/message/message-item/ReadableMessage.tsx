import { debounce, noop } from 'lodash';
import {
  SessionDataTestId,
  AriaRole,
  MouseEvent,
  MouseEventHandler,
  ReactNode,
  useCallback,
  useLayoutEffect,
  useState,
} from 'react';
import { InView } from 'react-intersection-observer';
import { useDispatch, useSelector } from 'react-redux';
import { useScrollToLoadedMessage } from '../../../../contexts/ScrollToLoadedMessage';
import { Data } from '../../../../data/data';
import { useHasUnread } from '../../../../hooks/useParamSelector';
import { ConvoHub } from '../../../../session/conversations';
import {
  fetchBottomMessagesForConversation,
  fetchTopMessagesForConversation,
  markConversationFullyRead,
  showScrollToBottomButton,
} from '../../../../state/ducks/conversations';
import {
  areMoreMessagesBeingFetched,
  getMostRecentMessageId,
  getOldestMessageId,
  getQuotedMessageToAnimate,
  getShowScrollButton,
  getYoungestMessageId,
} from '../../../../state/selectors/conversations';
import { getIsAppFocused } from '../../../../state/selectors/section';
import { useSelectedConversationKey } from '../../../../state/selectors/selectedConversation';
import type { WithConvoId, WithMessageId } from '../../../../session/types/with';

export type ReadableMessageProps = {
  children: ReactNode;
  messageId: string;
  className?: string;
  isUnread: boolean;
  onClick?: MouseEventHandler<HTMLElement>;
  onDoubleClickCapture?: MouseEventHandler<HTMLElement>;
  dataTestId: SessionDataTestId;
  role?: AriaRole;
  onContextMenu?: (e: MouseEvent<HTMLElement>) => void;
  isControlMessage?: boolean;
};

const debouncedTriggerLoadMoreTop = debounce(
  (selectedConversationKey: string, oldestMessageId: string) => {
    (window.inboxStore?.dispatch as any)(
      fetchTopMessagesForConversation({
        conversationKey: selectedConversationKey,
        oldTopMessageId: oldestMessageId,
      })
    );
  },
  100
);

const debouncedTriggerLoadMoreBottom = debounce(
  (selectedConversationKey: string, youngestMessageId: string) => {
    (window.inboxStore?.dispatch as any)(
      fetchBottomMessagesForConversation({
        conversationKey: selectedConversationKey,
        oldBottomMessageId: youngestMessageId,
      })
    );
  },
  100
);

async function markReadFromMessageId({
  conversationId,
  messageId,
  isUnread,
}: WithMessageId & WithConvoId & { isUnread: boolean }) {
  // isUnread comes from the redux store in memory, so pretty fast and allows us to not fetch from the DB too often
  if (!isUnread) {
    return;
  }
  const found = await Data.getMessageById(messageId);

  if (!found) {
    return;
  }

  if (found.isUnread()) {
    ConvoHub.use()
      .get(conversationId)
      ?.markConversationRead({
        newestUnreadDate: found.get('sent_at') || found.get('serverTimestamp') || Date.now(),
        fromConfigMessage: false,
      });
  }
}

export const ReadableMessage = (props: ReadableMessageProps) => {
  const {
    messageId,
    onContextMenu,
    className,
    isUnread,
    onClick,
    onDoubleClickCapture,
    role,
    dataTestId,
  } = props;

  const isAppFocused = useSelector(getIsAppFocused);
  const dispatch = useDispatch();

  const selectedConversationKey = useSelectedConversationKey();
  const mostRecentMessageId = useSelector(getMostRecentMessageId);
  const oldestMessageId = useSelector(getOldestMessageId);
  const youngestMessageId = useSelector(getYoungestMessageId);
  const fetchingMoreInProgress = useSelector(areMoreMessagesBeingFetched);
  const conversationHasUnread = useHasUnread(selectedConversationKey);
  const scrollButtonVisible = useSelector(getShowScrollButton);

  const [didScroll, setDidScroll] = useState(false);
  const quotedMessageToAnimate = useSelector(getQuotedMessageToAnimate);

  const scrollToLoadedMessage = useScrollToLoadedMessage();

  // if this unread-indicator is rendered,
  // we want to scroll here only if the conversation was not opened to a specific message
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (
      props.messageId === youngestMessageId &&
      !quotedMessageToAnimate &&
      !scrollButtonVisible &&
      !didScroll &&
      !conversationHasUnread
    ) {
      scrollToLoadedMessage(props.messageId, 'go-to-bottom');
      setDidScroll(true);
    } else if (quotedMessageToAnimate) {
      setDidScroll(true);
    }
  });

  const onVisible = useCallback(
    async (inView: boolean, _: IntersectionObserverEntry) => {
      if (!selectedConversationKey) {
        return;
      }
      // we are the most recent message
      if (mostRecentMessageId === messageId) {
        // make sure the app is focused, because we mark message as read here
        if (inView === true && isAppFocused) {
          dispatch(showScrollToBottomButton(false));
          // TODO this is pretty expensive and should instead use values from the redux store
          await markReadFromMessageId({
            messageId,
            conversationId: selectedConversationKey,
            isUnread,
          });

          dispatch(markConversationFullyRead(selectedConversationKey));
        } else if (inView === false) {
          dispatch(showScrollToBottomButton(true));
        }
      }

      if (inView && isAppFocused && oldestMessageId === messageId && !fetchingMoreInProgress) {
        debouncedTriggerLoadMoreTop(selectedConversationKey, oldestMessageId);
      }

      if (inView && isAppFocused && youngestMessageId === messageId && !fetchingMoreInProgress) {
        debouncedTriggerLoadMoreBottom(selectedConversationKey, youngestMessageId);
      }

      // this part is just handling the marking of the message as read if needed
      if (inView) {
        // TODO this is pretty expensive and should instead use values from the redux store
        await markReadFromMessageId({
          messageId,
          conversationId: selectedConversationKey,
          isUnread,
        });
      }
    },
    [
      dispatch,
      selectedConversationKey,
      mostRecentMessageId,
      oldestMessageId,
      fetchingMoreInProgress,
      isAppFocused,
      messageId,
      youngestMessageId,
      isUnread,
    ]
  );

  return (
    <InView
      id={`msg-${messageId}`}
      onContextMenu={onContextMenu}
      className={className}
      as="div"
      threshold={0.5} // consider that more than 50% of the message visible means it is read
      delay={isAppFocused ? 100 : 200}
      onChange={isAppFocused ? onVisible : noop}
      triggerOnce={false}
      trackVisibility={true}
      onClick={onClick}
      onDoubleClickCapture={onDoubleClickCapture}
      role={role}
      key={`inview-msg-${messageId}`}
      data-testid={dataTestId}
    >
      {props.children}
    </InView>
  );
};
