import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { compact } from 'lodash';
import { Data } from '../../data/data';
import { SearchOptions } from '../../types/Search';
import { cleanSearchTerm } from '../../util/cleanSearchTerm';

import { UserUtils } from '../../session/utils';
import { MessageResultProps } from '../../types/message';
import { ReduxConversationType } from './conversations';
import { localize } from '../../localization/localeTools';
import { BlockedNumberController } from '../../util';

export type SearchType = 'global' | 'create-group' | 'invite-contact-to' | 'manage-group-members';

export type SearchStateType = {
  /**
   * We can do a search globally (left pane) or to invite contacts/create a group.
   * This field is used to make sure we don't update multiple parts of the UI.
   * */
  searchType: SearchType | null;
  query: string;
  // For conversations we store just the id, and pull conversation props in the selector
  contactsAndGroups: Array<string>;
  messages?: Array<MessageResultProps>;
};

type SearchResultsPayloadType = Pick<
  SearchStateType,
  'searchType' | 'query' | 'contactsAndGroups' | 'messages'
>;

export type DoSearchActionType = {
  query: string;
  searchType: SearchType;
};

const doSearch = createAsyncThunk(
  'search/doSearch',
  async ({ query, searchType }: DoSearchActionType): Promise<SearchResultsPayloadType> => {
    const options: SearchOptions = {
      noteToSelf: [
        localize('noteToSelf').toLowerCase(),
        localize('noteToSelf').forceEnglish().toLowerCase(),
      ],
      savedMessages: localize('savedMessages').toString().toLowerCase(),
      ourNumber: UserUtils.getOurPubKeyStrFromCache(),
      excludeBlocked: searchType !== 'global',
    };
    const processedQuery = query;

    const [contactsAndGroups, messages] = await Promise.all([
      queryContactsAndGroups(processedQuery, options),
      // we only need to query messages for the global search
      searchType === 'global' ? queryMessages(processedQuery) : Promise.resolve([]),
    ]);
    const filteredMessages = compact(messages);

    return {
      query,
      contactsAndGroups,
      messages: filteredMessages,
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

async function queryContactsAndGroups(providedQuery: string, options: SearchOptions) {
  const { ourNumber, noteToSelf, savedMessages } = options;
  // we don't need to use cleanSearchTerm here because the query is wrapped as a wild card and is not referenced in the SQL query directly
  const query = providedQuery.replace(/[+-.()]*/g, '');

  const searchResults: Array<ReduxConversationType> = await Data.searchConversations(query);

  const filteredResults = options.excludeBlocked
    ? searchResults.filter(c => !BlockedNumberController.isBlocked(c.id))
    : searchResults;

  let contactsAndGroups: Array<string> = filteredResults.map(conversation => conversation.id);

  const queryLowered = query.toLowerCase();
  if (
    noteToSelf.some(str => str.includes(query) || str.includes(queryLowered)) ||
    savedMessages.includes(query) ||
    savedMessages.includes(queryLowered)
  ) {
    // Ensure that we don't have duplicates in our results
    contactsAndGroups = contactsAndGroups.filter(id => id !== ourNumber);
    contactsAndGroups.unshift(ourNumber);
  }

  return contactsAndGroups;
}

// Reducer

export const initialSearchState: SearchStateType = {
  searchType: null, // by default the search is off
  query: '',
  contactsAndGroups: [],
  messages: [],
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
        const { query, contactsAndGroups, messages, searchType } = action.payload;
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
          contactsAndGroups,
          messages,
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
