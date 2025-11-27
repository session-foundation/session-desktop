import type { BrowserWindow } from 'electron';
import { start as startUpdater, stop as stopUpdater } from './updater';
import type { LoggerType } from '../util/logger/Logging';

let initialized = false;

export async function start(
  getMainWindow: () => BrowserWindow | null,
  autoUpdateEnabled: boolean,
  logger?: LoggerType | null
) {
  if (initialized) {
    throw new Error('[updater] start: Updates have already been initialized!');
  }

  if (!logger) {
    throw new Error('[updater] start: Must provide logger!');
  }
  initialized = true;

  // process.mas is from Electron: Mac App Store build
  if (process.mas || !autoUpdateEnabled) {
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
