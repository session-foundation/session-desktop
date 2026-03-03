import { type RefObject } from 'react';
import { SessionPopoverContent } from '../SessionPopover';
import { MessageReactBar } from './message/message-content/MessageReactBar';
import { THEME_GLOBALS } from '../../themes/globals';
import { useMessageReact } from '../../hooks/useMessageInteractions';
import { PopoverTriggerPosition } from '../SessionTooltip';

type SessionEmojiReactBarPopoverProps = {
  emojiPanelTriggerRef: RefObject<HTMLButtonElement | null>;
  reactBarFirstEmojiRef?: RefObject<HTMLSpanElement | null>;
  triggerPosition: PopoverTriggerPosition | null;
  messageId: string | undefined;
  onPlusButtonClick: () => void;
  onAfterEmojiClick: () => void;
};

export function SessionEmojiReactBarPopover({
  reactBarFirstEmojiRef,
  emojiPanelTriggerRef,
  onPlusButtonClick,
  onAfterEmojiClick,
  triggerPosition,
  messageId,
}: SessionEmojiReactBarPopoverProps) {
  const reactToMessage = useMessageReact(messageId);

  const onEmojiClick = (args: any) => {
    const emoji = args.native ?? args;
    if (reactToMessage) {
      void reactToMessage(emoji);
    } else {
      window.log.warn(
        `[SessionEmojiReactBarPopover] reactToMessage undefined for message ${messageId}`
      );
    }
    onAfterEmojiClick?.();
  };

  return (
    <SessionPopoverContent
      triggerPosition={triggerPosition}
      open={!!triggerPosition}
      isTooltip={false}
      verticalPosition="top"
      horizontalPosition="right"
      fallbackContentHeight={48}
      fallbackContentWidth={295}
      containerMarginTop={THEME_GLOBALS['--main-view-header-height-number']}
      contentMargin={12}
    >
      <MessageReactBar
        onEmojiClick={onEmojiClick}
        onPlusButtonClick={onPlusButtonClick}
        emojiPanelTriggerRef={emojiPanelTriggerRef}
        firstEmojiRef={reactBarFirstEmojiRef}
      />
    </SessionPopoverContent>
  );
}
