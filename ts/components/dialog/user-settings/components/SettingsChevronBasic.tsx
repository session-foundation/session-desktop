import type { SettingsChevron } from 'react';
import type { TokenSimpleNoArgs } from '../../../../localization/locales';
import { PanelButtonTextWithSubText } from '../../../buttons/panel/PanelButton';
import { tr } from '../../../../localization/localeTools';
import { PanelChevronButton } from '../../../buttons/panel/PanelChevronButton';

export function SettingsChevronBasic({
  baseDataTestId,
  onClick,
  textToken,
  subTextToken,
}: {
  textToken: TokenSimpleNoArgs;
  subTextToken: TokenSimpleNoArgs;
  baseDataTestId: SettingsChevron;
  onClick: (() => Promise<void>) | (() => void);
}) {
  return (
    <PanelChevronButton
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
      baseDataTestId={baseDataTestId}
    />
  );
}
