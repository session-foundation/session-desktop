import { useEffect, useRef, useState } from 'react';
import useClickAway from 'react-use/lib/useClickAway';
import { useTriggerPosition, type PopoverTriggerPosition } from '../SessionTooltip';
import { SessionPopoverContent } from '../SessionPopover';
import { MessageReactBar } from './message/message-content/MessageReactBar';
import { THEME_GLOBALS } from '../../themes/globals';
import { SessionEmojiPanelPopover } from './SessionEmojiPanelPopover';
import { closeContextMenus } from '../../util/contextMenu';
import { useFocusedMessageId } from '../../state/selectors/conversations';
import { useReactToMessage } from '../../hooks/useMessageInteractions';

export function SessionEmojiReactBarPopover({
  messageId,
  open,
  triggerPos,
  onClickAwayFromReactionBar,
}: {
  messageId: string;
  // this can be null as we want the emoji panel to stay when the reaction bar closes
  triggerPos: PopoverTriggerPosition | null;
  open: boolean;
  onClickAwayFromReactionBar: () => void;
}) {
  const emojiPanelTriggerRef = useRef<HTMLButtonElement>(null);
  const emojiPanelTriggerPos = useTriggerPosition(emojiPanelTriggerRef);
  const emojiPanelRef = useRef<HTMLDivElement>(null);
  const emojiReactionBarRef = useRef<HTMLDivElement>(null);
  const [showEmojiPanel, setShowEmojiPanel] = useState<boolean>(false);
  const reactToMessage = useReactToMessage(messageId);
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
    await reactToMessage?.(emoji);
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
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        onEmojiClicked={onEmojiClick}
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
              // eslint-disable-next-line @typescript-eslint/no-misused-promises
              action={onEmojiClick}
              additionalAction={openEmojiPanel}
              emojiPanelTriggerRef={emojiPanelTriggerRef}
            />
          ) : null}
        </SessionPopoverContent>
      ) : null}
    </>
  );
}
