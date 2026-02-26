import { type RefObject, useRef, useState } from 'react';
import { getTriggerPosition, type PopoverTriggerPosition } from '../SessionTooltip';
import { SessionPopoverContent } from '../SessionPopover';
import { MessageReactBar } from './message/message-content/MessageReactBar';
import { THEME_GLOBALS } from '../../themes/globals';
import { SessionEmojiPanelPopover } from './SessionEmojiPanelPopover';
import { closeContextMenus } from '../../util/contextMenu';
import { useMessageReact } from '../../hooks/useMessageInteractions';

export function SessionEmojiReactBarPopover({
  messageId,
  triggerPos,
  reactBarFirstEmojiRef,
}: {
  messageId: string;
  // this can be null as we want the emoji panel to stay when the reaction bar closes
  triggerPos: PopoverTriggerPosition | null;
  reactBarFirstEmojiRef?: RefObject<HTMLSpanElement | null>;
}) {
  const emojiPanelTriggerRef = useRef<HTMLButtonElement>(null);
  const emojiPanelRef = useRef<HTMLDivElement>(null);
  const emojiReactionBarRef = useRef<HTMLDivElement>(null);
  const [emojiPanelTriggerPos, setEmojiPanelTriggerPos] = useState<PopoverTriggerPosition | null>(
    null
  );
  const reactToMessage = useMessageReact(messageId);

  const barOpen = !!triggerPos;
  const panelOpen = !!emojiPanelTriggerPos;

  const closeEmojiPanel = () => {
    setEmojiPanelTriggerPos(null);
  };

  const openEmojiPanel = () => {
    closeContextMenus();
    const pos = getTriggerPosition(emojiPanelTriggerRef);
    if (pos) {
      setEmojiPanelTriggerPos(pos);
    } else {
      window.log.warn(
        `[SessionEmojiReactBarPopover] getTriggerPosition for the emojiPanelTriggerRef returned null for message ${messageId}`
      );
    }
  };

  const onEmojiClick = (args: any) => {
    const emoji = args.native ?? args;
    closeEmojiPanel();
    if (reactToMessage) {
      void reactToMessage(emoji);
    } else {
      window.log.warn(
        `[SessionEmojiReactBarPopover] reactToMessage undefined for message ${messageId}`
      );
    }
  };

  return (
    <>
      <SessionEmojiPanelPopover
        emojiPanelRef={emojiPanelRef}
        triggerPosition={emojiPanelTriggerPos}
        open={panelOpen}
        onEmojiClick={onEmojiClick}
        onClose={closeEmojiPanel}
      />
      <SessionPopoverContent
        triggerPosition={triggerPos}
        open={barOpen}
        isTooltip={false}
        verticalPosition="top"
        horizontalPosition="right"
        fallbackContentHeight={48}
        fallbackContentWidth={295}
        containerMarginTop={THEME_GLOBALS['--main-view-header-height-number']}
        contentMargin={12}
      >
        <MessageReactBar
          ref={emojiReactionBarRef}
          onEmojiClick={onEmojiClick}
          onPlusButtonClick={openEmojiPanel}
          emojiPanelTriggerRef={emojiPanelTriggerRef}
          firstEmojiRef={reactBarFirstEmojiRef}
        />
      </SessionPopoverContent>
    </>
  );
}
