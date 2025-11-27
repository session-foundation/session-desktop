import { type UserSettingsModalState } from '../../../../state/ducks/modalDialog';
import {
  PanelButtonGroup,
  PanelButtonTextWithSubText,
  PanelLabelWithDescription,
} from '../../../buttons/panel/PanelButton';
import {
  ModalBasicHeader,
  SessionWrapperModal,
  WrapperModalWidth,
} from '../../../SessionWrapperModal';
import { ModalBackButton } from '../../shared/ModalBackButton';
import {
  useUserSettingsBackAction,
  useUserSettingsCloseAction,
  useUserSettingsTitle,
} from './userSettingsHooks';
import { SettingsToggleBasic } from '../components/SettingsToggleBasic';
import { PanelRadioButton } from '../../../buttons/panel/PanelRadioButton';
import {
  useShiftEnterSendSetting,
  useAutoUpdateSetting,
  useStartInTraySetting,
  useAutoStartSetting,
} from '../../../../state/selectors/settings';

function SendWithShiftEnter() {
  const shiftEnterSendSetting = useShiftEnterSendSetting();
  const selectedWithSettingTrue = 'enterForNewLine';
  const selectedWithSettingFalse = 'enterForSend';

  const selected = shiftEnterSendSetting.enabled
    ? selectedWithSettingTrue
    : selectedWithSettingFalse;

  const items = [
    {
      text: 'conversationsSendWithEnterKey',
      subText: 'conversationsSendWithEnterKeyDescription',
      value: selectedWithSettingFalse,
    },
    {
      text: 'conversationsSendWithShiftEnter',
      subText: 'conversationsEnterNewLine',
      value: selectedWithSettingTrue,
    },
  ] as const;

  return (
    <>
      <PanelLabelWithDescription title={{ token: 'conversationsEnter' }} />
      <PanelButtonGroup>
        {items.map(({ value, text, subText }) => {
          return (
            <PanelRadioButton
              key={value}
              textElement={
                <PanelButtonTextWithSubText
                  text={{ token: text }}
                  subText={{ token: subText }}
                  textDataTestId={`send-with-${value}-settings-text`}
                  subTextDataTestId={`send-with-${value}-settings-sub-text`}
                />
              }
              value={value}
              isSelected={selected === value}
              // eslint-disable-next-line @typescript-eslint/no-misused-promises
              onSelect={shiftEnterSendSetting.toggle}
              rowDataTestId={`send-with-${value}-settings-row`}
              radioInputDataTestId={`send-with-${value}-settings-radio`}
            />
          );
        })}
      </PanelButtonGroup>
    </>
  );
}

export function PreferencesSettingsPage(modalState: UserSettingsModalState) {
  const backAction = useUserSettingsBackAction(modalState);
  const closeAction = useUserSettingsCloseAction(modalState);
  const title = useUserSettingsTitle(modalState);

  const autoUpdateSetting = useAutoUpdateSetting();
  const startInTraySetting = useStartInTraySetting();
  const autoStartSetting = useAutoStartSetting();

  return (
    <SessionWrapperModal
      headerChildren={
        <ModalBasicHeader
          title={title}
          bigHeader={true}
          showExitIcon={true}
          extraLeftButton={backAction ? <ModalBackButton onClick={backAction} /> : undefined}
        />
      }
      onClose={closeAction || undefined}
      shouldOverflow={true}
      allowOutsideClick={false}
      $contentMinWidth={WrapperModalWidth.normal}
    >
      <PanelLabelWithDescription title={{ token: 'updates' }} />
      <PanelButtonGroup>
        <SettingsToggleBasic
          baseDataTestId="auto-update"
          text={{ token: 'permissionsAutoUpdate' }}
          subText={{ token: 'permissionsAutoUpdateDescription' }}
          onClick={autoUpdateSetting.toggle}
          active={autoUpdateSetting.enabled}
        />
      </PanelButtonGroup>
      <PanelLabelWithDescription title={{ token: 'tray' }} />
      <PanelButtonGroup>
        <SettingsToggleBasic
          baseDataTestId="auto-update"
          text={{ token: 'permissionsKeepInSystemTray' }}
          subText={{ token: 'permissionsKeepInSystemTrayDescription' }}
          onClick={startInTraySetting.toggle}
          active={startInTraySetting.enabled}
        />
      </PanelButtonGroup>
      <PanelLabelWithDescription title={{ token: 'settingsStartCategoryDesktop' }} />
      <PanelButtonGroup>
        <SettingsToggleBasic
          baseDataTestId="auto-start"
          text={{ token: 'launchOnStartDesktop' }}
          subText={{ token: 'launchOnStartDescriptionDesktop' }}
          onClick={autoStartSetting.toggle}
          active={autoStartSetting.unavailable ? false : autoStartSetting.enabled}
          unavailableProps={{
            unavailable: autoStartSetting.unavailable,
            modalReasonTitle: { token: 'settingsCannotChangeDesktop' },
            modalReasonDescription: { token: 'launchOnStartupDisabledDesktop' },
          }}
        />
      </PanelButtonGroup>
      <SendWithShiftEnter />
    </SessionWrapperModal>
  );
}
