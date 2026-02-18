import { FocusTrap } from 'focus-trap-react';
import { ReactNode } from 'react';
import type { CSSProperties } from 'styled-components';

/**
 * Focus trap which activates on mount.
 */
export function SessionFocusTrap({
  children,
  allowOutsideClick = true,
  returnFocusOnDeactivate,
  initialFocus,
  containerDivStyle,
}: {
  children: ReactNode;
  allowOutsideClick?: boolean;
  returnFocusOnDeactivate?: boolean;
  initialFocus: () => HTMLElement | null;
  containerDivStyle?: CSSProperties;
}) {
  return (
    <FocusTrap
      active={true}
      focusTrapOptions={{
        initialFocus,
        allowOutsideClick,
        returnFocusOnDeactivate,
      }}
    >
      {/* Note:  not too sure why, but without this div, the focus trap doesn't work */}
      <div style={containerDivStyle}>{children}</div>
    </FocusTrap>
  );
}
