import type { SessionDataTestId } from 'react';
import { useHTMLDirection } from '../../util/i18n/rtlSupport';
import { SessionIconButton } from '../icon';
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
  const htmlDirection = useHTMLDirection();
  const style = alignButtonEndAbsoluteButtonStyle(htmlDirection);

  if (!show) {
    return null;
  }

  return (
    <SessionIconButton
      ariaLabel="clear input"
      iconType={'cross'}
      iconColor={'var(--text-primary-color)'}
      iconSize="medium"
      onClick={onClearInputClicked}
      style={style}
      dataTestId={dataTestId}
    />
  );
};
