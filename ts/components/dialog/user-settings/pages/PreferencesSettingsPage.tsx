import useUpdate from 'react-use/lib/useUpdate';

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
import { SettingsKey } from '../../../../data/settings-key';
import { ToastUtils } from '../../../../session/utils';
import { PanelRadioButton } from '../../../buttons/panel/PanelRadioButton';
import { useHasEnterSendEnabled } from '../../../../state/selectors/settings';
import { isLinux } from '../../../../OS';

async function toggleStartInTray() {
  try {
    const newValue = !(await window.getStartInTray());

    await window.setStartInTray(newValue);
    if (!newValue) {
      ToastUtils.pushRestartNeeded();
    }
  } catch (e) {
    window.log.warn('start in tray change error:', e);
  }
}

async function toggleAutoStart() {
  try {
    const newValue = !(await window.getAutoStartEnabled());

    await window.setAutoStartEnabled(newValue);
  } catch (e) {
    window.log.warn('auto start change error:', e);
  }
}

function SendWithShiftEnter() {
  const initialSetting = useHasEnterSendEnabled();
  const selectedWithSettingTrue = 'enterForNewLine';
  const selectedWithSettingFalse = 'enterForSend';
  const forceUpdate = useUpdate();

  const selected = initialSetting ? selectedWithSettingTrue : selectedWithSettingFalse;

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
              onSelect={async () => {
                await window.setSettingValue(
                  SettingsKey.hasShiftSendEnabled,
                  value === selectedWithSettingTrue
                );
                forceUpdate();
              }}
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
  const isStartInTrayActive = Boolean(window.getSettingValue(SettingsKey.settingsStartInTray));

  const platformIsLinux = isLinux();
  const isAutoStartActive = platformIsLinux
    ? false
    : Boolean(window.getSettingValue(SettingsKey.settingsAutoStart));
  const forceUpdate = useUpdate();

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
          onClick={async () => {
            const old = Boolean(window.getSettingValue(SettingsKey.settingsAutoUpdate));
            await window.setSettingValue(SettingsKey.settingsAutoUpdate, !old);
            forceUpdate();
          }}
          active={Boolean(window.getSettingValue(SettingsKey.settingsAutoUpdate))}
        />
      </PanelButtonGroup>
      <PanelLabelWithDescription title={{ token: 'tray' }} />
      <PanelButtonGroup>
        <SettingsToggleBasic
          baseDataTestId="auto-update"
          text={{ token: 'permissionsKeepInSystemTray' }}
          subText={{ token: 'permissionsKeepInSystemTrayDescription' }}
          onClick={async () => {
            await toggleStartInTray();
            forceUpdate();
          }}
          active={isStartInTrayActive}
        />
      </PanelButtonGroup>
      <PanelLabelWithDescription title={{ token: 'settingsStartCategoryDesktop' }} />
      <PanelButtonGroup>
        <SettingsToggleBasic
          baseDataTestId="auto-start"
          text={{ token: 'launchOnStartDesktop' }}
          subText={{ token: 'launchOnStartDescriptionDesktop' }}
          onClick={async () => {
            await toggleAutoStart();
            forceUpdate();
          }}
          active={isAutoStartActive}
          unavailableProps={{
            unavailable: platformIsLinux,
            modalReasonTitle: { token: 'settingsCannotChangeDesktop' },
            modalReasonDescription: { token: 'launchOnStartupDisabledDesktop' },
          }}
        />
      </PanelButtonGroup>
      <SendWithShiftEnter />
    </SessionWrapperModal>
  );
}
