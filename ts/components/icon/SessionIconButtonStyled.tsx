import styled from 'styled-components';

export const StyledSessionIconButton = styled.button<{
  color?: string;
  $isSelected?: boolean;
  $isDarkTheme: boolean;
}>`
  background-color: var(--button-icon-background-color);
  transition: var(--default-duration);
  // Note: this styled component is used for both the Lucide (font) and the Legacy Icons (svg)

  svg path {
    transition: var(--default-duration);
    ${props =>
      !props.color &&
      `fill:
        ${
          props.$isSelected
            ? 'var(--button-icon-stroke-selected-color)'
            : 'var(--button-icon-stroke-color)'
        };`}
  }

  color: ${props =>
    props.color || props.$isSelected
      ? 'var(--button-icon-stroke-selected-color)'
      : 'var(--button-icon-stroke-color)'};

  ${props => props.disabled && 'cursor: not-allowed;'}

  &:hover svg path {
    ${props => !props.disabled && !props.color && 'fill: var(--button-icon-stroke-hover-color);'}
  }

  &:hover {
    ${props =>
      props.disabled
        ? ''
        : props.$isSelected
          ? ''
          : props.$isDarkTheme
            ? 'filter: brightness(0.5);'
            : 'filter: opacity(0.5)'}// not ideal to use opacity for a hover effect, but on light theme I couldn't find another filter that worked
  }
`;
