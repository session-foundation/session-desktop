import styled from 'styled-components';
import { RefObject } from 'react';
import { nativeEmojiData } from '../../../../util/emoji';
import { getRecentReactions } from '../../../../util/storage';
import { LUCIDE_ICONS_UNICODE } from '../../../icon/lucide';
import { SessionLucideIconButton } from '../../../icon/SessionIconButton';
import { createButtonOnKeyDownForClickEventHandler } from '../../../../util/keyboardShortcuts';

type Props = {
  ref?: RefObject<HTMLDivElement | null>;
  action: (...args: Array<any>) => void;
  additionalAction: (...args: Array<any>) => void;
  emojiPanelTriggerRef: RefObject<HTMLButtonElement | null>;
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

export const MessageReactBar = ({ ref, action, additionalAction, emojiPanelTriggerRef }: Props) => {
  const recentReactions = getRecentReactions();

  return (
    <StyledContainer ref={ref}>
      <StyledMessageReactBar>
        {recentReactions.map(emoji => {
          const onClick = () => action(emoji);
          const onKeyDown = createButtonOnKeyDownForClickEventHandler(onClick);
          const ariaLabel = nativeEmojiData?.ariaLabels
            ? nativeEmojiData.ariaLabels[emoji]
            : undefined;

          return (
            <ReactButton
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
          iconColor={'var(--emoji-reaction-bar-icon-color)'}
          iconSize={'large'}
          unicode={LUCIDE_ICONS_UNICODE.PLUS}
          onClick={additionalAction}
          backgroundColor="var(--emoji-reaction-bar-icon-background-color)"
          // NOTE: these magic numbers align the plus icon with the emoji buttons
          padding="3px"
          margin="4px"
        />
      </StyledMessageReactBar>
    </StyledContainer>
  );
};
