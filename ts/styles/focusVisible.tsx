import { css } from 'styled-components';

export const focusVisibleOutline = (outlineOffset?: string) => css`
  &:focus-visible {
    box-shadow: none;
    outline: var(--outline-focus-visible-small);
    outline-offset: ${outlineOffset ?? 'var(--outline-focus-visible-small-offset)'};
  }
`;

export function focusVisibleOutlineStr(outlineOffset?: string) {
  return `box-shadow: none;
    outline: var(--outline-focus-visible-small);
    outline-offset: ${outlineOffset ?? 'var(--outline-focus-visible-small-offset)'};`;
}

export const focusVisibleBoxShadowOutset = () => {
  return css`
    &:focus-visible {
      box-shadow: var(--box-shadow-focus-visible-outset);
    }
  `;
};

export function focusVisibleBoxShadowOutsetStr() {
  return `box-shadow: var(--box-shadow-focus-visible-outset);`;
}

export const focusVisibleBoxShadowInset = (borderRadius?: string) => {
  return css`
    &:focus-visible {
      box-shadow: var(--box-shadow-focus-visible-inset);
      ${borderRadius && `border-radius: ${borderRadius};`}
    }
  `;
};

export function focusVisibleBoxShadowInsetStr(borderRadius?: string) {
  return `box-shadow: var(--box-shadow-focus-visible-inset);
    ${borderRadius && `border-radius: ${borderRadius};`}`;
}
