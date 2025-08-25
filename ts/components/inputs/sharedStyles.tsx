import type { CSSProperties } from 'styled-components';

export function alignButtonEndAbsoluteButtonStyle(): CSSProperties {
  return {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    // this needs to be >= 15px to avoid overlapping with the scrollbar when it is visible
    insetInlineEnd: 'var(--margins-md)',
  };
}
