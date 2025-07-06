import styled from 'styled-components';

export const StyledSessionIconButton = styled.button<{ color?: string; $isSelected?: boolean }>`
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
    ${props => (props.disabled ? '' : props.$isSelected ? '' : 'opacity: 0.6;')}
  }
`;
