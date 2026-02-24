import { useEffect, useRef, useState } from 'react';
import useClickAway from 'react-use/lib/useClickAway';
import { useTriggerPosition, type PopoverTriggerPosition } from '../SessionTooltip';
import { SessionPopoverContent } from '../SessionPopover';
import { MessageReactBar } from './message/message-content/MessageReactBar';
import { THEME_GLOBALS } from '../../themes/globals';
import { SessionEmojiPanelPopover } from './SessionEmojiPanelPopover';
import { closeContextMenus } from '../../util/contextMenu';
import { useFocusedMessageId } from '../../state/selectors/conversations';
import { useMessageReact } from '../../hooks/useMessageInteractions';

export function SessionEmojiReactBarPopover({
  messageId,
  open,
  triggerPos,
  onClickAwayFromReactionBar,
  autoFocusFirstEmoji,
}: {
  messageId: string;
  // this can be null as we want the emoji panel to stay when the reaction bar closes
  triggerPos: PopoverTriggerPosition | null;
  open: boolean;
  onClickAwayFromReactionBar: () => void;
  autoFocusFirstEmoji?: boolean;
}) {
  const emojiPanelTriggerRef = useRef<HTMLButtonElement>(null);
  const emojiPanelTriggerPos = useTriggerPosition(emojiPanelTriggerRef);
  const emojiPanelRef = useRef<HTMLDivElement>(null);
  const emojiReactionBarRef = useRef<HTMLDivElement>(null);
  const [showEmojiPanel, setShowEmojiPanel] = useState<boolean>(false);
  const reactToMessage = useMessageReact(messageId);
  const focusedMessageId = useFocusedMessageId();

  const closeEmojiPanel = () => {
    setShowEmojiPanel(false);
  };

  const openEmojiPanel = () => {
    closeContextMenus();
    setShowEmojiPanel(true);
  };

  const onEmojiClick = async (args: any) => {
    const emoji = args.native ?? args;
    closeEmojiPanel();
    if (reactToMessage) {
      await reactToMessage(emoji);
    } else {
      window.log.warn(
        `[SessionEmojiReactBarPopover] reactToMessage undefined for message ${messageId}`
      );
    }
  };

  useClickAway(emojiPanelRef, () => {
    if (showEmojiPanel) {
      closeEmojiPanel();
    }
  });

  useClickAway(emojiReactionBarRef, () => {
    if (open) {
      onClickAwayFromReactionBar();
    }
  });

  useEffect(() => {
    if (focusedMessageId && messageId && focusedMessageId !== messageId) {
      onClickAwayFromReactionBar();
    }
  }, [focusedMessageId, messageId, onClickAwayFromReactionBar]);

  return (
    <>
      <SessionEmojiPanelPopover
        emojiPanelRef={emojiPanelRef}
        triggerPos={emojiPanelTriggerPos}
        onEmojiClick={onEmojiClick}
        open={showEmojiPanel}
        onClose={closeEmojiPanel}
      />
      {triggerPos ? (
        <SessionPopoverContent
          triggerPosition={triggerPos}
          open={open}
          isTooltip={false}
          verticalPosition="top"
          horizontalPosition="right"
          fallbackContentHeight={48}
          fallbackContentWidth={295}
          containerMarginTop={THEME_GLOBALS['--main-view-header-height-number']}
          contentMargin={12}
        >
          {open ? (
            <MessageReactBar
              ref={emojiReactionBarRef}
              onEmojiClick={onEmojiClick}
              onPlusButtonClick={openEmojiPanel}
              emojiPanelTriggerRef={emojiPanelTriggerRef}
              closeReactionBar={onClickAwayFromReactionBar}
              autoFocusFirstEmoji={autoFocusFirstEmoji}
            />
          ) : null}
        </SessionPopoverContent>
      ) : null}
    </>
  );
}
