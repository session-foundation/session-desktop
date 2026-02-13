/* eslint-disable @typescript-eslint/no-misused-promises */
import { SessionDataTestId } from 'react';
import { SessionButton, type SessionButtonProps } from '../../basic/SessionButton';

import {
  GenericPanelButtonWithAction,
  type GenericPanelButtonProps,
} from './GenericPanelButtonWithAction';

export type PanelWithButtonInlineProps = Pick<
  GenericPanelButtonProps,
  'rowDataTestId' | 'textElement'
> &
  Required<Pick<SessionButtonProps, 'buttonColor'>> & {
    onClick: () => Promise<void>;
    buttonDataTestId: SessionDataTestId;
    disabled?: boolean;
    buttonText: string;
  };

export const PanelWithButtonInline = (props: PanelWithButtonInlineProps) => {
  const {
    onClick,
    buttonDataTestId,
    disabled = false,
    rowDataTestId,
    textElement,
    buttonText,
    buttonColor,
  } = props;
  return (
    <GenericPanelButtonWithAction
      onClick={disabled ? undefined : onClick}
      rowDataTestId={rowDataTestId}
      textElement={textElement}
      actionElement={
        <SessionButton
          // Note: no `onClick` here. The container is receiving the event
          dataTestId={buttonDataTestId}
          text={buttonText}
          buttonColor={buttonColor}
          // we need this so that the hover effect work (even if the button does not do the onClick itself)
          style={{ pointerEvents: 'all' }}
          tabIndex={-1}
        />
      }
    />
  );
};
