import { useRef, useState } from 'react';
import type { MenuOnHideCallback } from 'react-contexify';
import type { WithContextMenuId } from '../../session/types/with';
import { SessionEmojiReactBarPopover } from './SessionEmojiReactBarPopover';
import { SessionFocusTrap } from '../SessionFocusTrap';
import { MessageContextMenu } from './message/message-content/MessageContextMenu';
import { getTriggerPosition, type PopoverTriggerPosition } from '../SessionTooltip';
import { SessionEmojiPanelPopover } from './SessionEmojiPanelPopover';
import { useMessageReact } from '../../hooks/useMessageInteractions';
import { closeContextMenus } from '../../util/contextMenu';
import { useMessageIsControlMessage } from '../../state/selectors';
import {
  useReactionBarTriggerPosition,
  useInteractableMessageId,
} from '../../state/selectors/conversations';
import { setReactionBarTriggerPosition } from '../../state/ducks/conversations';
import { getAppDispatch } from '../../state/dispatch';

export type MessageInteractableOptions = {
  messageId?: string;
  reactionBarTriggerPosition: PopoverTriggerPosition | null;
  debugChangeReason: string;
};

type SessionMessageInteractablesProps = WithContextMenuId & { convoReactionsEnabled?: boolean };

export function SessionMessageInteractables({
  contextMenuId,
  convoReactionsEnabled,
}: SessionMessageInteractablesProps) {
  const reactionBarFirstEmojiRef = useRef<HTMLSpanElement>(null);
  const emojiPanelTriggerRef = useRef<HTMLButtonElement>(null);
  const messageId = useInteractableMessageId() ?? undefined;
  const reactionBarTriggerPosition = useReactionBarTriggerPosition();
  const [emojiPanelTriggerPos, setEmojiPanelTriggerPos] = useState<PopoverTriggerPosition | null>(
    null
  );
  const reactToMessageEmojiPanel = useMessageReact(messageId);
  const isControlMessage = useMessageIsControlMessage(messageId);
  const dispatch = getAppDispatch();

  /**
   * The reaction bar can be hidden by the following:
   * - Deactivation of the focus trap
   * - Hiding the message context menu
   * - Clicking a context menu item
   * - Reaction keyboard shortcut
   * */
  const showReactionBar =
    convoReactionsEnabled && !isControlMessage && !!reactionBarTriggerPosition;

  const closeReactionBar = () => {
    dispatch(setReactionBarTriggerPosition(null));
  };

  const onMessageContextMenuHide: MenuOnHideCallback = fromVisible => {
    if (fromVisible && !!reactionBarTriggerPosition) {
      closeReactionBar();
    }
  };

  /**
   * NOTE: for some reason onMessageContextMenuHide doesn't work properly when a context menu
   * item is clicked, this captures any context menu item click and forces the reaction bar to
   * close
   */
  const messageContextMenuOnClickCapture = () => {
    closeReactionBar();
  };

  const closeEmojiPanel = () => {
    setEmojiPanelTriggerPos(null);
  };

  const openEmojiPanel = () => {
    if (!messageId) {
      window.log.warn(`[SessionEmojiReactBarPopover] openEmojiPanel has no messageId`);
      return;
    }
    closeContextMenus();
    closeReactionBar();
    const pos = getTriggerPosition(emojiPanelTriggerRef);
    if (pos) {
      setEmojiPanelTriggerPos(pos);
    } else {
      window.log.warn(
        `[SessionEmojiReactBarPopover] getTriggerPosition for the emojiPanelTriggerRef returned null for message ${messageId}`
      );
    }
  };

  const onEmojiPanelEmojiClick = (args: any) => {
    const emoji = args.native ?? args;
    closeEmojiPanel();
    if (reactToMessageEmojiPanel) {
      void reactToMessageEmojiPanel(emoji);
    } else {
      window.log.warn(
        `[SessionMessageInteractables] reactToMessage undefined for message ${messageId}`
      );
    }
  };

  return (
    <>
      <SessionFocusTrap
        focusTrapId="SessionMessageInteractables"
        active={showReactionBar}
        initialFocus={() => reactionBarFirstEmojiRef.current ?? false}
        onDeactivate={closeReactionBar}
        clickOutsideDeactivates={true}
      >
        {showReactionBar ? (
          <SessionEmojiReactBarPopover
            reactBarFirstEmojiRef={reactionBarFirstEmojiRef}
            emojiPanelTriggerRef={emojiPanelTriggerRef}
            onPlusButtonClick={openEmojiPanel}
            messageId={messageId}
            onAfterEmojiClick={closeReactionBar}
            triggerPosition={reactionBarTriggerPosition}
          />
        ) : null}
        <MessageContextMenu
          contextMenuId={contextMenuId}
          messageId={messageId}
          onHide={onMessageContextMenuHide}
          onClickCapture={messageContextMenuOnClickCapture}
        />
      </SessionFocusTrap>
      <SessionEmojiPanelPopover
        triggerPosition={emojiPanelTriggerPos}
        open={!!emojiPanelTriggerPos}
        onEmojiClick={onEmojiPanelEmojiClick}
        onClose={closeEmojiPanel}
      />
    </>
  );
}
