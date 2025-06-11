/* eslint-disable no-restricted-syntax */
import _ from 'lodash';
import { Data } from '../../data/data';
import { SearchOptions } from '../../types/Search';
import { cleanSearchTerm } from '../../util/cleanSearchTerm';

import { UserUtils } from '../../session/utils';
import { MessageResultProps } from '../../types/message';
import { ReduxConversationType } from './conversations';

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

type SearchResultsKickoffActionType = {
  type: 'SEARCH_RESULTS';
  payload: Promise<SearchResultsPayloadType>;
};
type SearchResultsFulfilledActionType = {
  type: 'SEARCH_RESULTS_FULFILLED';
  payload: SearchResultsPayloadType;
};
type UpdateSearchTermActionType = {
  type: 'SEARCH_UPDATE';
  payload: {
    query: string;
  };
};
type ClearSearchActionType = {
  type: 'SEARCH_CLEAR';
  payload: null;
};

export type SEARCH_TYPES =
  | SearchResultsFulfilledActionType
  | UpdateSearchTermActionType
  | ClearSearchActionType;

// Action Creators

export const actions = {
  search,
  clearSearch,
  updateSearchTerm,
};

export function search(query: string): SearchResultsKickoffActionType {
  return {
    type: 'SEARCH_RESULTS',
    payload: doSearch(query), // this uses redux-promise-middleware
  };
}

async function doSearch(query: string): Promise<SearchResultsPayloadType> {
  const options: SearchOptions = {
    noteToSelf: [
      window.i18n('noteToSelf').toLowerCase(),
      window.i18n.inEnglish('noteToSelf').toLowerCase(),
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

export function clearSearch(): ClearSearchActionType {
  return {
    type: 'SEARCH_CLEAR',
    payload: null,
  };
}

export function updateSearchTerm(query: string): UpdateSearchTermActionType {
  return {
    type: 'SEARCH_UPDATE',
    payload: {
      query,
    },
  };
}

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

function getEmptyState(): SearchStateType {
  return initialSearchState;
}

export function reducer(state: SearchStateType | undefined, action: SEARCH_TYPES): SearchStateType {
  if (!state) {
    return getEmptyState();
  }

  if (action.type === 'SEARCH_CLEAR') {
    return getEmptyState();
  }

  if (action.type === 'SEARCH_UPDATE') {
    const { payload } = action;
    const { query } = payload;

    return {
      ...state,
      query,
    };
  }

  if (action.type === 'SEARCH_RESULTS_FULFILLED') {
    const { payload } = action;
    const { query, contactsAndGroups, messages } = payload;
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

  return state;
}
