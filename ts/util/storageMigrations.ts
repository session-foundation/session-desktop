import { getStorageSchemaVersion, setStorageSchemaVersion, Storage } from './storage';
import type { SettingsKeyType } from '../data/settings-key';

type StorageMigrationFn = (currentVersion: number) => void | Promise<void>;

const migrations: Array<StorageMigrationFn> = [updateToStorageSchemaVersion1];

async function updateToStorageSchemaVersion1(currentVersion: number) {
  const targetVersion = 1;
  if (currentVersion >= targetVersion) {
    return;
  }
  console.log(`updateToStorageSchemaVersion${targetVersion}: starting...`);

  const versionedStorageSettingsKeyMap: Array<[string, SettingsKeyType]> = [
    ['read-receipt-setting', 'settingsReadReceipt'],
    ['typing-indicators-settings', 'settingsTypingIndicator'],
    ['auto-update', 'settingsAutoUpdate'],
    ['hasShiftSendEnabled', 'settingsShiftSend'],
    ['hide-menu-bar', 'settingsHideMenuBar'],
    ['spell-check', 'settingsSpellCheck'],
    ['link-preview-setting', 'settingsLinkPreview'],
    ['hasBlindedMsgRequestsEnabled', 'settingsBlindedMsgRequests'],
    ['start-in-tray-setting', 'settingsStartInTray'],
    ['prune-setting', 'settingsOpenGroupPruning'],
    ['notification-setting', 'settingsNotification'],
    ['audio-notification-setting', 'settingsAudioNotification'],
    ['hasSyncedInitialConfigurationItem', 'settingsSyncedInitialConfigurationItem'],
    ['ntsAvatarExpiryMs', 'settingsNtsAvatarExpiryMs'],
    ['hasLinkPreviewPopupBeenDisplayed', 'settingsLinkPreviewPopupHasDisplayed'],
    ['hasFollowSystemThemeEnabled', 'settingsFollowSystemTheme'],
    ['hideRecoveryPassword', 'settingsHideRecoveryPassword'],
    ['latestUserProfileEnvelopeTimestamp', 'latestUserProfileEnvelopeTimestamp'],
    ['latestUserGroupEnvelopeTimestamp', 'latestUserGroupEnvelopeTimestamp'],
    ['latestUserContactsEnvelopeTimestamp', 'latestUserContactsEnvelopeTimestamp'],
    ['settingsShowOnboardingAccountJustCreated', 'settingsShowOnboardingAccountJustCreated'],
  ];

  for (let i = 0; i < versionedStorageSettingsKeyMap.length; i++) {
    const [oldKey, newKey] = versionedStorageSettingsKeyMap[i];
    const oldValue = Storage.get(oldKey);

    if (typeof oldValue !== 'undefined') {
      // eslint-disable-next-line no-await-in-loop
      await Storage.put(newKey, oldValue);
      // eslint-disable-next-line no-await-in-loop
      await Storage.remove(oldKey);
    }
  }

  await setStorageSchemaVersion(targetVersion);

  console.log(`updateToStorageSchemaVersion${targetVersion}: success!`);
}

export async function updateStorageSchema() {
  const currentVersion = getStorageSchemaVersion();

  for (let i = 0; i < migrations.length; i++) {
    const runSchemaUpdate = migrations[i];
    // eslint-disable-next-line no-await-in-loop
    await runSchemaUpdate(currentVersion);
  }
}
