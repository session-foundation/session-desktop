import { Dispatch } from '@reduxjs/toolkit';
import { debounce } from 'lodash';
import { useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';
import { getAppDispatch } from '../state/dispatch';
import { searchActions, type DoSearchActionType, type SearchType } from '../state/ducks/search';
import { getConversationsCount } from '../state/selectors/conversations';
import { useLeftOverlayModeType } from '../state/selectors/section';
import { tr } from '../localization/localeTools';
import { SessionLucideIconButton } from './icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from './icon/lucide';
import { LucideIcon } from './icon/LucideIcon';
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut';
import { focusVisibleDisabled } from '../styles/focusVisible';
import { isEscapeKey, KbdShortcut } from '../util/keyboardShortcuts';

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
  color: var(--text-secondary-color);

  // the caret is already there to say that this is focused
  ${focusVisibleDisabled()}
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
  const dispatch = getAppDispatch();
  const isGroupCreationSearch = useLeftOverlayModeType() === 'closed-group';
  const convoCount = useSelector(getConversationsCount);

  const inputRef = useRef<HTMLInputElement>(null);

  useKeyboardShortcut({
    shortcut: KbdShortcut.conversationListSearch,
    handler: () => inputRef.current?.focus(),
  });

  // just after onboard we only have a conversation with ourself
  if (convoCount <= 1) {
    return null;
  }

  const iconSize = 'medium';

  const placeholder = isGroupCreationSearch ? tr('searchContacts') : tr('search');

  const isInMainScreen = searchType === 'global' || searchType === 'create-group';

  const backgroundColor = isInMainScreen ? 'transparent' : undefined;

  return (
    <StyledSearchInput
      data-testid={isGroupCreationSearch ? 'search-contacts-field' : undefined}
      style={{ backgroundColor }}
    >
      <LucideIcon
        iconColor="var(--text-secondary-color)"
        iconSize={iconSize}
        unicode={LUCIDE_ICONS_UNICODE.SEARCH}
      />
      <StyledInput
        data-testid="search-input"
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
        onKeyDown={e => {
          if (isEscapeKey(e)) {
            if (currentSearchTerm.length) {
              setCurrentSearchTerm('');
              dispatch(searchActions.clearSearch());
              e.stopPropagation();
              e.preventDefault();
            } else {
              inputRef.current?.blur();
              e.stopPropagation();
              e.preventDefault();
            }
          }
        }}
      />
      {currentSearchTerm.length ? (
        <SessionLucideIconButton
          iconColor="var(--text-secondary-color)"
          iconSize={iconSize}
          unicode={LUCIDE_ICONS_UNICODE.X}
          // NOTE: we dont want the clear button in the tab index list
          // as the Escape key already does this action for keyboard
          // users and we want the next tab after the search input to
          // be the first result
          tabIndex={-1}
          onClick={() => {
            setCurrentSearchTerm('');
            dispatch(searchActions.clearSearch());
          }}
        />
      ) : null}
    </StyledSearchInput>
  );
};
