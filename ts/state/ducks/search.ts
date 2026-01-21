import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { compact } from 'lodash';
import { Data } from '../../data/data';
import { SearchOptions } from '../../types/Search';
import { cleanSearchTerm } from '../../util/cleanSearchTerm';

import { UserUtils } from '../../session/utils';
import { MessageResultProps } from '../../types/message';
import { ReduxConversationType } from './conversations';
import { tEnglish, tr } from '../../localization/localeTools';
import { BlockedNumberController } from '../../util';
import { toSearchableString } from '../../session/searchableString';

export type SearchType = 'global' | 'create-group' | 'invite-contact-to' | 'manage-group-members';

export type SearchStateType = {
  /**
   * We can do a search globally (left pane) or to invite contacts/create a group.
   * This field is used to make sure we don't update multiple parts of the UI.
   * */
  searchType: SearchType | null;
  query: string;
  // For conversations we store just the id, and pull conversation props in the selector
  searchResultContactsAndGroups: Array<string>;
  searchResultMessages?: Array<MessageResultProps>;
};

type SearchResultsPayloadType = Pick<
  SearchStateType,
  'searchType' | 'query' | 'searchResultContactsAndGroups' | 'searchResultMessages'
>;

export type DoSearchActionType = {
  query: string;
  searchType: SearchType;
};

const doSearch = createAsyncThunk(
  'search/doSearch',
  async ({ query, searchType }: DoSearchActionType): Promise<SearchResultsPayloadType> => {
    const options: SearchOptions = {
      noteToSelf: [tr('noteToSelf').toLowerCase(), tEnglish('noteToSelf').toLowerCase()],
      savedMessages: tr('savedMessages').toLowerCase(),
      ourNumber: UserUtils.getOurPubKeyStrFromCache(),
      excludeBlocked: searchType !== 'global',
    };
    const processedQuery = query;

    const [searchResultContactsAndGroups, messages] = await Promise.all([
      queryContactsAndGroups(processedQuery, options),
      // we only need to query messages for the global search
      searchType === 'global' ? queryMessages(processedQuery) : Promise.resolve([]),
    ]);
    const filteredMessages = compact(messages);

    return {
      query,
      searchResultContactsAndGroups,
      searchResultMessages: filteredMessages,
      searchType,
    };
  }
);

async function queryMessages(query: string): Promise<Array<MessageResultProps>> {
  try {
    const trimmedQuery = query.trim();
    // we clean the search term to avoid special characters since the query is referenced in the SQL query directly
    const normalized = cleanSearchTerm(trimmedQuery);
    // 200 on a large database is already pretty slow
    const limit = Math.min((trimmedQuery.length || 2) * 50, 200);
    return Data.searchMessages(normalized, limit);
  } catch (e) {
    window.log.warn('queryMessages failed with', e.message);
    return [];
  }
}

function convoMatchesSearch(convo: ReduxConversationType, searchTermLower: string): boolean {
  if (!convo) {
    return false;
  }

  return !!(
    toSearchableString(convo.id).includes(searchTermLower) ||
    toSearchableString(convo.nickname).includes(searchTermLower) ||
    toSearchableString(convo.displayNameInProfile).includes(searchTermLower)
  );
}

export async function queryContactsAndGroups(providedQuery: string, options: SearchOptions) {
  const { ourNumber, noteToSelf, savedMessages } = options;

  // Remove formatting characters from the query
  const query = providedQuery.replace(/[+-.()]*/g, '');
  const queryLower = toSearchableString(query);

  // Using memory cache avoids slow DB queries and ICU/case-sensitivity issues.
  const state = window.inboxStore?.getState() as any;
  const conversationLookup = (state?.conversations?.conversationLookup || {}) as Record<
    string,
    ReduxConversationType
  >;

  const searchResults = Object.values(conversationLookup).filter(convo => {
    if (options.excludeBlocked && BlockedNumberController.isBlocked(convo.id)) {
      return false;
    }
    return convoMatchesSearch(convo, queryLower);
  });

  let searchResultContactsAndGroups: Array<string> = searchResults.map(
    conversation => conversation.id
  );

  const isSavedMessagesMatch =
    typeof savedMessages === 'string' ? savedMessages.includes(query) : false;

  if (
    noteToSelf.some(str => str.includes(query) || toSearchableString(str).includes(queryLower)) ||
    isSavedMessagesMatch
  ) {
    // Ensure that we don't have duplicates in our results
    searchResultContactsAndGroups = searchResultContactsAndGroups.filter(id => id !== ourNumber);
    searchResultContactsAndGroups.unshift(ourNumber);
  }

  return searchResultContactsAndGroups;
}

// Reducer

export const initialSearchState: SearchStateType = {
  searchType: null, // by default the search is off
  query: '',
  searchResultContactsAndGroups: [],
  searchResultMessages: [],
};

const searchSlice = createSlice({
  name: 'searchSlice',
  initialState: initialSearchState,
  reducers: {
    clearSearch() {
      return initialSearchState;
    },
    updateSearchTerm(state, action: PayloadAction<{ query: string; searchType: SearchType }>) {
      return {
        ...state,
        query: action.payload.query,
        searchType: action.payload.searchType,
      };
    },
  },
  extraReducers: builder => {
    builder.addCase(
      doSearch.fulfilled,
      (state, action: PayloadAction<SearchResultsPayloadType>) => {
        const { query, searchResultContactsAndGroups, searchResultMessages, searchType } =
          action.payload;
        // Reject if the associated query is not the most recent user-provided query
        if (state.query !== query) {
          return state;
        }
        // Reject if the associated searchType does not correspond to the most recent user-provided searchType
        if (state.searchType !== searchType) {
          window.log.warn('doSearch: searchType does not match: ', state.searchType, searchType);
          return state;
        }
        return {
          ...state,
          query,
          searchResultContactsAndGroups,
          searchResultMessages,
          searchType,
        };
      }
    );
  },
});

export const reducer = searchSlice.reducer;
export const searchActions = {
  ...searchSlice.actions,
  search: doSearch,
};
