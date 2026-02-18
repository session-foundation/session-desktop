import styled from 'styled-components';

export const StyledSessionIconButton = styled.button<{
  color?: string;
  $isSelected?: boolean;
  $isDarkTheme: boolean;
  $focusVisibleEffect?: string;
}>`
  background-color: var(--button-icon-background-color);
  transition:
    color var(--default-duration),
    background-color var(--default-duration),
    filter var(--default-duration);
  // Note: this styled component is used for both the Lucide (font) and the Legacy Icons (svg)

  svg path {
    transition:
      color var(--default-duration),
      background-color var(--default-duration),
      filter var(--default-duration);
    ${props =>
      !props.color &&
      `fill:
        ${
          props.$isSelected
            ? 'var(--button-icon-stroke-selected-color)'
            : 'var(--text-secondary-color)'
        };`}
  }

  color: ${props =>
    props.color
      ? props.color
      : props.$isSelected
        ? 'var(--button-icon-stroke-selected-color)'
        : 'var(--text-secondary-color)'};

  ${props => props.disabled && 'cursor: not-allowed;'}

  &:hover svg path {
    ${props => !props.disabled && !props.color && 'fill: var(--button-icon-stroke-hover-color);'}
  }

  &:focus-visible {
    ${props => (!props.disabled && props.$focusVisibleEffect ? props.$focusVisibleEffect : '')}
  }
`;
