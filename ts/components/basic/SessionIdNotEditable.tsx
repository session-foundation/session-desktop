import type { ReactNode, SessionDataTestId, CSSProperties } from 'react';
import styled from 'styled-components';
import { PubKey } from '../../session/types';

const StyledSessionIDNotEditable = styled.div`
  display: flex;
  gap: var(--margins-sm);
  user-select: none;
  text-align: center;
  word-break: break-all;
  font-weight: 400;
  font-size: var(--font-size-md);
  color: var(--text-secondary-color);
  flex-shrink: 0;
  font-family: var(--font-mono);

  .session-id-tooltip {
    font-family: var(--font-default);
    font-size: var(--font-size-sm);
  }
`;

export const SessionIDNotEditable = ({
  sessionId,
  dataTestId,
  tooltipNode,
  displayType,
  style: providedStyle = {},
  onClick,
}: {
  sessionId: string;
  tooltipNode: ReactNode;
  displayType: 'blinded' | '2lines' | '3lines';
  dataTestId: SessionDataTestId;
  style: CSSProperties;
  onClick?: () => void;
}) => {
  if (sessionId.length !== 66) {
    throw new Error('Unsupported case for SessionIDNotEditable: sessionId.length !== 66');
  }
  if (PubKey.isBlinded(sessionId) && displayType !== 'blinded') {
    throw new Error('Unsupported case for SessionIDNotEditable: sessionId is blinded');
  }

  const pointerStyle = onClick ? { cursor: 'pointer' } : {};

  const style = tooltipNode
    ? { ...providedStyle, ...pointerStyle, marginStart: 'var(--margins-lg)' }
    : { ...providedStyle, ...pointerStyle };

  if (displayType === 'blinded') {
    const shortenedSessionId = PubKey.shorten(sessionId, {
      keepCharacters: 12,
      withParenthesis: false,
    });

    return (
      <StyledSessionIDNotEditable
        data-testid={dataTestId}
        // Note: we want the text centered even if the tooltip is offsetting it
        style={style}
        onClick={onClick}
      >
        {shortenedSessionId}
        {tooltipNode}
      </StyledSessionIDNotEditable>
    );
  }

  if (displayType === '3lines') {
    const firstLine = sessionId.slice(0, 27);
    const secondLine = sessionId.slice(27, 54);
    const thirdLine = sessionId.slice(54);
    return (
      <StyledSessionIDNotEditable
        data-testid={dataTestId} // Note: we want the text centered even if the tooltip is offsetting it
        style={style}
        onClick={onClick}
      >
        {firstLine}
        <br />
        {secondLine}
        <br />
        {thirdLine}
        {tooltipNode}
      </StyledSessionIDNotEditable>
    );
  }

  return (
    <StyledSessionIDNotEditable data-testid={dataTestId} style={style} onClick={onClick}>
      {sessionId.slice(0, 33)}
      <br />
      {sessionId.slice(33)}
    </StyledSessionIDNotEditable>
  );
};
