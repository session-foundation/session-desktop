import type { SettingsToggles } from 'react';
import { PanelButtonTextWithSubText } from '../../../buttons/panel/PanelButton';
import { PanelToggleButton } from '../../../buttons/panel/PanelToggleButton';
import { type TrArgs } from '../../../../localization/localeTools';

export function SettingsToggleBasic({
  active,
  baseDataTestId,
  onClick,
  text,
  subText,
}: {
  text: TrArgs;
  subText: TrArgs;
  baseDataTestId: SettingsToggles;
  active: boolean;
  onClick: () => Promise<void>;
}) {
  return (
    <PanelToggleButton
      textElement={
        <PanelButtonTextWithSubText
          text={text}
          subText={subText}
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
