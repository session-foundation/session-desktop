/* eslint-disable @typescript-eslint/no-misused-promises */

import useUpdate from 'react-use/lib/useUpdate';
import { SettingsKey } from '../../../data/settings-key';
import { ToastUtils } from '../../../session/utils';

import { SessionToggleWithDescription } from '../SessionSettingListItem';
import { tr } from '../../../localization/localeTools';

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

export const SettingsCategoryPermissions = () => {
  const forceUpdate = useUpdate();
  const isStartInTrayActive = Boolean(window.getSettingValue(SettingsKey.settingsStartInTray));

  return (
    <>
      <SessionToggleWithDescription
        onClickToggle={async () => {
          const old = Boolean(window.getSettingValue(SettingsKey.settingsAutoUpdate));
          await window.setSettingValue(SettingsKey.settingsAutoUpdate, !old);
          forceUpdate();
        }}
        title={tr('permissionsAutoUpdate')}
        description={tr('permissionsAutoUpdateDescription')}
        active={Boolean(window.getSettingValue(SettingsKey.settingsAutoUpdate))}
      />
      <SessionToggleWithDescription
        onClickToggle={async () => {
          await toggleStartInTray();
          forceUpdate();
        }}
        title={tr('permissionsKeepInSystemTray')}
        description={tr('permissionsKeepInSystemTrayDescription')}
        active={isStartInTrayActive}
      />
    </>
  );
};
