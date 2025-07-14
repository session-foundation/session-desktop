import { useState, useRef, type ReactNode, useLayoutEffect } from 'react';
import styled, { css } from 'styled-components';
import { Constants } from '../../../../session';
import { tr } from '../../../../localization/localeTools';
import { useMessagesContainerRef } from '../../../../contexts/MessagesContainerRefContext';

export const StyledMessageBubble = styled.div<{ expanded: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;

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
  margin-block: var(--margins-xs);
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
  const msgBubbleRef = useRef<HTMLDivElement>(null);

  const messagesContainerRef = useMessagesContainerRef();

  const scrollBefore = useRef<{ scrollTop: number; scrollHeight: number }>({
    scrollTop: 0,
    scrollHeight: 0,
  });

  useLayoutEffect(() => {
    if (expanded) {
      const msgContainerAfter = messagesContainerRef.current;
      if (!msgBubbleRef.current || !msgContainerAfter) {
        return;
      }
      const { scrollTop: scrollTopAfter, scrollHeight: scrollHeightAfter } = msgContainerAfter;

      const { scrollTop: scrollTopBefore, scrollHeight: scrollHeightBefore } = scrollBefore.current;

      const topDidChange = scrollTopAfter !== scrollTopBefore;
      const heightDiff = scrollHeightAfter - scrollHeightBefore;
      const scrollTo = topDidChange ? scrollTopBefore - heightDiff : scrollTopAfter - heightDiff;

      msgContainerAfter.scrollTo({
        top: scrollTo,
        behavior: 'instant',
      });
    }
  }, [expanded, messagesContainerRef]);

  const onShowMore = () => {
    const el = msgBubbleRef.current;
    if (!el) {
      return;
    }

    const msgContainerBefore = messagesContainerRef.current;

    if (!msgContainerBefore) {
      return;
    }

    const { scrollTop: scrollTopBefore, scrollHeight: scrollHeightBefore } = msgContainerBefore;

    scrollBefore.current = { scrollTop: scrollTopBefore, scrollHeight: scrollHeightBefore };

    // we cannot "show less", only show more
    setExpanded(true);
  };

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

      hiddenHeight.current = innerHeight - maxHeight;

      setShowReadMore(overflowsLines);
    },
    // Note: no need to provide a dependency here (and if we provide children, this hook reruns every second for every messages).
    // The only dependency is msgBubbleRef, but as it's a ref it's unneeded
    []
  );

  return (
    <>
      <StyledMessageBubble ref={msgBubbleRef} expanded={expanded}>
        {children}
      </StyledMessageBubble>
      {showReadMore && !expanded ? (
        <ReadMoreButton onClick={onShowMore}>{tr('messageBubbleReadMore')}</ReadMoreButton>
      ) : null}
    </>
  );
}
