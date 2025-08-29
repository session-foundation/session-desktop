import { useCallback, type SettingsToggles } from 'react';
import { useDispatch } from 'react-redux';
import { PanelButtonTextWithSubText } from '../../../buttons/panel/PanelButton';
import { PanelToggleButton } from '../../../buttons/panel/PanelToggleButton';
import { type TrArgs } from '../../../../localization/localeTools';
import { showLocalizedPopupDialog } from '../../LocalizedPopupDialog';

type UnavailableProps = {
  unavailable: boolean;
  modalReasonTitle: TrArgs;
  modalReasonDescription: TrArgs;
};

type SettingsToggleBasicProps = {
  text: TrArgs;
  subText: TrArgs;
  baseDataTestId: SettingsToggles;
  active: boolean;
  unavailableProps?: UnavailableProps;
  onClick: () => Promise<void>;
};

export function SettingsToggleBasic({
  text,
  subText,
  baseDataTestId,
  active,
  onClick,
  unavailableProps,
}: SettingsToggleBasicProps) {
  const dispatch = useDispatch();

  const handleClick = useCallback(async () => {
    if (!unavailableProps?.unavailable) {
      return onClick();
    }
    return showLocalizedPopupDialog(
      {
        title: unavailableProps?.modalReasonTitle,
        description: unavailableProps?.modalReasonDescription,
        hideOkayButton: true,
      },
      dispatch
    );
  }, [unavailableProps, dispatch, onClick]);

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
      onClick={handleClick}
      toggleDataTestId={`${baseDataTestId}-settings-toggle`}
      rowDataTestId={`${baseDataTestId}-settings-row`}
    />
  );
}
