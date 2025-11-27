import path from 'path';
import process from 'process';

import { app } from 'electron';

import crypto from 'crypto';
import { start } from './base_config';

let storageProfile;

// Node makes sure all environment variables are strings
const { NODE_ENV: environment, NODE_APP_INSTANCE: instance } = process.env;

// We need to make sure instance is not empty
const isValidInstance = typeof instance === 'string' && instance.length > 0;
const isProduction = environment === 'production' && !isValidInstance;

// Use separate data directories for each different environment and app instances
if (!isProduction) {
  storageProfile = environment;
  if (isValidInstance) {
    storageProfile = (storageProfile || '').concat(`-${instance}`);
  }
}

if (storageProfile) {
  const userData = path.join(app.getPath('appData'), `Session-${storageProfile}`);

  app.setPath('userData', userData);
}

console.log(`userData: ${app.getPath('userData')}`);

const userDataPath = app.getPath('userData');
const targetPath = path.join(userDataPath, 'config.json');

export const userConfig = start('user', targetPath);

export type UserConfig = typeof userConfig;

export function getUserSQLKey() {
  let key = userConfig.get('key');
  if (!key) {
    console.log('key/initialize: Generating new encryption key, since we did not find it on disk');
    // https://www.zetetic.net/sqlcipher/sqlcipher-api/#key
    key = crypto.randomBytes(32).toString('hex');
    userConfig.set('key', key);
  }

  return key as string;
}

export function getUserDBHasPassword() {
  return !!userConfig.get('dbHasPassword');
}

export function setUserDBHasPassword(hasPassword: boolean) {
  userConfig.set('dbHasPassword', hasPassword);
}

export function removeUserConfig() {
  userConfig.remove();
}
