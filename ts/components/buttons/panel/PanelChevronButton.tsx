import type { SettingsChevron } from 'react';
import { LUCIDE_ICONS_UNICODE } from '../../icon/lucide';
import {
  GenericPanelButtonWithAction,
  type GenericPanelButtonProps,
} from './GenericPanelButtonWithAction';
import { AnimatedSpinnerIcon } from '../../loading/spinner/AnimatedSpinnerIcon';
import { LucideIcon } from '../../icon/LucideIcon';

type PanelChevronButtonProps = Pick<GenericPanelButtonProps, 'textElement'> & {
  onClick?: (...args: Array<any>) => void;
  disabled?: boolean;
  baseDataTestId: SettingsChevron;
  showAnimatedSpinnerIcon?: boolean;
};

export const PanelChevronButton = (props: PanelChevronButtonProps) => {
  const { onClick, disabled = false, baseDataTestId, textElement, showAnimatedSpinnerIcon } = props;

  return (
    <GenericPanelButtonWithAction
      onClick={disabled ? undefined : onClick}
      rowDataTestId={`${baseDataTestId}-settings-row`}
      textElement={textElement}
      actionElement={
        showAnimatedSpinnerIcon ? (
          <AnimatedSpinnerIcon size="huge" />
        ) : (
          <LucideIcon
            dataTestId={`${baseDataTestId}-settings-chevron`}
            unicode={LUCIDE_ICONS_UNICODE.CHEVRON_RIGHT}
            iconSize="medium"
            iconColor="var(--text-primary-color)"
            style={{ paddingInlineEnd: 'var(--margins-xs)' }}
          />
        )
      }
    />
  );
};
