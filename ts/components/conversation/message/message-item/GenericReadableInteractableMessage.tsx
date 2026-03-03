import { type MouseEvent, type KeyboardEvent, useCallback, useRef } from 'react';
import clsx from 'clsx';
import {
  useHideAvatarInMsgList,
  useMessageDirection,
  useMessageIsControlMessage,
  useMessageIsOnline,
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
  setInteractableMessageId,
  setReactionBarTriggerPosition,
  toggleSelectedMessageId,
} from '../../../../state/ducks/conversations';
import { PopoverTriggerPosition } from '../../../SessionTooltip';
import { useKeyboardShortcut } from '../../../../hooks/useKeyboardShortcut';
import type { WithMessageId } from '../../../../session/types/with';
import { closeContextMenus } from '../../../../util/contextMenu';
import { trimWhitespace } from '../../../../session/utils/String';
import { useMessageReact, useMessageReply } from '../../../../hooks/useMessageInteractions';
import { GenericReadableMessage } from './GenericReadableMessage';

import { updateReactListModal } from '../../../../state/ducks/modalDialog';
import { MessageReactions } from '../message-content/MessageReactions';
import { MessageStatus } from '../message-content/MessageStatus';
import {
  useInteractableMessageId,
  useReactionBarTriggerPosition,
} from '../../../../state/selectors/conversations';

type GenericReadableInteractableMessageProps = WithMessageId & {
  convoReactionsEnabled?: boolean;
};

export function GenericReadableInteractableMessage({
  messageId,
  convoReactionsEnabled,
}: GenericReadableInteractableMessageProps) {
  const dispatch = getAppDispatch();

  const isMessageSelected = useMessageSelected(messageId);
  const isControlMessage = useMessageIsControlMessage(messageId);
  const selectedIsBlocked = useSelectedIsBlocked();
  const multiSelectMode = useIsMessageSelectionMode();
  const convoId = useSelectedConversationKey();
  const reactToMessage = useMessageReact(messageId);
  const hideAvatar = useHideAvatarInMsgList(messageId);
  const direction = useMessageDirection(messageId);
  const isKickedFromGroup = useSelectedIsKickedFromGroup();
  const messageType = useMessageType(messageId);
  const msgIsOnline = useMessageIsOnline(messageId);
  const interactableMessageId = useInteractableMessageId();
  const reactionBarTriggerPosition = useReactionBarTriggerPosition();

  const ref = useRef<HTMLDivElement>(null);
  const pointerDownRef = useRef(false);

  const reply = useMessageReply(messageId);
  const focusMessageId = () => {
    dispatch(setFocusedMessageId(messageId));
  };

  const onFocus = () => {
    focusMessageId();
  };

  const onBlur = () => {
    if (!reactionBarTriggerPosition) {
      dispatch(setFocusedMessageId(null));
    }
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
        dispatch(setInteractableMessageId(messageId));
        showMessageContextMenu({
          event: e,
          triggerPosition: overridePosition,
        });
      }
    },
    [dispatch, selectedIsBlocked, multiSelectMode, isKickedFromGroup, messageId]
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
    if (interactableMessageId === messageId && !!reactionBarTriggerPosition) {
      closeContextMenus();
      dispatch(setReactionBarTriggerPosition(null));
    } else {
      const pos = getMessageContainerTriggerPosition();
      if (pos) {
        dispatch(setInteractableMessageId(messageId));
        dispatch(setReactionBarTriggerPosition(pos));
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

  const enableReactions = convoReactionsEnabled && msgIsOnline;

  const handlePopupClick = (emoji: string) => {
    dispatch(
      updateReactListModal({
        reaction: emoji,
        messageId,
      })
    );
  };
  if (!convoId || !messageId || !messageType) {
    return null;
  }

  const selected = isMessageSelected || false;

  return (
    <GenericReadableMessage
      ref={ref}
      messageId={messageId}
      key={`readable-message-${messageId}`}
      role={'button'}
      selected={selected}
      className={clsx(selected ? 'message-selected' : undefined)}
      tabIndex={0}
      $focusedKeyboard={!pointerDownRef.current}
      /** TODO: this was a bit buggy but it would be nice to get working
       * $forceFocusStyle={!pointerDownRef.current && isFocused && !!reactionBarTriggerPosition}
       */
      onContextMenu={handleContextMenu}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onFocus={onFocus}
      onBlur={onBlur}
      onClick={onClick}
      onDoubleClickCapture={onDoubleClickCapture}
    >
      {enableReactions ? (
        <MessageReactions
          messageId={messageId}
          onEmojiClick={reactToMessage ? emoji => void reactToMessage(emoji) : undefined}
          onPopupClick={handlePopupClick}
          noAvatar={hideAvatar}
        />
      ) : null}
      {isControlMessage ? null : <MessageStatus dataTestId="msg-status" messageId={messageId} />}
    </GenericReadableMessage>
  );
}
