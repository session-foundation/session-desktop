import { RefObject } from 'react';
import { type PopoverTriggerPosition } from '../SessionTooltip';
import { SessionEmojiPanel } from './SessionEmojiPanel';
import { SessionPopoverContent } from '../SessionPopover';
import { FixedBaseEmoji } from '../../types/Reaction';

// emoji-mart v5.6.0 default dimensions
const EMOJI_PANEL_WIDTH_PX = 354;
const EMOJI_PANEL_HEIGHT_PX = 435;

export function SessionEmojiPanelPopover({
  emojiPanelRef,
  triggerPosition,
  onEmojiClick,
  open,
  onClose,
}: {
  emojiPanelRef: RefObject<HTMLDivElement | null>;
  triggerPosition: PopoverTriggerPosition | null;
  open: boolean;
  onEmojiClick: (emoji: FixedBaseEmoji) => void;
  onClose: () => void;
}) {
  const _open = open && !!triggerPosition;
  return (
    <SessionPopoverContent
      triggerPosition={triggerPosition}
      open={_open}
      isTooltip={false}
      verticalPosition="bottom"
      horizontalPosition="center"
      fallbackContentWidth={EMOJI_PANEL_WIDTH_PX}
      fallbackContentHeight={EMOJI_PANEL_HEIGHT_PX}
    >
      <SessionEmojiPanel
        ref={emojiPanelRef}
        onEmojiClicked={onEmojiClick}
        onClose={onClose}
        isModal={true}
        show={_open}
      />
    </SessionPopoverContent>
  );
}
