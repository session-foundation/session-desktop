import type { SessionDataTestId } from 'react';
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
  const style = alignButtonEndAbsoluteButtonStyle();

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
