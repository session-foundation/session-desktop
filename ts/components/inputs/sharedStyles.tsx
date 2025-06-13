import type { CSSProperties } from 'styled-components';
import type { HTMLDirection } from '../../util/i18n/rtlSupport';

export function alignButtonEndAbsoluteButtonStyle(htmlDirection: HTMLDirection): CSSProperties {
  return {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    left: htmlDirection === 'ltr' ? undefined : 'var(--margins-sm)',
    right: htmlDirection === 'ltr' ? 'var(--margins-sm)' : undefined,
  };
}
