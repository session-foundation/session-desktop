/* eslint-disable @typescript-eslint/no-misused-promises */
import { SessionDataTestId } from 'react';
import { SessionToggle } from '../../basic/SessionToggle';
import {
  GenericPanelButtonWithAction,
  type GenericPanelButtonProps,
} from './GenericPanelButtonWithAction';

type PanelToggleButtonProps = Pick<GenericPanelButtonProps, 'rowDataTestId' | 'textElement'> & {
  active: boolean;
  onClick: () => Promise<void>;
  toggleDataTestId: SessionDataTestId;
  disabled?: boolean;
};

export const PanelToggleButton = (props: PanelToggleButtonProps) => {
  const { active, onClick, toggleDataTestId, disabled = false, rowDataTestId, textElement } = props;

  return (
    <GenericPanelButtonWithAction
      onClick={disabled ? undefined : onClick}
      rowDataTestId={rowDataTestId}
      textElement={textElement}
      actionElement={
        <SessionToggle
          active={active}
          dataTestId={toggleDataTestId}
          style={{ paddingInlineEnd: 'var(--margins-xs)' }}
          onClick={onClick}
        />
      }
    />
  );
};
