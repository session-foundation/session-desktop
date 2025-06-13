import type { SessionDataTestId } from 'react';
import { useHTMLDirection } from '../../util/i18n/rtlSupport';
import { alignButtonEndAbsoluteButtonStyle } from './sharedStyles';
import { SessionLucideIconButton } from '../icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';

export const ClearInputButton = ({
  onClearInputClicked,
  dataTestId,
  show,
}: {
  onClearInputClicked: () => void;
  dataTestId: SessionDataTestId;
  show: boolean;
}) => {
  const htmlDirection = useHTMLDirection();
  const style = alignButtonEndAbsoluteButtonStyle(htmlDirection);

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
