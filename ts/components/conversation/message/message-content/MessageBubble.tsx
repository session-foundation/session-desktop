import { useState, useRef, type ReactNode, useLayoutEffect } from 'react';
import styled, { css } from 'styled-components';
import { Constants } from '../../../../session';
import { tr } from '../../../../localization/localeTools';
import { createButtonOnKeyDownForClickEventHandler } from '../../../../util/keyboardShortcuts';

export const StyledMessageBubble = styled.div<{ $expanded: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;

  ${({ $expanded }) =>
    !$expanded &&
    css`
      pre,
      .message-body {
        display: -webkit-inline-box;
        -webkit-line-clamp: ${Constants.CONVERSATION.MAX_MESSAGE_MAX_LINES_BEFORE_READ_MORE};
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      pre {
        overflow-x: auto;
      }
    `}
`;

const ReadMoreButton = styled.button`
  font-weight: bold;
  margin-block: var(--margins-xs);
  border: none;
  background: none;
  cursor: pointer;
  padding: 0;
  &:hover,
  &:focus {
    text-decoration: underline;
  }
`;

export function MessageBubble({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const [showReadMore, setShowReadMore] = useState(false);
  const msgBubbleRef = useRef<HTMLDivElement>(null);

  const onClick = () => {
    // we cannot "show less", only show more
    setExpanded(true);
  };

  const onKeyDown = createButtonOnKeyDownForClickEventHandler(onClick);

  /**
   * Used to re-trigger the "Read More" layout effect when the message content changes scroll height.
   * This is required to handle window resizing, zooming, and font size changes.
   * NOTE: this doesnt seem to always catch the resize/zoom change case well, we may need
   * to consider listening to a resize or zoom event or something.
   */
  const scrollHeight = msgBubbleRef.current?.firstElementChild?.scrollHeight;

  useLayoutEffect(
    () => {
      const el = msgBubbleRef?.current?.firstElementChild;
      if (!el) {
        return;
      }

      // We need the body's child to find the line height as long as it exists
      const textEl = el.firstElementChild ?? el;
      const textStyle = window.getComputedStyle(textEl);
      const style = window.getComputedStyle(el);

      const lineHeight = parseFloat(textStyle.lineHeight);
      const paddingTop = parseFloat(style.paddingTop);
      const paddingBottom = parseFloat(style.paddingBottom);
      const borderTopWidth = parseFloat(style.borderTopWidth);
      const borderBottomWidth = parseFloat(style.borderBottomWidth);

      // We need to allow for a 1 pixel buffer in maxHeight
      const maxHeight =
        lineHeight * Constants.CONVERSATION.MAX_MESSAGE_MAX_LINES_BEFORE_READ_MORE + 1;

      const innerHeight =
        el.scrollHeight - (paddingTop + paddingBottom + borderTopWidth + borderBottomWidth);

      const overflowsLines = innerHeight > maxHeight;

      setShowReadMore(overflowsLines);
    },
    /**
     * Note: Don't provide children as a dependency, if you do this hook reruns every second for every
     * message. The only dependencies are the scrollHeight (to handle window resizing) and msgBubbleRef,
     * but it's a ref so is not needed.
     */
    [scrollHeight]
  );

  return (
    <>
      <StyledMessageBubble ref={msgBubbleRef} $expanded={expanded}>
        {children}
      </StyledMessageBubble>
      {showReadMore && !expanded ? (
        <ReadMoreButton onClick={onClick} onKeyDown={onKeyDown}>
          {tr('messageBubbleReadMore')}
        </ReadMoreButton>
      ) : null}
    </>
  );
}
