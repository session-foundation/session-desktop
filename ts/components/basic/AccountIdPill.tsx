import styled from 'styled-components';
import { tr } from '../../localization/localeTools';

const StyledPillDividerLine = styled.div`
  border-bottom: var(--default-borders);
  line-height: 0.1rem;
  flex-grow: 1;
  height: 1px;
  align-self: center;
`;

const StyledPillSpan = styled.span`
  padding: 6px 15px 5px;
  border-radius: 50px;
  color: var(--text-secondary-color);
  border: var(--default-borders);
`;

const StyledPillDivider = styled.div`
  width: 100%;
  text-align: center;
  display: flex;
  margin: 0;
`;

export const AccountIdPill = ({ accountType }: { accountType: 'ours' | 'theirs' | 'blinded' }) => {
  return (
    <StyledPillDivider data-testid="account-id-pill">
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
