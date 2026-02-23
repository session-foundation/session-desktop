import { RefObject } from 'react';
import { type PopoverTriggerPosition } from '../SessionTooltip';
import { SessionEmojiPanel } from './SessionEmojiPanel';
import { SessionPopoverContent } from '../SessionPopover';
import { FixedBaseEmoji } from '../../types/Reaction';

// emoji-mart v5.6.0 default dimensions
const EMOJI_PANEL_WIDTH_PX = 354;
const EMOJI_PANEL_HEIGHT_PX = 435;

export function SessionEmojiPanelPopover({
  triggerPos,
  emojiPanelRef,
  onEmojiClicked,
  open,
  onClose,
}: {
  triggerPos: PopoverTriggerPosition | null;
  open: boolean;
  emojiPanelRef: RefObject<HTMLDivElement | null>;
  onEmojiClicked: (emoji: FixedBaseEmoji) => void;
  onClose: () => void;
}) {
  const _open = open && !!triggerPos;
  return (
    <SessionPopoverContent
      triggerPosition={triggerPos}
      open={_open}
      isTooltip={false}
      verticalPosition="bottom"
      horizontalPosition="center"
      fallbackContentWidth={EMOJI_PANEL_WIDTH_PX}
      fallbackContentHeight={EMOJI_PANEL_HEIGHT_PX}
    >
      {_open ? (
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
