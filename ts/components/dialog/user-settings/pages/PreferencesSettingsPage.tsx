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
import { tr } from '../../../../localization/localeTools';
import { PanelRadioButton } from '../../../buttons/panel/PanelRadioButton';
import { useHasEnterSendEnabled } from '../../../../state/selectors/settings';

async function toggleStartInTray() {
  try {
    const newValue = !(await window.getStartInTray());

    // make sure to write it here too, as this is the value used on the UI to mark the toggle as true/false
    await window.setSettingValue(SettingsKey.settingsStartInTray, newValue);
    await window.setStartInTray(newValue);
    if (!newValue) {
      ToastUtils.pushRestartNeeded();
    }
  } catch (e) {
    window.log.warn('start in tray change error:', e);
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
      text: tr('conversationsSendWithEnterKey'),
      subText: tr('conversationsSendWithEnterKeyDescription'),
      value: selectedWithSettingFalse,
    },
    {
      text: tr('conversationsSendWithShiftEnter'),
      subText: tr('conversationsEnterNewLine'),
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
                  text={text}
                  subText={subText}
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
          textToken="permissionsAutoUpdate"
          subTextToken="permissionsAutoUpdateDescription"
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
          textToken="permissionsKeepInSystemTray"
          subTextToken="permissionsKeepInSystemTrayDescription"
          onClick={async () => {
            await toggleStartInTray();
            forceUpdate();
          }}
          active={isStartInTrayActive}
        />
      </PanelButtonGroup>
      <SendWithShiftEnter />
    </SessionWrapperModal>
  );
}
