import type { SettingsToggles } from 'react';
import type { TokenSimpleNoArgs } from '../../../../localization/locales';
import { PanelButtonTextWithSubText } from '../../../buttons/PanelButton';
import { PanelToggleButton } from '../../../buttons/PanelToggleButton';
import { tr } from '../../../../localization/localeTools';

export function SettingsToggleBasic({
  active,
  baseDataTestId,
  onClick,
  textToken,
  subTextToken,
}: {
  textToken: TokenSimpleNoArgs;
  subTextToken: TokenSimpleNoArgs;
  baseDataTestId: SettingsToggles;
  active: boolean;
  onClick: () => Promise<void>;
}) {
  return (
    <PanelToggleButton
      textElement={
        <PanelButtonTextWithSubText
          text={tr(textToken)}
          subText={tr(subTextToken)}
          textDataTestId={`${baseDataTestId}-settings-text`}
          subTextDataTestId={`${baseDataTestId}-settings-sub-text`}
        />
      }
      active={active}
      onClick={onClick}
      toggleDataTestId={`${baseDataTestId}-settings-toggle`}
      rowDataTestId={`${baseDataTestId}-settings-row`}
    />
  );
}
