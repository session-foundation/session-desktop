import type { CSSProperties } from 'styled-components';

export function alignButtonEndAbsoluteButtonStyle(): CSSProperties {
  return {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    insetInlineEnd: 'var(--margins-sm)',
  };
}
