import type { SessionDataTestId } from 'react';
import { alignButtonEndAbsoluteButtonStyle } from './sharedStyles';
import { SessionLucideIconButton } from '../icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';
import { focusVisibleOutlineStr } from '../../styles/focusVisible';

type ShowHideButtonStrings<T extends string> = { hide: T; show: T };

export type ShowHideButtonProps = {
  forceShow: boolean;
  toggleForceShow: () => void;
  hasError: boolean;
  ariaLabels: ShowHideButtonStrings<string>;
  dataTestIds: ShowHideButtonStrings<SessionDataTestId>;
};

export const ShowHideButton = (props: ShowHideButtonProps) => {
  const { forceShow, toggleForceShow, hasError, ariaLabels, dataTestIds } = props;

  const style = alignButtonEndAbsoluteButtonStyle();

  return (
    <SessionLucideIconButton
      ariaLabel={forceShow ? ariaLabels.hide : ariaLabels.show}
      unicode={forceShow ? LUCIDE_ICONS_UNICODE.EYE_OFF : LUCIDE_ICONS_UNICODE.EYE}
      iconColor={hasError ? 'var(--danger-color)' : 'var(--text-secondary-color)'}
      iconSize="large"
      onClick={toggleForceShow}
      style={style}
      dataTestId={forceShow ? dataTestIds.hide : dataTestIds.show}
      // just some padding for the focus-visible to look good
      focusVisibleEffect={focusVisibleOutlineStr('2px')}
    />
  );
};
