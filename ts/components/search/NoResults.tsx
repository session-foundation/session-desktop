import styled from 'styled-components';
import { Localizer } from '../basic/Localizer';

const StyledNoResults = styled.div`
  width: 100%;
  min-height: 40px;
  max-height: 400px;
  padding: var(--margins-xl) var(--margins-sm);
  text-align: center;
`;

export function NoResultsForSearch({ searchTerm }: { searchTerm: string }) {
  return (
    <StyledNoResults>
      <Localizer token="searchMatchesNoneSpecific" args={{ query: searchTerm }} />
    </StyledNoResults>
  );
}

const StyledMemberListNoContacts = styled.div`
  text-align: center;
  align-self: center;
  padding: 20px;
`;

function NoneAtStart({ token }: { token: 'contactNone' | 'groupMembersNone' }) {
  return (
    <StyledMemberListNoContacts>
      <Localizer token={token} />
    </StyledMemberListNoContacts>
  );
}

export function NoContacts() {
  return <NoneAtStart token="contactNone" />;
}

export function NoGroupMembers() {
  return <NoneAtStart token="groupMembersNone" />;
}
