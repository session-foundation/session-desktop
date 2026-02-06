import { RefObject } from 'react';
import { useTriggerPosition } from '../SessionTooltip';
import { SessionEmojiPanel } from './SessionEmojiPanel';
import { SessionPopoverContent } from '../SessionPopover';
import { FixedBaseEmoji } from '../../types/Reaction';

// emoji-mart v5.6.0 default dimensions
const EMOJI_PANEL_WIDTH_PX = 354;
const EMOJI_PANEL_HEIGHT_PX = 435;

export function SessionEmojiPanelPopover({
  triggerRef,
  emojiPanelRef,
  onEmojiClicked,
  open,
  onClose,
}: {
  triggerRef: RefObject<HTMLButtonElement | null>;
  open: boolean;
  emojiPanelRef: RefObject<HTMLDivElement | null>;
  onEmojiClicked: (emoji: FixedBaseEmoji) => void;
  onClose: () => void;
}) {
  const triggerPos = useTriggerPosition(triggerRef);
  return (
    <SessionPopoverContent
      triggerPosition={triggerPos}
      open={open}
      isTooltip={false}
      verticalPosition="bottom"
      horizontalPosition="center"
      fallbackContentWidth={EMOJI_PANEL_WIDTH_PX}
      fallbackContentHeight={EMOJI_PANEL_HEIGHT_PX}
    >
      {open ? (
        <SessionEmojiPanel
          ref={emojiPanelRef}
          show={true}
          onEmojiClicked={onEmojiClicked}
          onClose={onClose}
          isModal={true}
        />
      ) : null}
    </SessionPopoverContent>
  );
}
