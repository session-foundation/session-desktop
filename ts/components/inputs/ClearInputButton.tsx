import type { SessionDataTestId } from 'react';

import { SessionLucideIconButton } from '../icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';
import { alignButtonEndAbsoluteButtonStyle } from './sharedStyles';

export const ClearInputButton = ({
  onClearInputClicked,
  dataTestId,
  show,
}: {
  onClearInputClicked: () => void;
  dataTestId: SessionDataTestId;
  show: boolean;
}) => {
  const style = alignButtonEndAbsoluteButtonStyle();

  if (!show) {
    return null;
  }

  return (
    <SessionLucideIconButton
      ariaLabel="clear input"
      unicode={LUCIDE_ICONS_UNICODE.X}
      iconColor={'var(--text-primary-color)'}
      iconSize="medium"
      onClick={onClearInputClicked}
      style={style}
      dataTestId={dataTestId}
    />
  );
};
