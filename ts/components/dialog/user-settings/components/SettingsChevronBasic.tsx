import type { SettingsChevron } from 'react';
import { PanelButtonText, PanelButtonTextWithSubText } from '../../../buttons/panel/PanelButton';
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
  /** Omit to render the row with no second line at all, rather than a placeholder standing in for one. */
  subText?: TrArgs;
  subTextColor?: string;
  baseDataTestId: SettingsChevron;
  onClick: (() => Promise<void>) | (() => void);
  loading?: boolean;
}) {
  return (
    <PanelChevronButton
      textElement={
        subText ? (
          <PanelButtonTextWithSubText
            text={text}
            subText={subText}
            subTextColorOverride={subTextColor}
            textDataTestId={`${baseDataTestId}-settings-text`}
            subTextDataTestId={`${baseDataTestId}-settings-sub-text`}
          />
        ) : (
          <PanelButtonText text={text} textDataTestId={`${baseDataTestId}-settings-text`} />
        )
      }
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      onClick={onClick}
      baseDataTestId={baseDataTestId}
      showAnimatedSpinnerIcon={loading}
    />
  );
}
