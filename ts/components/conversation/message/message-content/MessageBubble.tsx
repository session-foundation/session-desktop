import { useState, useRef, type ReactNode, useLayoutEffect } from 'react';
import styled, { css } from 'styled-components';
import { Constants } from '../../../../session';
import { localize } from '../../../../localization/localeTools';

export const StyledMessageBubble = styled.div<{ expanded: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;

  ${({ expanded }) =>
    !expanded &&
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
  margin-top: var(--margins-xs);
  margin-bottom: var(--margins-xs);
  border: none;
  background: none;
  cursor: pointer;
  padding: 0;
  &:hover {
    text-decoration: underline;
  }
`;

export function MessageBubble({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const [showReadMore, setShowReadMore] = useState(false);
  const hiddenHeight = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (expanded) {
      // TODO: find the perfect magic number, 1 is almost perfect
      // 21 is the ReadMore height, 10 is its vertical padding and 1 is from testing
      const scrollDownBy = hiddenHeight.current - 21 - 10 + 1;

      document.getElementById('messages-container')?.scrollBy({
        top: -scrollDownBy,
        behavior: 'instant',
      });
    }
  }, [expanded]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const el = container.firstElementChild;
    if (!el) {
      return;
    }

    const style = window.getComputedStyle(el);

    const lineHeight = parseFloat(style.lineHeight);
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

    hiddenHeight.current = innerHeight - maxHeight;
    setShowReadMore(overflowsLines);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- children changing will change el.lineHeight and el.ScrollHeight
  }, [children]);

  return (
    <>
      <StyledMessageBubble ref={containerRef} expanded={expanded}>
        {children}
      </StyledMessageBubble>
      {showReadMore && !expanded ? (
        <ReadMoreButton onClick={() => setExpanded(prev => !prev)}>
          {localize('messageBubbleReadMore')}
        </ReadMoreButton>
      ) : null}
    </>
  );
}
