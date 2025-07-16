import { isString } from 'lodash';
import { useSelector } from 'react-redux';
import { AutoSizer, List } from 'react-virtualized';
import styled, { CSSProperties } from 'styled-components';

import { ConversationListItem } from '../leftpane/conversation-list-item/ConversationListItem';
import { MessageSearchResult } from './MessageSearchResults';

import {
  SearchResultsMergedListItem,
  getSearchResultsList,
  useHasSearchResultsForSearchType,
  useSearchTermForType,
} from '../../state/selectors/search';
import { calcContactRowHeight } from '../leftpane/overlay/choose-action/ContactsListWithBreaks';
import { NoResultsForSearch } from './NoResults';

const StyledSeparatorSection = styled.div<{ isSubtitle: boolean }>`
  height: 36px;
  line-height: 36px;
  letter-spacing: 0;

  margin-inline-start: 16px;
  font-weight: 400;

  ${props =>
    props.isSubtitle
      ? 'color: var(--text-secondary-color); font-size: var(--font-size-sm);'
      : 'color: var(--text-primary-color); font-size: var(--font-size-lg);'}
`;

const SearchResultsContainer = styled.div`
  overflow-y: auto;
  max-height: 100%;
  color: var(--text-secondary-color);
  flex-grow: 1;
  width: -webkit-fill-available;
`;

const SectionHeader = ({
  title,
  isSubtitle,
  style,
}: {
  title: string;
  isSubtitle: boolean;
  style: CSSProperties;
}) => {
  return (
    <StyledSeparatorSection isSubtitle={isSubtitle} style={style}>
      {title}
    </StyledSeparatorSection>
  );
};

function isContact(item: SearchResultsMergedListItem): item is { contactConvoId: string } {
  return (item as any).contactConvoId !== undefined;
}

const VirtualizedList = () => {
  const searchResultList = useSelector(getSearchResultsList);

  return (
    <AutoSizer>
      {({ height, width }) => (
        <List
          height={height}
          rowCount={searchResultList.length}
          rowHeight={params =>
            calcContactRowHeight(searchResultList, params, { breakRowHeight: 36 })
          }
          rowRenderer={({ index, key, style }) => {
            const row = searchResultList[index];
            if (!row) {
              return null;
            }
            if (isString(row)) {
              return (
                <SectionHeader
                  key={key}
                  title={row}
                  isSubtitle={
                    row !== window.i18n('sessionConversations') && row !== window.i18n('messages')
                  }
                  style={style as CSSProperties}
                />
              );
            }
            if (isContact(row)) {
              return (
                <ConversationListItem conversationId={row.contactConvoId} style={style} key={key} />
              );
            }
            return <MessageSearchResult style={style as CSSProperties} key={key} {...row} />;
          }}
          width={width}
          autoHeight={false}
        />
      )}
    </AutoSizer>
  );
};

export const SearchResults = () => {
  const query = useSearchTermForType('global');
  const hasSearchResults = useHasSearchResultsForSearchType('global');

  return (
    <SearchResultsContainer>
      {!hasSearchResults ? <NoResultsForSearch searchTerm={query || ''} /> : <VirtualizedList />}
    </SearchResultsContainer>
  );
};
