import styled from 'styled-components';

export const StyledPanelButtonSeparator = styled.div`
  width: calc(100% -2 * var(--margins-lg));
  // yes, 0.5px because 1px makes it sometimes 2, sometimes 1px and it is weird to have different
  // separator sizes in the same radio group
  height: 0.5px;
  background-color: var(--border-color);
  margin-inline: var(--margins-lg);

  &:last-child {
    display: none;
  }
`;
