import type { SettingsChevron } from 'react';
import { PanelButtonTextWithSubText } from '../../../buttons/panel/PanelButton';
import { PanelChevronButton } from '../../../buttons/panel/PanelChevronButton';
import type { TrArgs } from '../../../../localization/localeTools';

export function SettingsChevronBasic({
  baseDataTestId,
  onClick,
  text,
  subText,
  subTextColor,
  loading,
}: {
  text: TrArgs;
  subText: TrArgs;
  subTextColor?: string;
  baseDataTestId: SettingsChevron;
  onClick: (() => Promise<void>) | (() => void);
  loading?: boolean;
}) {
  return (
    <PanelChevronButton
      textElement={
        <PanelButtonTextWithSubText
          text={text}
          subText={subText}
          subTextColorOverride={subTextColor}
          textDataTestId={`${baseDataTestId}-settings-text`}
          subTextDataTestId={`${baseDataTestId}-settings-sub-text`}
        />
      }
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      onClick={onClick}
      baseDataTestId={baseDataTestId}
      showAnimatedSpinnerIcon={loading}
    />
  );
}
