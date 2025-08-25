import type { SettingsChevron } from 'react';
import { LUCIDE_ICONS_UNICODE } from '../../icon/lucide';
import { SessionLucideIconButton } from '../../icon/SessionIconButton';
import {
  GenericPanelButtonWithAction,
  type GenericPanelButtonProps,
} from './GenericPanelButtonWithAction';

type PanelChevronButtonProps = Pick<GenericPanelButtonProps, 'textElement'> & {
  onClick?: (...args: Array<any>) => void;
  disabled?: boolean;
  baseDataTestId: SettingsChevron;
};

export const PanelChevronButton = (props: PanelChevronButtonProps) => {
  const { onClick, disabled = false, baseDataTestId, textElement } = props;

  return (
    <GenericPanelButtonWithAction
      onClick={disabled ? undefined : onClick}
      rowDataTestId={`${baseDataTestId}-settings-row`}
      textElement={textElement}
      actionElement={
        <SessionLucideIconButton
          disabled={disabled}
          dataTestId={`${baseDataTestId}-settings-chevron`}
          unicode={LUCIDE_ICONS_UNICODE.CHEVRON_RIGHT}
          iconSize="medium"
          iconColor="var(--text-primary-color)"
          style={{ paddingInlineEnd: 'var(--margins-xs)' }}
        />
      }
    />
  );
};
