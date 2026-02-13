import styled from 'styled-components';

export const StyledAvatar = styled.div<{ $diameter: number; $isClickable: boolean }>`
  width: ${({ $diameter }) => $diameter}px;
  height: ${({ $diameter }) => $diameter}px;

  position: relative;
  vertical-align: middle;
  display: inline-block;
  border-radius: 50%;
  flex-shrink: 0;

  img {
    object-fit: cover;
    border-radius: 50%;
    height: 100%;
    width: 100%;
  }

  ${({ $isClickable }) => $isClickable && 'cursor: pointer;'}

  &:focus-visible {
    outline: var(--outline-focus-visible-small);
  }
`;
