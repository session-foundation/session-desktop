import styled from 'styled-components';
import { type RefObject, type KeyboardEvent, useRef } from 'react';
import useMount from 'react-use/lib/useMount';
import { nativeEmojiData } from '../../../../util/emoji';
import { getRecentReactions } from '../../../../util/storage';
import { LUCIDE_ICONS_UNICODE } from '../../../icon/lucide';
import { SessionLucideIconButton } from '../../../icon/SessionIconButton';
import {
  createButtonOnKeyDownForClickEventHandler,
  isEscapeKey,
} from '../../../../util/keyboardShortcuts';

type Props = {
  ref?: RefObject<HTMLDivElement | null>;
  emojiPanelTriggerRef: RefObject<HTMLButtonElement | null>;
  autoFocusFirstEmoji?: boolean;
  onEmojiClick: (emoji: string) => Promise<void>;
  onPlusButtonClick: () => void;
  closeReactionBar: () => void;
};

const StyledMessageReactBar = styled.div`
  padding: 4px 6px;
  white-space: nowrap;

  display: flex;
  align-items: center;

  .session-icon-button {
    &:hover svg {
      background-color: var(--chat-buttons-background-hover-color);
    }
  }
`;

const ReactButton = styled.span`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 40px;
  height: 40px;

  border-radius: 300px;
  cursor: pointer;
  font-size: 24px;

  &:hover {
    background-color: var(--chat-buttons-background-hover-color);
  }
`;

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  align-items: flex-start;
  left: -1px;
`;

export const MessageReactBar = ({
  ref,
  onEmojiClick,
  onPlusButtonClick,
  emojiPanelTriggerRef,
  closeReactionBar,
  autoFocusFirstEmoji,
}: Props) => {
  const recentReactions = getRecentReactions();
  const firstEmojiRef = useRef<HTMLSpanElement>(null);

  useMount(() => {
    // NOTE: this allows the fist emoji to be focused when the
    // reaction bar appears if auto focus is enabled
    if (autoFocusFirstEmoji) {
      firstEmojiRef?.current?.focus();
    }
  });

  return (
    <StyledContainer ref={ref}>
      <StyledMessageReactBar>
        {recentReactions.map((emoji, i) => {
          const onClick = () => void onEmojiClick(emoji);
          const onKeyDownButtonClickHandler = createButtonOnKeyDownForClickEventHandler(onClick);
          const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
            if (isEscapeKey(e)) {
              closeReactionBar();
            } else {
              onKeyDownButtonClickHandler(e);
            }
          };
          const ariaLabel = nativeEmojiData?.ariaLabels?.[emoji];

          return (
            <ReactButton
              ref={autoFocusFirstEmoji && i === 0 ? firstEmojiRef : undefined}
              key={emoji}
              role="button"
              tabIndex={0}
              aria-label={ariaLabel}
              onKeyDown={onKeyDown}
              onClick={onClick}
            >
              {emoji}
            </ReactButton>
          );
        })}
        <SessionLucideIconButton
          ref={emojiPanelTriggerRef}
          iconColor={'var(--text-primary-color)'}
          iconSize={'large'}
          unicode={LUCIDE_ICONS_UNICODE.PLUS}
          onClick={onPlusButtonClick}
          backgroundColor="var(--emoji-reaction-bar-icon-background-color)"
          // NOTE: these magic numbers align the plus icon with the emoji buttons
          padding="3px"
          margin="4px"
        />
      </StyledMessageReactBar>
    </StyledContainer>
  );
};
