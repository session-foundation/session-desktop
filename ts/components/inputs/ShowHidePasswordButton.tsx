import type { SessionDataTestId } from 'react';
import { useHTMLDirection } from '../../util/i18n/rtlSupport';
import { alignButtonEndAbsoluteButtonStyle } from './sharedStyles';
import { SessionIconButton } from '../icon';

type ShowHideButtonStrings<T extends string> = { hide: T; show: T };
type ShowHideButtonProps = {
  forceShow: boolean;
  toggleForceShow: () => void;
  hasError: boolean;
  ariaLabels: ShowHideButtonStrings<string>;
  dataTestIds: ShowHideButtonStrings<SessionDataTestId>;
};

export const ShowHideButton = (props: ShowHideButtonProps) => {
  const { forceShow, toggleForceShow, hasError, ariaLabels, dataTestIds } = props;

  const htmlDirection = useHTMLDirection();
  const style = alignButtonEndAbsoluteButtonStyle(htmlDirection);

  return (
    <SessionIconButton
      ariaLabel={forceShow ? ariaLabels.hide : ariaLabels.show}
      iconType={forceShow ? 'eyeDisabled' : 'eye'}
      iconColor={hasError ? 'var(--danger-color)' : 'var(--text-primary-color)'}
      iconSize="huge"
      onClick={toggleForceShow}
      style={style}
      dataTestId={forceShow ? dataTestIds.hide : dataTestIds.show}
    />
  );
};
