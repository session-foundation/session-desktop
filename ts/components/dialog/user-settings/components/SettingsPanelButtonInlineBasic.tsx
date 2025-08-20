import type { SettingsInlineButtons } from 'react';
import { PanelButtonTextWithSubText } from '../../../buttons/panel/PanelButton';
import { type TrArgs } from '../../../../localization/localeTools';
import {
  PanelWithButtonInline,
  type PanelWithButtonInlineProps,
} from '../../../buttons/panel/PanelWithButtonInline';

export function SettingsPanelButtonInlineBasic({
  baseDataTestId,
  onClick,
  text,
  subText,
  buttonColor,
  buttonText,
  disabled,
}: {
  text: TrArgs;
  subText: TrArgs;
  baseDataTestId: SettingsInlineButtons;
} & Pick<PanelWithButtonInlineProps, 'buttonColor' | 'buttonText' | 'onClick' | 'disabled'>) {
  return (
    <PanelWithButtonInline
      textElement={
        <PanelButtonTextWithSubText
          text={text}
          subText={subText}
          textDataTestId={`${baseDataTestId}-settings-text`}
          subTextDataTestId={`${baseDataTestId}-settings-sub-text`}
        />
      }
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      onClick={onClick}
      buttonColor={buttonColor}
      buttonText={buttonText}
      disabled={disabled}
      rowDataTestId={`${baseDataTestId}-settings-row`}
      buttonDataTestId={`${baseDataTestId}-settings-button`}
    />
  );
}
