import { merge } from 'lodash';
import {
  isSettingsBoolKey,
  type SettingsBoolKey,
  SettingsDefault,
  SettingsKey,
} from '../data/settings-key';
import { sqlNode } from './sql';

type BoolSettingsDBItems = Record<SettingsBoolKey, boolean>;
let boolSettingsDbItems: BoolSettingsDBItems | undefined;

function initDBBoolSettings(): void {
  const array = sqlNode.getAllItems();
  const items: Partial<BoolSettingsDBItems> = {};

  for (let i = 0; i < array.length; i++) {
    const item = array[i];

    if (item && isSettingsBoolKey(item.id) && typeof item.value === 'boolean') {
      items[item.id] = item.value;
    }
  }

  boolSettingsDbItems = merge(SettingsDefault, items);
}

function getDBBoolSettings() {
if (boolSettingsDbItems === undefined) {
    initDBBoolSettings();
  }

  return boolSettingsDbItems!;
}

function setDBBoolSettingsValue(key: SettingsBoolKey, value: boolean) {
  if (boolSettingsDbItems === undefined) {
    initDBBoolSettings();
  }

  boolSettingsDbItems![key] = value;
}

function getSettingsBoolKey(key: SettingsBoolKey) {
  return getDBBoolSettings()[key];
}

export function getSpellCheckSetting() {
  return getSettingsBoolKey(SettingsKey.settingsSpellCheck);
}

export function getStartInTraySetting() {
  return getSettingsBoolKey(SettingsKey.settingsStartInTray);
}

export function getAutoUpdateSetting() {
  return getSettingsBoolKey(SettingsKey.settingsAutoUpdate);
}

export function getPermissionMediaSetting() {
  return getSettingsBoolKey(SettingsKey.settingsPermissionMedia);
}

/**
 * Sets a setting's in-memory value, this does not update the database value,
 * this should be handled by the react-side storage channel. This should be used to sync
 * the state between node and react
 */
export function setInMemorySetting(key: SettingsBoolKey, value: boolean) {
  setDBBoolSettingsValue(key, value);
}
