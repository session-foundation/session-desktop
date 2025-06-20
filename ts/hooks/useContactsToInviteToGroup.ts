import type { PubkeyType } from 'libsession_util_nodejs';
import { uniq, difference } from 'lodash';
import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { PubKey } from '../session/types';
import {
  getSearchResultsContactOnly,
  useIsSearchingForType,
  useSearchTermForType,
} from '../state/selectors/search';
import { useSortedGroupMembers } from './useParamSelector';
import { getPrivateContactsPubkeys } from '../state/selectors/conversations';
import type { SearchType } from '../state/ducks/search';

/**
 * Returns the 05 pubkeys of contacts that we can invite to a group.
 * The group can be empty so we can use that list on creation
 */
export const useContactsToInviteTo = (searchType: SearchType, conversationId?: string) => {
  const isSearch = useIsSearchingForType(searchType);
  const searchResultContactsOnly = useSelector(getSearchResultsContactOnly);
  const privateContactsPubkeys = useSelector(getPrivateContactsPubkeys);
  const membersFromRedux = useSortedGroupMembers(conversationId) || [];
  const searchTerm = useSearchTermForType(searchType);

  const members = uniq(membersFromRedux);

  const contactsToRender = isSearch
    ? searchResultContactsOnly.filter(m => PubKey.is05Pubkey(m))
    : privateContactsPubkeys;

  const validContactsForInvite = useMemo(() => {
    return difference(contactsToRender, members);
  }, [contactsToRender, members]);

  return {
    contactsToInvite: validContactsForInvite as Array<PubkeyType>,
    isSearch,
    searchTerm: isSearch ? searchTerm : undefined,
    hasSearchResults: isSearch ? validContactsForInvite.length > 0 : false,
  };
};
