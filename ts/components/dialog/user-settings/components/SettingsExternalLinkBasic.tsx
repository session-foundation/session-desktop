import type { SettingsExternalLinkButtons } from 'react';
import type { TokenSimpleNoArgs } from '../../../../localization/locales';
import { PanelButtonTextWithSubText } from '../../../buttons/panel/PanelButton';
import { tr } from '../../../../localization/localeTools';
import {
  GenericPanelButtonWithAction,
  type GenericPanelButtonProps,
} from '../../../buttons/panel/GenericPanelButtonWithAction';
import { SessionLucideIconButton } from '../../../icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from '../../../icon/lucide';

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
        <SessionLucideIconButton
          dataTestId={`${baseDataTestId}-settings-chevron`}
          unicode={LUCIDE_ICONS_UNICODE.EXTERNAL_LINK_ICON}
          iconSize="medium"
          iconColor="var(--primary-color)"
          style={{ paddingInlineEnd: 'var(--margins-xs)' }}
        />
      }
    />
  );
};

export function SettingsExternalLinkBasic({
  baseDataTestId,
  onClick,
  textToken,
  subTextToken,
}: {
  textToken: TokenSimpleNoArgs;
  subTextToken: TokenSimpleNoArgs;
  baseDataTestId: SettingsExternalLinkButtons;
  onClick: () => Promise<void>;
}) {
  return (
    <PanelExternalLinkButton
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
