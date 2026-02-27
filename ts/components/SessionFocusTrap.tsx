import { FocusTrap, type FocusTrapProps } from 'focus-trap-react';
import { type ReactNode, useEffect, useState } from 'react';
import type { CSSProperties } from 'styled-components';
import { windowErrorFilters } from '../util/logger/renderer_process_logging';

const focusTrapErrorSource = 'focus-trap';

type SessionFocusTrapProps = FocusTrapProps['focusTrapOptions'] & {
  children: ReactNode;
  active?: boolean;
  containerDivStyle?: CSSProperties;
  /** Suppress errors thrown from inside the focus trap, preventing logging or global error emission */
  suppressErrors?: boolean;
  /** Allows the focus trap to exist without detectable tabbable elements. This is required if the children
   * are within a Shadow DOM. Internally sets suppressErrors to true. */
  allowNoTabbableNodes?: boolean;
};

export function SessionFocusTrap({
  children,
  active = true,
  allowOutsideClick = true,
  containerDivStyle,
  suppressErrors,
  allowNoTabbableNodes,
  onPostActivate,
  onDeactivate,
  ...rest
}: SessionFocusTrapProps) {
  const defaultTabIndex = allowNoTabbableNodes ? 0 : -1;
  const _suppressErrors = suppressErrors || allowNoTabbableNodes;
  /**
   * NOTE: the tab index tricks the focus trap into thinking it has
   * tabbable children by setting a tab index on the empty div child. When
   * the trap activates it will see the div in the tab list and render without
   * error, then remove that div from the tab index list. Then when the trap
   * deactivates the state is reset.
   */
  const [tabIndex, setTabIndex] = useState<0 | 1 | -1>(defaultTabIndex);

  const _onPostActivate = () => {
    if (allowNoTabbableNodes) {
      setTabIndex(-1);
    }
    onPostActivate?.();
  };

  const _onDeactivate = () => {
    if (allowNoTabbableNodes) {
      setTabIndex(defaultTabIndex);
    }
    onDeactivate?.();
  };

  useEffect(() => {
    if (!active || !_suppressErrors) {
      return;
    }
    windowErrorFilters.add(focusTrapErrorSource);
    // eslint-disable-next-line consistent-return -- This return is the destructor
    return () => {
      windowErrorFilters.remove(focusTrapErrorSource);
    };
  }, [_suppressErrors, active]);

  return (
    <FocusTrap
      active={active}
      focusTrapOptions={{
        ...rest,
        allowOutsideClick,
        onPostActivate: _onPostActivate,
        onDeactivate: _onDeactivate,
      }}
    >
      {/* Note: without this div, the focus trap doesn't work */}
      <div style={containerDivStyle}>
        {allowNoTabbableNodes ? <div tabIndex={tabIndex} /> : null}
        {children}
      </div>
    </FocusTrap>
  );
}
