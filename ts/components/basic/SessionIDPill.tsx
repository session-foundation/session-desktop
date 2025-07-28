import styled from 'styled-components';
import type { SessionDataTestId } from 'react';
import { tr } from '../../localization/localeTools';
import { PubKey } from '../../session/types';
import { SessionLucideIconButton } from '../icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';
import { SessionTooltip } from '../SessionTooltip';
import { Localizer } from './Localizer';

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

export const SessionIDPill = ({ accountType }: { accountType: 'ours' | 'theirs' | 'blinded' }) => {
  return (
    <StyledPillDivider>
      <StyledPillDividerLine />
      <StyledPillSpan>
        {tr(
          accountType === 'blinded'
            ? 'blindedId'
            : accountType === 'ours'
              ? 'accountIdYours'
              : 'accountId'
        )}
      </StyledPillSpan>
      <StyledPillDividerLine />
    </StyledPillDivider>
  );
};

const StyledSessionIDNonEditable = styled.div`
  display: flex;
  gap: var(--margins-sm);
  user-select: none;
  text-align: center;
  word-break: break-all;
  padding-block: var(--margins-md);
  font-weight: 400;
  font-size: var(--font-size-md);
  color: var(--text-primary-color);
  flex-shrink: 0;
  font-family: var(--font-mono);

  .session-id-tooltip {
    font-family: var(--font-default);
    font-size: var(--font-size-sm);
  }
`;

export const SessionIDNonEditable = ({
  sessionId,
  dataTestId,
}: {
  sessionId: string;
  dataTestId?: SessionDataTestId;
}) => {
  const isBlinded = PubKey.isBlinded(sessionId);

  if (sessionId.length !== 66) {
    throw new Error('Unsupported case for SessionIDNonEditable: sessionId.length !== 66');
  }

  const shortenedSessionId = PubKey.shorten(sessionId, {
    keepCharacters: 12,
    withParenthesis: false,
  });

  if (isBlinded) {
    return (
      <StyledSessionIDNonEditable
        data-testid={dataTestId}
        // Note: we want the text centered even if the tooltip is offsetting it
        style={{ marginLeft: 'var(--margins-lg)' }}
      >
        {shortenedSessionId}
        <SessionTooltip
          content={<Localizer token="tooltipBlindedIdCommunities" className="session-id-tooltip" />}
          dataTestId="tooltip-info"
        >
          <SessionLucideIconButton
            unicode={LUCIDE_ICONS_UNICODE.CIRCLE_HELP}
            iconColor="var(--text-primary-color)"
            iconSize="small"
            dataTestId="tooltip"
          />
        </SessionTooltip>
      </StyledSessionIDNonEditable>
    );
  }

  return (
    <StyledSessionIDNonEditable data-testid={dataTestId}>
      {sessionId.slice(0, 33)}
      <br />
      {sessionId.slice(33)}
    </StyledSessionIDNonEditable>
  );
};
