import { useMemo } from 'react';
import { debounce } from 'lodash';
import styled from 'styled-components';
import { LUCIDE_ICONS_UNICODE } from '../../../icon/lucide';
import { tr } from '../../../../localization';
import { LucideIcon } from '../../../icon/LucideIcon';

const StyledSearchInput = styled.div`
  height: var(--search-input-height);
  width: 100%;
  margin-inline-end: 1px;
  margin-bottom: 10px;
  display: inline-flex;
  flex-shrink: 0;

  margin-top: var(--margins-sm);
  flex-shrink: 0;

  .session-icon-button {
    margin: auto 10px;
    &:hover svg path {
      fill: var(--search-bar-icon-hover-color);
    }
  }

  &:hover {
    svg path:first-child {
      fill: var(--search-bar-icon-hover-color);
    }
  }
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

export const SessionGifSearchInput = ({ search }: { search: (searchTerm: string) => void }) => {
  const debouncedSearch = useMemo(
    () => debounce(search, 500, { leading: false, trailing: true }),
    [search]
  );

  return (
    <StyledSearchInput>
      <LucideIcon
        iconColor="var(--search-bar-icon-color)"
        iconSize="medium"
        unicode={LUCIDE_ICONS_UNICODE.SEARCH}
      />
      <StyledInput
        onChange={e => debouncedSearch(e.target.value)}
        placeholder={tr('searchForGifs')}
        autoFocus={true}
      />
    </StyledSearchInput>
  );
};
