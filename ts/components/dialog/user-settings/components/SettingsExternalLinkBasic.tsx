import type { SettingsExternalLinkButtons } from 'react';
import { PanelButtonTextWithSubText } from '../../../buttons/panel/PanelButton';
import {
  GenericPanelButtonWithAction,
  type GenericPanelButtonProps,
} from '../../../buttons/panel/GenericPanelButtonWithAction';
import { LUCIDE_ICONS_UNICODE } from '../../../icon/lucide';
import type { TrArgs } from '../../../../localization/localeTools';
import { LucideIcon } from '../../../icon/LucideIcon';

const PanelExternalLinkButton = (
  props: Pick<GenericPanelButtonProps, 'textElement'> & {
    onClick?: () => void;
    baseDataTestId: SettingsExternalLinkButtons;
  }
) => {
  const { onClick, baseDataTestId, textElement } = props;

  return (
    <GenericPanelButtonWithAction
      onClick={onClick}
      rowDataTestId={`${baseDataTestId}-settings-row`}
      textElement={textElement}
      actionElement={
        <LucideIcon
          dataTestId={`${baseDataTestId}-settings-chevron`}
          unicode={LUCIDE_ICONS_UNICODE.EXTERNAL_LINK_ICON}
          iconSize="medium"
          iconColor="var(--renderer-span-primary-color)"
          style={{ paddingInlineEnd: 'var(--margins-xs)' }}
        />
      }
    />
  );
};

export function SettingsExternalLinkBasic({
  baseDataTestId,
  onClick,
  text,
  subText,
}: {
  text: TrArgs;
  subText: TrArgs;
  baseDataTestId: SettingsExternalLinkButtons;
  onClick: () => Promise<void>;
}) {
  return (
    <PanelExternalLinkButton
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
      baseDataTestId={baseDataTestId}
    />
  );
}
