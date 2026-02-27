import {
  type MouseEvent,
  type KeyboardEvent,
  useCallback,
  useRef,
  useState,
  useEffect,
} from 'react';
import clsx from 'clsx';
import {
  useMessageDirection,
  useMessageSelected,
  useMessageType,
} from '../../../../state/selectors';
import {
  useIsMessageSelectionMode,
  useSelectedConversationKey,
  useSelectedIsBlocked,
  useSelectedIsKickedFromGroup,
} from '../../../../state/selectors/selectedConversation';
import { isButtonClickKey, KbdShortcut } from '../../../../util/keyboardShortcuts';
import { showMessageContextMenu } from '../message-content/MessageContextMenu';
import { getAppDispatch } from '../../../../state/dispatch';
import {
  setFocusedMessageId,
  toggleSelectedMessageId,
} from '../../../../state/ducks/conversations';
import { PopoverTriggerPosition } from '../../../SessionTooltip';
import { useKeyboardShortcut } from '../../../../hooks/useKeyboardShortcut';
import type { WithMessageId } from '../../../../session/types/with';
import { useFocusScope, useIsInScope } from '../../../../state/focus';
import { closeContextMenus } from '../../../../util/contextMenu';
import { trimWhitespace } from '../../../../session/utils/String';
import { useMessageReply } from '../../../../hooks/useMessageInteractions';
import { GenericReadableMessage } from './GenericReadableMessage';

export function GenericReadableInteractableMessage({ messageId }: WithMessageId) {
  const dispatch = getAppDispatch();

  const ctxMenuID = `ctx-menu-message-${messageId}`;

  const isMessageSelected = useMessageSelected(messageId);
  const selectedIsBlocked = useSelectedIsBlocked();
  const multiSelectMode = useIsMessageSelectionMode();

  const convoId = useSelectedConversationKey();
  const direction = useMessageDirection(messageId);
  const isKickedFromGroup = useSelectedIsKickedFromGroup();

  const ref = useRef<HTMLDivElement>(null);
  const pointerDownRef = useRef(false);
  const [triggerPosition, setTriggerPosition] = useState<PopoverTriggerPosition | null>(null);
  const isInFocusScope = useIsInScope({ scope: 'message', scopeId: messageId });
  const { focusedMessageId } = useFocusScope();
  const isAnotherMessageFocused = focusedMessageId && !isInFocusScope;

  const reply = useMessageReply(messageId);
  const focusMessageId = () => {
    dispatch(setFocusedMessageId(messageId));
  };

  const onFocus = () => {
    focusMessageId();
  };

  const onBlur = () => {
    dispatch(setFocusedMessageId(null));
    pointerDownRef.current = false;
  };

  const onPointerDown = () => {
    pointerDownRef.current = true;
  };

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
      offsetX: direction === 'incoming' ? -halfWidth : halfWidth,
    };
  };

  const handleContextMenu = useCallback(
    (
      e: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>,
      overridePosition?: { x: number; y: number }
    ) => {
      if (!selectedIsBlocked && !multiSelectMode && !isKickedFromGroup) {
        showMessageContextMenu({
          id: ctxMenuID,
          event: e,
          triggerPosition: overridePosition,
        });
      }
    },
    [selectedIsBlocked, ctxMenuID, multiSelectMode, isKickedFromGroup]
  );

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

  const toggleEmojiReactionBarWithKeyboard = () => {
    if (triggerPosition) {
      closeContextMenus();
      setTriggerPosition(null);
    } else {
      const pos = getMessageContainerTriggerPosition();
      if (pos) {
        setTriggerPosition(pos);
      }
    }
  };

  const onClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (multiSelectMode && messageId) {
        event.preventDefault();
        event.stopPropagation();
        dispatch(toggleSelectedMessageId(messageId));
      }
    },
    [dispatch, messageId, multiSelectMode]
  );

  const onDoubleClickCapture = reply
    ? (e: MouseEvent<HTMLDivElement>) => {
        if (multiSelectMode) {
          return;
        }
        const currentSelection = window.getSelection();
        const currentSelectionString = currentSelection?.toString() || undefined;

        if (
          (!currentSelectionString || trimWhitespace(currentSelectionString).length === 0) &&
          (e.target as any).localName !== 'em-emoji-picker'
        ) {
          e.preventDefault();
          void reply();
        }
      }
    : undefined;

  useKeyboardShortcut({
    shortcut: KbdShortcut.messageToggleReactionBar,
    handler: toggleEmojiReactionBarWithKeyboard,
    scopeId: messageId,
  });

  const messageType = useMessageType(messageId);

  useEffect(() => {
    if (isAnotherMessageFocused) {
      setTriggerPosition(null);
    }
  }, [isAnotherMessageFocused]);

  if (!convoId || !messageId || !messageType) {
    return null;
  }

  const selected = isMessageSelected || false;

  return (
    <GenericReadableMessage
      ref={ref}
      messageId={messageId}
      contextMenuId={ctxMenuID}
      key={`readable-message-${messageId}`}
      role={'button'}
      selected={selected}
      className={clsx(selected ? 'message-selected' : undefined)}
      tabIndex={0}
      $focusedKeyboard={!pointerDownRef.current}
      onContextMenu={handleContextMenu}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onFocus={onFocus}
      onBlur={onBlur}
      onClick={onClick}
      onDoubleClickCapture={onDoubleClickCapture}
      reactionBarOptions={{ triggerPosition, setTriggerPosition }}
    />
  );
}
