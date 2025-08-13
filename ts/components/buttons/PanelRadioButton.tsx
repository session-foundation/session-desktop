import { SessionDataTestId } from 'react';
import { SessionRadio } from '../basic/SessionRadio';
import {
  GenericPanelButtonWithAction,
  type GenericPanelButtonProps,
} from './GenericPanelButtonWithAction';

type PanelRadioButtonProps = Pick<GenericPanelButtonProps, 'rowDataTestId' | 'textElement'> & {
  value: any;
  isSelected: boolean;
  onSelect?: (...args: Array<any>) => void;
  onUnselect?: (...args: Array<any>) => void;
  radioInputDataTestId: SessionDataTestId;
  disabled?: boolean;
};

export const PanelRadioButton = (props: PanelRadioButtonProps) => {
  const {
    value,
    isSelected,
    onSelect,
    onUnselect,
    disabled = false,
    rowDataTestId,
    radioInputDataTestId,
    textElement,
  } = props;

  return (
    <GenericPanelButtonWithAction
      onClick={
        disabled
          ? undefined
          : () => {
              return isSelected ? onUnselect?.('bye') : onSelect?.('hi');
            }
      }
      rowDataTestId={rowDataTestId}
      textElement={textElement}
      actionElement={
        <SessionRadio
          active={isSelected}
          value={value}
          inputName={value}
          disabled={disabled}
          inputDataTestId={radioInputDataTestId}
          style={{ paddingInlineEnd: 'var(--margins-xs)' }}
        />
      }
    />
  );
};
