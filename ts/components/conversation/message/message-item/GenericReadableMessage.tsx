import { type MouseEvent, type KeyboardEvent, useCallback, useRef, useState } from 'react';
import clsx from 'clsx';

import styled, { keyframes } from 'styled-components';
import { useIsDetailMessageView } from '../../../../contexts/isDetailViewContext';
import { MessageRenderingProps } from '../../../../models/messageType';
import {
  useMessageDirection,
  useMessageSelected,
  useMessageType,
} from '../../../../state/selectors';
import { MessageContentWithStatuses } from '../message-content/MessageContentWithStatus';
import { StyledMessageReactionsContainer } from '../message-content/MessageReactions';
import {
  useIsMessageSelectionMode,
  useSelectedConversationKey,
  useSelectedIsBlocked,
  useSelectedIsKickedFromGroup,
} from '../../../../state/selectors/selectedConversation';
import { isButtonClickKey, KbdShortcut } from '../../../../util/keyboardShortcuts';
import { showMessageContextMenu } from '../message-content/MessageContextMenu';
import { getAppDispatch } from '../../../../state/dispatch';
import { setFocusedMessageId, type UIMessageType } from '../../../../state/ducks/conversations';
import { PopoverTriggerPosition } from '../../../SessionTooltip';
import { useKeyboardShortcut } from '../../../../hooks/useKeyboardShortcut';
import type { WithMessageId } from '../../../../session/types/with';
import { CommunityInvitation } from './CommunityInvitation';
import { DataExtractionNotification } from './DataExtractionNotification';
import { TimerNotification } from '../../TimerNotification';
import { GroupUpdateMessage } from './GroupUpdateMessage';
import { CallNotification } from './notification-bubble/CallNotification';
import { InteractionNotification } from './InteractionNotification';
import { MessageRequestResponse } from './MessageRequestResponse';

export type GenericReadableMessageSelectorProps = Pick<
  MessageRenderingProps,
  'direction' | 'convoId' | 'isKickedFromGroup'
>;

const highlightedMessageAnimation = keyframes`
  1% { background-color: var(--primary-color); }
`;

const StyledReadableMessage = styled.div<{
  selected: boolean;
  $isDetailView: boolean;
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

  &:focus-visible {
    background-color: var(--conversation-tab-background-selected-color);
  }
`;

function getMessageComponent(messageType: UIMessageType) {
  switch (messageType) {
    case 'community-invitation':
      return CommunityInvitation;
    case 'data-extraction-notification':
      return DataExtractionNotification;
    case 'timer-update-notification':
      return TimerNotification;
    case 'group-update-notification':
      return GroupUpdateMessage;
    case 'call-notification':
      return CallNotification;
    case 'interaction-notification':
      return InteractionNotification;
    case 'message-request-response':
      return MessageRequestResponse;
    case 'regular-message':
      return MessageContentWithStatuses;
    default:
      return null;
  }
}

export const GenericReadableMessage = ({ messageId }: WithMessageId) => {
  const isDetailView = useIsDetailMessageView();
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
  const keyboardFocusedRef = useRef(false);
  const [triggerPosition, setTriggerPosition] = useState<PopoverTriggerPosition | null>(null);

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

  const messageType = useMessageType(messageId);

  if (!convoId || !messageId || !messageType) {
    return null;
  }

  const selected = isMessageSelected || false;
  const CmpToRender = getMessageComponent(messageType);

  if (!CmpToRender) {
    throw new Error(`Couldn't find a component for message type ${messageType}`);
  }

  return (
    <StyledReadableMessage
      ref={ref}
      selected={selected}
      $isDetailView={isDetailView}
      className={clsx(selected ? 'message-selected' : undefined)}
      onContextMenu={handleContextMenu}
      key={`readable-message-${messageId}`}
      onKeyDown={onKeyDown}
      tabIndex={0}
      onPointerDown={() => {
        pointerDownRef.current = true;
      }}
      onFocus={() => {
        if (!pointerDownRef.current) {
          keyboardFocusedRef.current = true;
          onFocus();
        }
        pointerDownRef.current = false;
      }}
      onBlur={() => {
        if (keyboardFocusedRef.current) {
          keyboardFocusedRef.current = false;
          onBlur();
        }
      }}
    >
      <CmpToRender
        contextMenuId={ctxMenuID}
        messageId={messageId}
        triggerPosition={triggerPosition}
        setTriggerPosition={setTriggerPosition}
      />
    </StyledReadableMessage>
  );
};
