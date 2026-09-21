import path from 'path';

import { app } from 'electron';

import { start } from './base_config';
import { getSelectedAccount, storageProfileFor } from './profiles';

/**
 * Which account this process runs, and therefore which data directory it uses. See
 * `./profiles.ts`: Session keeps one account per data directory, so every account is a separate
 * process with its own database, its own polling and its own notifications.
 *
 * The first ("default") account resolves to the directory Session has always used, so an existing
 * install keeps its account. Dev instances (`NODE_APP_INSTANCE`) keep their own independent set of
 * accounts, rooted at the directory they already used.
 */
const selectedAccount = getSelectedAccount();
const storageProfile = storageProfileFor(selectedAccount);

if (storageProfile) {
  const userData = path.join(app.getPath('appData'), `Session-${storageProfile}`);

  app.setPath('userData', userData);
}

// eslint-disable-next-line no-console
console.log(`userData: ${app.getPath('userData')} (account ${selectedAccount.id})`);

const userDataPath = app.getPath('userData');
const targetPath = path.join(userDataPath, 'config.json');

export const userConfig = start('user', targetPath);

export type UserConfig = typeof userConfig;
