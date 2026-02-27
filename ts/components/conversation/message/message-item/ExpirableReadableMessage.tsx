import { debounce, noop } from 'lodash';
import { InView } from 'react-intersection-observer';
import { useSelector } from 'react-redux';
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type AriaRole,
  type MouseEvent,
  type MouseEventHandler,
  type ReactNode,
  type SessionDataTestId,
} from 'react';
import useInterval from 'react-use/lib/useInterval';
import useMount from 'react-use/lib/useMount';
import { getAppDispatch } from '../../../../state/dispatch';
import { useIsDetailMessageView } from '../../../../contexts/isDetailViewContext';
import { useHasUnread, useMessageExpirationPropsById } from '../../../../hooks/useParamSelector';
import { MessageModelType } from '../../../../models/messageType';
import {
  fetchBottomMessagesForConversation,
  fetchTopMessagesForConversation,
  markConversationFullyRead,
  messagesExpired,
  PropsForExpiringMessage,
  showScrollToBottomButton,
} from '../../../../state/ducks/conversations';
import { getIncrement } from '../../../../util/timer';
import { ExpireTimer } from '../../ExpireTimer';
import { Data } from '../../../../data/data';
import { ConvoHub } from '../../../../session/conversations';
import { MessageContextMenu } from '../message-content/MessageContextMenu';
import type { WithPopoverPosition, WithSetPopoverPosition } from '../../../SessionTooltip';
import type { WithContextMenuId, WithConvoId, WithMessageId } from '../../../../session/types/with';
import { useScrollToLoadedMessage } from '../../../../contexts/ScrollToLoadedMessage';
import {
  getMostRecentMessageId,
  getOldestMessageId,
  getYoungestMessageId,
  areMoreMessagesBeingFetched,
  getShowScrollButton,
  getQuotedMessageToAnimate,
} from '../../../../state/selectors/conversations';
import { getIsAppFocused } from '../../../../state/selectors/section';
import { useSelectedConversationKey } from '../../../../state/selectors/selectedConversation';
import { useMessageType } from '../../../../state/selectors';
import { useSelectMessageViaClick } from '../../../../hooks/useMessageInteractions';
import { SessionEmojiReactBarPopover } from '../../SessionEmojiReactBarPopover';
import { SessionFocusTrap } from '../../../SessionFocusTrap';

const EXPIRATION_CHECK_MINIMUM = 2000;

function useIsExpired(
  props: Omit<PropsForExpiringMessage, 'messageId' | 'direction'> & {
    messageId: string | undefined;
    direction: MessageModelType | undefined;
  }
) {
  const { convoId, messageId, expirationDurationMs, expirationTimestamp, isExpired } = props;

  const dispatch = getAppDispatch();

  const checkExpired = useCallback(async () => {
    const now = Date.now();

    if (!messageId || !expirationTimestamp || !expirationDurationMs) {
      return;
    }

    if (isExpired || now >= expirationTimestamp) {
      await Data.removeMessage(messageId);
      if (convoId) {
        dispatch(
          messagesExpired([
            {
              conversationId: convoId,
              messageId,
            },
          ])
        );
        const convo = ConvoHub.use().get(convoId);
        convo?.updateLastMessage();
      }
    }
  }, [messageId, expirationTimestamp, expirationDurationMs, isExpired, convoId, dispatch]);

  let checkFrequency: number | null = null;
  if (expirationDurationMs) {
    const increment = getIncrement(expirationDurationMs || EXPIRATION_CHECK_MINIMUM);
    checkFrequency = Math.max(EXPIRATION_CHECK_MINIMUM, increment);
  }

  useMount(() => {
    void checkExpired();
  }); // check on mount

  useInterval(checkExpired, checkFrequency); // check every 2sec or sooner if needed

  return { isExpired };
}

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

const ReadableMessage = (
  props: ReadableMessageProps & { alignItems: 'flex-start' | 'flex-end' | 'center' }
) => {
  const {
    messageId,
    onContextMenu,
    className,
    isUnread,
    onClick,
    onDoubleClickCapture,
    role,
    dataTestId,
    alignItems,
  } = props;

  const isAppFocused = useSelector(getIsAppFocused);
  const dispatch = getAppDispatch();

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
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems,
        width: '100%',
        flexDirection: 'column',
      }}
    >
      {props.children}
    </InView>
  );
};

export type ExpirableReadableMessageProps = Omit<ReadableMessageProps, 'isUnread' | 'onClick'> &
  WithMessageId &
  WithContextMenuId &
  WithSetPopoverPosition &
  WithPopoverPosition & {
    enableReactions?: boolean;
  };

function ExpireTimerControlMessage({
  expirationTimestamp,
  expirationDurationMs,
}: {
  expirationDurationMs: number | null | undefined;
  expirationTimestamp: number | null | undefined;
}) {
  return (
    <ExpireTimer
      expirationDurationMs={expirationDurationMs || undefined}
      expirationTimestamp={expirationTimestamp}
    />
  );
}

// NOTE: [react-compiler] this convinces the compiler the hook is static
const useMessageExpirationPropsByIdInternal = useMessageExpirationPropsById;
const useIsDetailMessageViewInternal = useIsDetailMessageView;
const useSelectMessageViaClickInternal = useSelectMessageViaClick;
const useMessageTypeInternal = useMessageType;

export const ExpirableReadableMessage = (props: ExpirableReadableMessageProps) => {
  const selected = useMessageExpirationPropsByIdInternal(props.messageId);
  const isDetailView = useIsDetailMessageViewInternal();
  const selectViaClick = useSelectMessageViaClickInternal(props.messageId);

  const {
    onDoubleClickCapture,
    role,
    dataTestId,
    contextMenuId,
    triggerPosition,
    setTriggerPosition,
    messageId,
    enableReactions,
  } = props;

  const messageType = useMessageTypeInternal(messageId);

  const reactBarFirstEmojiRef = useRef<HTMLSpanElement>(null);
  const closeReactionBar = () => {
    setTriggerPosition(null);
  };

  const active = !!triggerPosition && !!reactBarFirstEmojiRef.current;

  const { isExpired } = useIsExpired({
    convoId: selected?.convoId,
    messageId: selected?.messageId,
    direction: selected?.direction,
    expirationTimestamp: selected?.expirationTimestamp,
    expirationDurationMs: selected?.expirationDurationMs,
    isExpired: selected?.isExpired,
  });

  if (!selected || isExpired) {
    return null;
  }

  const { direction: _direction, isUnread, expirationDurationMs, expirationTimestamp } = selected;

  // NOTE we want messages on the left in the message detail view regardless of direction
  const direction = isDetailView ? 'incoming' : _direction;
  const isIncoming = direction === 'incoming';

  /**
   * If the message can expire, it will show the expiration timer if it is expiring.
   * Note, the only two message types that cannot expire are
   *  - 'interaction-notification'
   *  - 'message-request-response'
   */
  const canExpire =
    messageType !== 'interaction-notification' && messageType !== 'message-request-response';
  const isControlMessage =
    messageType !== 'regular-message' && messageType !== 'community-invitation';

  const alignItems = isControlMessage ? 'center' : isIncoming ? 'flex-start' : 'flex-end';

  return (
    <ReadableMessage
      messageId={messageId}
      isUnread={!!isUnread}
      alignItems={alignItems}
      onClick={selectViaClick ?? undefined}
      onDoubleClickCapture={onDoubleClickCapture}
      role={role}
      key={`readable-message-${messageId}`}
      dataTestId={dataTestId}
    >
      {/* This is the expire timer for control messages only (centered).The one for regular
       messages is rendered as part of MessageStatusContainer  */}
      {canExpire && isControlMessage ? (
        <ExpireTimerControlMessage
          expirationDurationMs={expirationDurationMs}
          expirationTimestamp={expirationTimestamp}
        />
      ) : null}
      <SessionFocusTrap
        active={active}
        initialFocus={() => reactBarFirstEmojiRef.current ?? false}
        onDeactivate={closeReactionBar}
        clickOutsideDeactivates={true}
      >
        {enableReactions ? (
          <SessionEmojiReactBarPopover
            messageId={messageId}
            triggerPos={triggerPosition}
            reactBarFirstEmojiRef={reactBarFirstEmojiRef}
          />
        ) : null}
        <MessageContextMenu
          messageId={messageId}
          contextMenuId={contextMenuId}
          setTriggerPosition={setTriggerPosition}
        />
      </SessionFocusTrap>
      {props.children}
    </ReadableMessage>
  );
};
