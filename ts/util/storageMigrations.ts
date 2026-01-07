import { getOurPubKeyStrFromCache } from '../session/utils/User';
import { Registration } from './registration';
import { getStorageSchemaVersion, setStorageSchemaVersion, Storage } from './storage';

type StorageMigrationFn = (currentVersion: number) => void | Promise<void>;

const migrations: Array<StorageMigrationFn> = [updateToStorageSchemaVersion1];

async function migrateLegacyReduxPersist() {
  const values = localStorage.getItem('persist:root');
  if (!values) {
    window.log.info('[migrateLegacyReduxPersist] no localStorage value for redux-persist');
    return;
  }
  // NOTE: regardless of what happens in this function, the redux persist local storage item will be deleted
  try {
    const reduxPersistKeys = ['audioAutoplay', 'showRecoveryPhrasePrompt', 'hideMessageRequests'];

    window.log.info('[migrateLegacyReduxPersist] migrating redux-persist');
    const reduxPersist = JSON.parse(values);

    if (!reduxPersist || typeof reduxPersist !== 'object') {
      window.log.warning(`[migrateLegacyReduxPersist] reduxPersist not an object: ${reduxPersist}`);
      return;
    }

    if ('userConfig' in reduxPersist && typeof reduxPersist.userConfig === 'string') {
      const userConfig = JSON.parse(reduxPersist.userConfig);
      if (!userConfig || typeof userConfig !== 'object') {
        window.log.warning(`[migrateLegacyReduxPersist] userConfig not an object: ${userConfig}`);
        return;
      }

      for (let i = 0; i < reduxPersistKeys.length; i++) {
        const key = reduxPersistKeys[i];
        if (key in userConfig) {
          const value = userConfig[key];
          if (typeof value === 'boolean') {
            // eslint-disable-next-line no-await-in-loop
            await Storage.put(key, value);
            window.log.info(
              `[migrateLegacyReduxPersist] migrated redux-persist ${key} with value: ${value}`
            );
          }
        }
      }
    }
  } catch (e) {
    window.log.error('[migrateLegacyReduxPersist] encountered an error: ', e);
  } finally {
    window.log.info('[migrateLegacyReduxPersist] deleting persist:root from localStorage');
    localStorage.removeItem('persist:root');
  }
}

function mapOldThemeToNew(theme: string) {
  switch (theme) {
    case 'light':
      return 'classic-light';
    case 'dark':
    case 'android-dark':
    case 'android':
    case 'ios':
    case '':
      return 'classic-dark';
    default:
      return theme;
  }
}

/*
 * This first migration handles all legacy storage migrations and sets up storage as a versioned system.
 * These migrations make no assumption of the users initial state as there is no guarentee the user
 * has any of these legacy things, making this migration the only optional one, in the sense that it
 * can mutate the state, but only if it needs mutation.
 * 1. Legacy theme
 * 2. Legacy pubkey
 * 3. Removal of redux-persist
 */
async function updateToStorageSchemaVersion1(currentVersion: number) {
  const targetVersion = 1;
  if (currentVersion >= targetVersion) {
    return;
  }
  window.log.info(`updateToStorageSchemaVersion${targetVersion}: starting...`);

  const theme = Storage.get('theme-setting', 'classic-dark');
  if (theme && typeof theme === 'string') {
    const value = mapOldThemeToNew(theme);
    await Storage.put('settingsTheme', value);
    await Storage.remove('theme-setting');
  } else {
    await Storage.put('settingsTheme', 'classic-dark');
  }

  // Ensure accounts created prior to 1.0.0-beta8 do have their 'primaryDevicePubKey' defined.
  if (Registration.isDone() && !Storage.get('primaryDevicePubKey')) {
    await Storage.put('primaryDevicePubKey', getOurPubKeyStrFromCache());
  }

  await migrateLegacyReduxPersist();

  await setStorageSchemaVersion(targetVersion);

  window.log.info(`updateToStorageSchemaVersion${targetVersion}: success!`);
}

export async function updateStorageSchema() {
  const currentVersion = getStorageSchemaVersion();

  for (let i = 0; i < migrations.length; i++) {
    const runSchemaUpdate = migrations[i];
    // eslint-disable-next-line no-await-in-loop
    await runSchemaUpdate(currentVersion);
  }
}
