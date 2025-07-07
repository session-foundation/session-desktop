import { Dispatch } from '@reduxjs/toolkit';
import { debounce } from 'lodash';
import { useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { searchActions, type DoSearchActionType, type SearchType } from '../state/ducks/search';
import { getConversationsCount } from '../state/selectors/conversations';
import { useLeftOverlayMode } from '../state/selectors/section';
import { useHotkey } from '../hooks/useHotkey';
import { localize } from '../localization/localeTools';
import { SessionLucideIconButton } from './icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from './icon/lucide';
import { LucideIcon } from './icon/LucideIcon';

const StyledSearchInput = styled.div`
  height: var(--search-input-height);
  background-color: var(--background-tertiary-color);
  width: 100%;
  // max width because it doesn't look good on a wide dialog otherwise
  max-width: 300px;
  margin-inline-end: 1px;
  margin-bottom: 10px;
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  padding-inline: var(--margins-sm);
  border-radius: 100px;
`;

const StyledInput = styled.input`
  width: inherit;
  height: inherit;
  border: none;
  flex-grow: 1;
  font-size: var(--font-size-sm);
  font-family: var(--font-default);
  text-overflow: ellipsis;
  background: none;
  color: var(--search-bar-text-control-color);

  &:focus {
    color: var(--search-bar-text-user-color);
    outline: none !important;
  }
`;

const doTheSearch = (dispatch: Dispatch<any>, searchOpts: DoSearchActionType) => {
  dispatch(searchActions.search(searchOpts));
};

const debouncedSearch = debounce(doTheSearch, 50);

function updateSearch(dispatch: Dispatch<any>, searchOpts: DoSearchActionType) {
  if (!searchOpts.query) {
    dispatch(searchActions.clearSearch());
    return;
  }

  // this updates our current state and text field.
  dispatch(searchActions.updateSearchTerm(searchOpts));

  debouncedSearch(dispatch, searchOpts);
}

export const SessionSearchInput = ({ searchType }: { searchType: SearchType }) => {
  const [currentSearchTerm, setCurrentSearchTerm] = useState('');
  const dispatch = useDispatch();
  const isGroupCreationSearch = useLeftOverlayMode() === 'closed-group';
  const convoCount = useSelector(getConversationsCount);

  const inputRef = useRef<HTMLInputElement>(null);

  useHotkey('Escape', () => {
    if (inputRef.current !== null && inputRef.current === document.activeElement) {
      setCurrentSearchTerm('');
      dispatch(searchActions.clearSearch());
    }
  });

  // just after onboard we only have a conversation with ourself
  if (convoCount <= 1) {
    return null;
  }

  const iconSize = 'medium';

  const placeholder = isGroupCreationSearch
    ? localize('searchContacts').toString()
    : localize('search').toString();

  const isInMainScreen = searchType === 'global' || searchType === 'create-group';

  const backgroundColor = isInMainScreen ? 'transparent' : undefined;

  return (
    <StyledSearchInput
      data-testid={isGroupCreationSearch ? 'search-contacts-field' : undefined}
      style={{ backgroundColor }}
    >
      <LucideIcon
        iconColor="var(--search-bar-icon-color)"
        iconSize={iconSize}
        unicode={LUCIDE_ICONS_UNICODE.SEARCH}
      />
      <StyledInput
        ref={inputRef}
        value={currentSearchTerm}
        onChange={e => {
          const inputValue = e.target.value;
          setCurrentSearchTerm(inputValue);
          updateSearch(dispatch, {
            query: inputValue,
            searchType,
          });
        }}
        placeholder={placeholder}
        style={{ borderWidth: '0' }}
      />
      {Boolean(currentSearchTerm.length) && (
        <SessionLucideIconButton
          iconColor="var(--search-bar-icon-color)"
          iconSize={iconSize}
          unicode={LUCIDE_ICONS_UNICODE.X}
          onClick={() => {
            setCurrentSearchTerm('');
            dispatch(searchActions.clearSearch());
          }}
        />
      )}
    </StyledSearchInput>
  );
};
