import { createSelector } from '@reduxjs/toolkit';
import { compact, isEmpty, remove, sortBy } from 'lodash';

import { useSelector } from 'react-redux';
import { StateType } from '../reducer';

import { UserUtils } from '../../session/utils';
import { MessageResultProps } from '../../types/message';

import { ConversationLookupType } from '../ducks/conversations';
import { SearchStateType, type SearchType } from '../ducks/search';
import { getConversationLookup } from './conversations';
import { ConversationTypeEnum } from '../../models/types';
import { tr } from '../../localization/localeTools';

export const getSearch = (state: StateType): SearchStateType => state.search;

export const getQuery = (state: StateType): string => getSearch(state).query;

export const getRequestedSnippetIds = (state: StateType): Array<string> =>
  getSearch(state).requestedSnippetIds;

const getIsSearching = (state: StateType) => {
  return !!getSearch(state)?.query?.trim();
};

const getSearchResults = createSelector(
  [getSearch, getConversationLookup],
  (searchState: SearchStateType, lookup: ConversationLookupType) => {
    return {
      searchResultContactsAndGroups: compact(
        searchState.searchResultContactsAndGroups
          .filter(id => {
            const value = lookup[id];

            // on some edges cases, we have an id but no corresponding convo because it matches a query but the conversation was removed.
            // Don't return anything when activeAt is unset (i.e. no current conversations with this user)
            if (!value || value.activeAt === undefined || value.activeAt === 0) {
              // activeAt can be 0 when linking device
              return false;
            }

            return true;
          })
          .map(id => lookup[id])
      ),
      searchResultMessages: searchState.searchResultMessages ?? [],
      searchTerm: searchState.query,
      searchType: searchState.searchType,
    };
  }
);

const getSearchTerm = createSelector([getSearchResults], searchResult => {
  return searchResult.searchTerm;
});

export const useSearchTermForType = (searchType: SearchType) => {
  const searchTypeInState = useSelector(getSearchType);

  const searchTerm = useSelector(getSearchTerm);
  return searchTypeInState === searchType ? searchTerm : undefined;
};

export const getSearchResultsIdsOnly = createSelector([getSearchResults], searchState => {
  return {
    ...searchState,
    searchResultContactsAndGroupsIds: searchState.searchResultContactsAndGroups.map(m => m.id),
  };
});

const getHasSearchResults = (state: StateType) => {
  const searchState = getSearch(state);
  return (
    !isEmpty(searchState.searchResultContactsAndGroups) ||
    !isEmpty(searchState.searchResultMessages)
  );
};

const getSearchType = (state: StateType) => {
  return getSearch(state)?.searchType;
};

export const useHasSearchResultsForSearchType = (searchType: SearchType) => {
  const hasSearchResults = useSelector(getHasSearchResults);
  const searchTypeInState = useSelector(getSearchType);

  return hasSearchResults && searchTypeInState === searchType;
};

export const getSearchResultsContactOnly = createSelector([getSearchResults], searchState => {
  return searchState.searchResultContactsAndGroups.filter(m => m.isPrivate).map(m => m.id);
});

/**
 *
 * When type is string, we render a sectionHeader.
 * When type just has a conversationId field, we render a ConversationListItem.
 * When type is MessageResultProps we render a MessageSearchResult
 */
export type SearchResultsMergedListItem =
  | string
  | { contactConvoId: string; displayName?: string }
  | MessageResultProps;

export const getSearchResultsList = createSelector([getSearchResults], searchState => {
  const { searchResultContactsAndGroups, searchResultMessages } = searchState;
  const builtList = [];

  if (searchResultContactsAndGroups.length) {
    const contactsWithNameAndType = searchResultContactsAndGroups.map(m => ({
      contactConvoId: m.id,
      displayName: m.nickname || m.displayNameInProfile,
      type: m.type,
    }));

    const groupsAndCommunities = sortBy(
      remove(contactsWithNameAndType, m => m.type === ConversationTypeEnum.GROUP),
      m => m.displayName?.toLowerCase()
    );

    const contactsStartingWithANumber = sortBy(
      remove(
        contactsWithNameAndType,
        m => !m.displayName || (m.displayName && m.displayName[0].match(/^[0-9]+$/))
      ),
      m => m.displayName || m.contactConvoId
    );

    builtList.push(
      ...groupsAndCommunities,
      ...contactsWithNameAndType,
      ...contactsStartingWithANumber
    );

    const us = UserUtils.getOurPubKeyStrFromCache();
    const hasUs = remove(builtList, m => m.contactConvoId === us);

    if (hasUs.length) {
      builtList.unshift({ contactConvoId: us, displayName: tr('noteToSelf') });
    }

    builtList.unshift(tr('sessionConversations'));
  }

  if (searchResultMessages.length) {
    builtList.push(tr('messages'));
    builtList.push(...searchResultMessages);
  }

  return builtList;
});

export function useIsSearchingForType(searchType: SearchType) {
  const isSearching = useSelector(getIsSearching);
  const searchTypeInState = useSelector(getSearchType);
  return isSearching && searchTypeInState === searchType;
}
