import {
  type MouseEvent,
  type KeyboardEvent,
  useCallback,
  useRef,
  useMemo,
  useState,
  useEffect,
} from 'react';
import clsx from 'clsx';

import { useSelector } from 'react-redux';
import styled, { keyframes } from 'styled-components';
import { useIsDetailMessageView } from '../../../../contexts/isDetailViewContext';
import { MessageRenderingProps } from '../../../../models/messageType';
import { ConvoHub } from '../../../../session/conversations';
import { StateType } from '../../../../state/reducer';
import { useMessageSelected } from '../../../../state/selectors';
import { getGenericReadableMessageSelectorProps } from '../../../../state/selectors/conversations';
import { MessageContentWithStatuses } from '../message-content/MessageContentWithStatus';
import { StyledMessageReactionsContainer } from '../message-content/MessageReactions';
import {
  useIsMessageSelectionMode,
  useSelectedIsBlocked,
} from '../../../../state/selectors/selectedConversation';
import { isButtonClickKey, KbdShortcut } from '../../../../util/keyboardShortcuts';
import { showMessageContextMenu } from '../message-content/MessageContextMenu';
import { getAppDispatch } from '../../../../state/dispatch';
import { setFocusedMessageId } from '../../../../state/ducks/conversations';
import { PopoverTriggerPosition } from '../../../SessionTooltip';
import { useKeyboardShortcut } from '../../../../hooks/useKeyboardShortcut';
import { useFocusScope, useIsInScope } from '../../../../state/focus';

export type GenericReadableMessageSelectorProps = Pick<
  MessageRenderingProps,
  | 'direction'
  | 'conversationType'
  | 'receivedAt'
  | 'isUnread'
  | 'convoId'
  | 'isDeleted'
  | 'isKickedFromGroup'
>;

type Props = {
  messageId: string;
  ctxMenuID: string;
};

const highlightedMessageAnimation = keyframes`
  1% { background-color: var(--primary-color); }
`;

const StyledReadableMessage = styled.div<{
  selected: boolean;
  $isDetailView: boolean;
  $focusedKeyboard: boolean;
}>`
  display: flex;
  align-items: center;
  width: 100%;
  letter-spacing: 0.03rem;
  padding: ${props => (props.$isDetailView ? '0' : 'var(--margins-xs) var(--margins-lg) 0')};

  &.message-highlighted {
    animation: ${highlightedMessageAnimation} var(--duration-message-highlight) ease-in-out;
  }

  ${StyledMessageReactionsContainer} {
    margin-top: var(--margins-xs);
  }

  ${props =>
    props.$focusedKeyboard
      ? `&:focus-visible {
    background-color: var(--conversation-tab-background-selected-color);
  }`
      : ''}
`;

export const GenericReadableMessage = (props: Props) => {
  const isDetailView = useIsDetailMessageView();
  const dispatch = getAppDispatch();

  const { ctxMenuID, messageId } = props;

  const msgProps = useSelector((state: StateType) =>
    getGenericReadableMessageSelectorProps(state, props.messageId)
  );
  const isMessageSelected = useMessageSelected(props.messageId);
  const selectedIsBlocked = useSelectedIsBlocked();

  const multiSelectMode = useIsMessageSelectionMode();

  const ref = useRef<HTMLDivElement>(null);
  const pointerDownRef = useRef(false);
  const [triggerPosition, setTriggerPosition] = useState<PopoverTriggerPosition | null>(null);
  const isInFocusScope = useIsInScope({ scope: 'message', scopeId: messageId });
  const { focusedMessageId } = useFocusScope();
  const isAnotherMessageFocused = focusedMessageId && !isInFocusScope;

  const getMessageContainerTriggerPosition = (): PopoverTriggerPosition | null => {
    if (!ref.current) {
      return null;
    }
    const rect = ref.current.getBoundingClientRect();
    const halfWidth = rect.width / 2;
    return {
      x: rect.left,
      // NOTE: y needs to be clamped to the parent otherwise it can overflow the container
      y: rect.top,
      height: rect.height,
      width: rect.width,
      offsetX: msgProps?.direction === 'incoming' ? -halfWidth : halfWidth,
    };
  };

  const handleContextMenu = useCallback(
    (
      e: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>,
      overridePosition?: { x: number; y: number }
    ) => {
      if (!selectedIsBlocked && !multiSelectMode && !msgProps?.isKickedFromGroup) {
        showMessageContextMenu({
          id: ctxMenuID,
          event: e,
          triggerPosition: overridePosition,
        });
      }
    },
    [selectedIsBlocked, ctxMenuID, multiSelectMode, msgProps?.isKickedFromGroup]
  );

  const convoReactionsEnabled = useMemo(() => {
    if (msgProps?.convoId) {
      const conversationModel = ConvoHub.use().get(msgProps?.convoId);
      if (conversationModel) {
        return conversationModel.hasReactions();
      }
    }
    return true;
  }, [msgProps?.convoId]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (isButtonClickKey(e)) {
      if (e.target instanceof HTMLElement && e.target.tagName === 'BUTTON') {
        // If the target is a button, we don't want to open the context menu as this is
        // handled by the button itself
        return;
      }
      const overrideTriggerPosition = getMessageContainerTriggerPosition();
      if (overrideTriggerPosition) {
        handleContextMenu(e, overrideTriggerPosition);
      }
    }
  };

  const onFocus = () => {
    dispatch(setFocusedMessageId(messageId));
  };

  const onBlur = () => {
    dispatch(setFocusedMessageId(null));
  };

  const toggleEmojiReactionBarWithKeyboard = () => {
    if (triggerPosition) {
      setTriggerPosition(null);
    } else {
      const pos = getMessageContainerTriggerPosition();
      if (pos) {
        setTriggerPosition(pos);
      }
    }
  };

  useKeyboardShortcut({
    shortcut: KbdShortcut.messageToggleReactionBar,
    handler: toggleEmojiReactionBarWithKeyboard,
    scopeId: messageId,
  });

  useEffect(() => {
    if (isAnotherMessageFocused && triggerPosition) {
      setTriggerPosition(null);
    }
  }, [isAnotherMessageFocused, triggerPosition]);

  if (!msgProps) {
    return null;
  }

  const selected = isMessageSelected || false;

  return (
    <StyledReadableMessage
      ref={ref}
      selected={selected}
      $isDetailView={isDetailView}
      className={clsx(selected ? 'message-selected' : undefined)}
      onContextMenu={handleContextMenu}
      key={`readable-message-${messageId}`}
      onKeyDown={onKeyDown}
      $focusedKeyboard={!pointerDownRef.current}
      tabIndex={0}
      onPointerDown={() => {
        pointerDownRef.current = true;
      }}
      onFocus={() => {
        onFocus();
        pointerDownRef.current = false;
      }}
      onBlur={onBlur}
    >
      <MessageContentWithStatuses
        ctxMenuID={ctxMenuID}
        messageId={messageId}
        dataTestId={'message-content'}
        convoReactionsEnabled={convoReactionsEnabled}
        triggerPosition={triggerPosition}
        setTriggerPosition={setTriggerPosition}
      />
    </StyledReadableMessage>
  );
};
