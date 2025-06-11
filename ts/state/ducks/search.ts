import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import _ from 'lodash';
import { Data } from '../../data/data';
import { SearchOptions } from '../../types/Search';
import { cleanSearchTerm } from '../../util/cleanSearchTerm';

import { UserUtils } from '../../session/utils';
import { MessageResultProps } from '../../types/message';
import { ReduxConversationType } from './conversations';
import { localize } from '../../localization/localeTools';

// State

export type SearchStateType = {
  query: string;
  // For conversations we store just the id, and pull conversation props in the selector
  contactsAndGroups: Array<string>;
  messages?: Array<MessageResultProps>;
};

// Actions
type SearchResultsPayloadType = {
  query: string;
  contactsAndGroups: Array<string>;
  messages?: Array<MessageResultProps>;
};

const doSearch = createAsyncThunk(
  'search/doSearch',
  async (query: string): Promise<SearchResultsPayloadType> => {
    const options: SearchOptions = {
      noteToSelf: [
        localize('noteToSelf').toLowerCase(),
        localize('noteToSelf').forceEnglish().toLowerCase(),
      ],
      savedMessages: window.i18n('savedMessages').toLowerCase(),
      ourNumber: UserUtils.getOurPubKeyStrFromCache(),
    };
    const processedQuery = query;

    const [contactsAndGroups, messages] = await Promise.all([
      queryContactsAndGroups(processedQuery, options),
      queryMessages(processedQuery),
    ]);
    const filteredMessages = _.compact(messages);

    return {
      query,
      contactsAndGroups,
      messages: filteredMessages,
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

  let contactsAndGroups: Array<string> = searchResults.map(conversation => conversation.id);

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
    updateSearchTerm(state, action: PayloadAction<string>) {
      return {
        ...state,
        query: action.payload,
      };
    },
  },
  extraReducers: builder => {
    builder.addCase(
      doSearch.fulfilled,
      (state, action: PayloadAction<SearchResultsPayloadType>) => {
        const { query, contactsAndGroups, messages } = action.payload;
        // Reject if the associated query is not the most recent user-provided query
        if (state.query !== query) {
          return state;
        }

        return {
          ...state,
          query,
          contactsAndGroups,
          messages,
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
