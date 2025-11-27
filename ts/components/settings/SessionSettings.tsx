import { Storage } from '../../util/storage';
import { SettingsDefault, SettingsKey } from '../../data/settings-key';

export function getMediaPermissionsSettings() {
  return Storage.getBoolOr(
    SettingsKey.settingsPermissionMedia,
    SettingsDefault[SettingsKey.settingsPermissionMedia]
  );
}

export function getCallMediaPermissionsSettings() {
  return Storage.getBoolOr(
    SettingsKey.settingsPermissionCallMedia,
    SettingsDefault[SettingsKey.settingsPermissionCallMedia]
  );
}
