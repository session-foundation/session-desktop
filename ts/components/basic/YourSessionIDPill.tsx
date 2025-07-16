import styled from 'styled-components';
import type { SessionDataTestId } from 'react';

const StyledPillDividerLine = styled.div`
  border-bottom: 1px solid var(--border-color);
  line-height: 0.1rem;
  flex-grow: 1;
  height: 1px;
  align-self: center;
`;

const StyledPillSpan = styled.span`
  padding: 6px 15px 5px;
  border-radius: 50px;
  color: var(--text-secondary-color);
  border: 1px solid var(--border-color);
`;

const StyledPillDivider = styled.div`
  width: 100%;
  text-align: center;
  display: flex;
  margin: 0;
`;

export const YourSessionIDPill = () => {
  return (
    <StyledPillDivider>
      <StyledPillDividerLine />
      <StyledPillSpan>{window.i18n('accountIdYours')}</StyledPillSpan>
      <StyledPillDividerLine />
    </StyledPillDivider>
  );
};

const StyledSessionIDNonEditable = styled.p`
  user-select: none;
  text-align: center;
  word-break: break-all;
  font-weight: 300;
  font-size: var(--font-size-sm);
  color: var(--text-primary-color);
  flex-shrink: 0;
  font-family: var(--font-mono);
`;

export const SessionIDNonEditable = ({
  sessionId,
  dataTestId,
}: {
  sessionId: string;
  dataTestId?: SessionDataTestId;
}) => {
  if (sessionId.length !== 66) {
    throw new Error('Unsupported case for SessionIDNonEditable: sessionId.length !== 66');
  }
  return (
    <StyledSessionIDNonEditable data-testid={dataTestId}>
      {sessionId.slice(0, 33)}
      <br />
      {sessionId.slice(33)}
    </StyledSessionIDNonEditable>
  );
};
