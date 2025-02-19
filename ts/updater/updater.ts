/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable no-console */
import { app, type BrowserWindow } from 'electron';
import {
  autoUpdater,
  DOWNLOAD_PROGRESS,
  UPDATE_DOWNLOADED,
  type UpdateInfo,
} from 'electron-updater';
import * as fs from 'fs-extra';
import * as path from 'path';
import { gt as isVersionGreaterThan, parse as parseVersion } from 'semver';

import { windowMarkShouldQuit } from '../node/window_state';

import { UPDATER_INTERVAL_MS } from '../session/constants';
import type { SetupI18nReturnType } from '../types/localizer';
import {
  getPrintableError,
  type LoggerType,
  showCannotUpdateDialog,
  showDownloadUpdateDialog,
  showUpdateDialog,
} from './common';
import { getLatestRelease } from '../node/latest_desktop_release';

let isUpdating = false;
let downloadIgnored = false;
let interval: NodeJS.Timeout | undefined;
let stopped = false;

autoUpdater.on(DOWNLOAD_PROGRESS, eventDownloadProgress => {
  const progress = eventDownloadProgress.transferred / eventDownloadProgress.total;
  console.log(
    `[updater] download progress: ${progress} eventDownloadProgress.transferred ${eventDownloadProgress.transferred} eventDownloadProgress.total ${eventDownloadProgress.total}`
  );
});

autoUpdater.on(UPDATE_DOWNLOADED, () => {
  console.log('[updater] update downloaded');
});

export async function start(
  getMainWindow: () => BrowserWindow | null,
  i18n: SetupI18nReturnType,
  logger: LoggerType
) {
  if (interval) {
    logger.info('[updater] auto-update: Already running');

    return;
  }

  logger.info('[updater] auto-update: starting checks...');

  autoUpdater.logger = logger;
  autoUpdater.autoDownload = false;

  interval = global.setInterval(async () => {
    try {
      await checkForUpdates(getMainWindow, i18n, logger);
    } catch (error) {
      logger.error('[updater] auto-update: error:', getPrintableError(error));
    }
  }, UPDATER_INTERVAL_MS); // trigger and try to update every 10 minutes to let the file gets downloaded if we are updating
  stopped = false;

  global.setTimeout(
    async () => {
      try {
        await checkForUpdates(getMainWindow, i18n, logger);
      } catch (error) {
        logger.error('[updater] auto-update: error:', getPrintableError(error));
      }
    },
    2 * 60 * 1000
  ); // we do checks from the file server every 2 minutes.
}

export function stop() {
  if (interval) {
    clearInterval(interval);
    interval = undefined;
  }
  stopped = true;
}

async function checkForUpdates(
  getMainWindow: () => BrowserWindow | null,
  i18n: SetupI18nReturnType,
  logger: LoggerType
) {
  if (stopped || isUpdating || downloadIgnored) {
    logger.info('[updater] checkForUpdates stopped or isUpdating or downloadIgnored');
    return;
  }

  const canUpdate = await canAutoUpdate();
  logger.info('[updater] checkForUpdates canAutoUpdate', canUpdate);
  if (!canUpdate) {
    return;
  }

  logger.info('[updater] checkForUpdates isUpdating', isUpdating);

  isUpdating = true;

  try {
    const [latestVersionFromFsFromRenderer, releaseChannelFromFsFromRenderer] = getLatestRelease();

    logger.info(
      `[updater] checkForUpdates latestVersionFromFsFromRenderer ${latestVersionFromFsFromRenderer} releaseChannelFromFsFromRenderer ${releaseChannelFromFsFromRenderer}`
    );
    if (!latestVersionFromFsFromRenderer || !latestVersionFromFsFromRenderer?.length) {
      logger.info(
        '[updater] checkForUpdates testVersionFromFsFromRenderer was not updated yet by renderer. Skipping update check'
      );
      return;
    }

    const currentVersion = autoUpdater.currentVersion.toString();
    const isMoreRecent = isVersionGreaterThan(latestVersionFromFsFromRenderer, currentVersion);
    logger.info('[updater] checkForUpdates isMoreRecent', isMoreRecent);
    if (!isMoreRecent) {
      logger.info(
        `[updater] File server has no update so we are not looking for an update from github current:${currentVersion} fromFileServer:${latestVersionFromFsFromRenderer}`
      );
      return;
    }

    // Get the update using electron-updater, this fetches from github
    const result = await autoUpdater.checkForUpdates();

    logger.info('[updater] checkForUpdates got github response back ');

    if (!result?.updateInfo) {
      logger.info('[updater] no update info received');

      return;
    }

    try {
      const hasUpdate = isUpdateAvailable(result.updateInfo);
      logger.info('[updater] hasUpdate:', hasUpdate);

      if (!hasUpdate) {
        logger.info('[updater] no update available');

        return;
      }

      const mainWindow = getMainWindow();
      if (!mainWindow) {
        logger.error('[updater] cannot showDownloadUpdateDialog, mainWindow is unset');
        return;
      }
      logger.info('[updater] showing download dialog...');
      const shouldDownload = await showDownloadUpdateDialog(mainWindow, i18n);
      logger.info('[updater] shouldDownload:', shouldDownload);

      if (!shouldDownload) {
        downloadIgnored = true;

        return;
      }

      await autoUpdater.downloadUpdate();
    } catch (error) {
      const mainWindow = getMainWindow();
      if (!mainWindow) {
        logger.error('[updater] cannot showDownloadUpdateDialog, mainWindow is unset');
        return;
      }
      await showCannotUpdateDialog(mainWindow, i18n);
      throw error;
    }
    const window = getMainWindow();
    if (!window) {
      logger.error('[updater] cannot showDownloadUpdateDialog, mainWindow is unset');
      return;
    }
    // Update downloaded successfully, we should ask the user to update
    logger.info('[updater] showing update dialog...');
    const shouldUpdate = await showUpdateDialog(window, i18n);
    if (!shouldUpdate) {
      return;
    }

    logger.info('[updater] calling quitAndInstall...');
    windowMarkShouldQuit();
    autoUpdater.quitAndInstall();
  } finally {
    isUpdating = false;
  }
}

function isUpdateAvailable(updateInfo: UpdateInfo): boolean {
  const updateVersion = parseVersion(updateInfo.version);
  if (!updateVersion) {
    console.error(
      '[updater] isUpdateAvailable could not parse update version:',
      updateInfo.version
    );
    return false;
  }

  // We need to convert this to string because typescript won't let us use types across submodules ....
  const currentVersion = autoUpdater.currentVersion.toString();

  const updateIsNewer = isVersionGreaterThan(updateVersion, currentVersion);
  console.log(
    `[updater] isUpdateAvailable updateIsNewer: ${updateIsNewer} currentVersion: ${currentVersion} updateVersion: ${updateVersion}`
  );
  return updateIsNewer;
}

/*
  Check if we have the required files to auto update.
  These files won't exist inside certain formats such as a linux deb file.
*/
async function canAutoUpdate(): Promise<boolean> {
  const isPackaged = app.isPackaged;

  // On a production app, we need to use resources path to check for the file
  if (isPackaged && !process.resourcesPath) {
    return false;
  }

  // Taken from: https://github.com/electron-userland/electron-builder/blob/d4feb6d3c8b008f8b455c761d654c8088f90d8fa/packages/electron-updater/src/ElectronAppAdapter.ts#L25
  const updateFile = isPackaged ? 'app-update.yml' : 'dev-app-update.yml';
  const basePath = isPackaged && process.resourcesPath ? process.resourcesPath : app.getAppPath();
  const appUpdateConfigPath = path.join(basePath, updateFile);

  return new Promise(resolve => {
    try {
      const exists = fs.existsSync(appUpdateConfigPath);
      resolve(exists);
    } catch (e) {
      resolve(false);
    }
  });
}
