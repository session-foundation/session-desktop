import type { SessionDataTestId } from 'react';
import { useHTMLDirection } from '../../util/i18n/rtlSupport';
import { alignButtonEndAbsoluteButtonStyle } from './sharedStyles';
import { SessionLucideIconButton } from '../icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';

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
    <SessionLucideIconButton
      ariaLabel={forceShow ? ariaLabels.hide : ariaLabels.show}
      unicode={forceShow ? LUCIDE_ICONS_UNICODE.EYE_OFF : LUCIDE_ICONS_UNICODE.EYE}
      iconColor={hasError ? 'var(--danger-color)' : 'var(--text-primary-color)'}
      iconSize="large"
      onClick={toggleForceShow}
      style={style}
      dataTestId={forceShow ? dataTestIds.hide : dataTestIds.show}
    />
  );
};
