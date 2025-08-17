import type { SettingsInlineButtons } from 'react';
import type { TokenSimpleNoArgs } from '../../../../localization/locales';
import { PanelButtonTextWithSubText } from '../../../buttons/panel/PanelButton';
import { tr } from '../../../../localization/localeTools';
import {
  PanelWithButtonInline,
  type PanelWithButtonInlineProps,
} from '../../../buttons/panel/PanelWithButtonInline';

export function SettingsPanelButtonInlineBasic({
  baseDataTestId,
  onClick,
  textToken,
  subTextToken,
  buttonColor,
  buttonText,
  disabled,
}: {
  textToken: TokenSimpleNoArgs;
  subTextToken: TokenSimpleNoArgs;
  baseDataTestId: SettingsInlineButtons;
} & Pick<PanelWithButtonInlineProps, 'buttonColor' | 'buttonText' | 'onClick' | 'disabled'>) {
  return (
    <PanelWithButtonInline
      textElement={
        <PanelButtonTextWithSubText
          text={tr(textToken)}
          subText={tr(subTextToken)}
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
