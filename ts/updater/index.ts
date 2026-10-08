import type { BrowserWindow } from 'electron';
import { start as startUpdater, stop as stopUpdater } from './updater';
import type { UserConfig } from '../node/config/user_config';
import type { LoggerType } from '../util/logger/Logging';
import { autoUpdateDisabled } from './auto_update_disabled';

let initialized = false;

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

  if (autoUpdateDisabled(userConfig.get('autoUpdate'))) {
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
