import type { BrowserWindow } from 'electron';
import { start as startUpdater, stop as stopUpdater } from './updater';
import type { UserConfig } from '../node/config/user_config';
import type { LoggerType } from '../util/logger/Logging';

let initialized = false;
let localUserConfig: UserConfig;

export async function start(
  getMainWindow: () => BrowserWindow | null,
  userConfig: UserConfig,
  logger?: LoggerType | null
) {
  if (initialized) {
    throw new Error('[updater] start: Updates have already been initialized!');
  }

  if (!userConfig) {
    throw new Error('[updater] start: userConfig is needed!');
  }

  if (!logger) {
    throw new Error('[updater] start: Must provide logger!');
  }
  initialized = true;
  localUserConfig = userConfig; // reused below

  if (autoUpdateDisabled()) {
    logger.info('[updater] start: Updates disabled - not starting new version checks');

    return;
  }

  await startUpdater(getMainWindow, logger);
}

export function stop() {
  if (initialized) {
    stopUpdater();
    initialized = false;
  }
}

function autoUpdateDisabled() {
  // We need to ensure that if auto update is not present in the user config then we assume it is on by default
  const userSetting = localUserConfig.get('autoUpdate');
  const autoUpdate = typeof userSetting !== 'boolean' || userSetting;

  return (
    process.mas || !autoUpdate // From Electron: Mac App Store build // User setting
  );
}
