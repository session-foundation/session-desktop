/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable no-void */
/* eslint-disable import/first */
/* eslint-disable import/order */
/* eslint-disable no-console */

import {
  app,
  BrowserWindow,
  protocol as electronProtocol,
  ipcMain as ipc,
  ipcMain,
  IpcMainEvent,
  Menu,
  nativeTheme,
  powerSaveBlocker,
  screen,
  shell,
  systemPreferences,
} from 'electron';

import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path, { join } from 'path';
import { platform as osPlatform } from 'process';
import url from 'url';

import _, { isEmpty, isNumber, isFinite } from 'lodash';

import { addHandler } from '../node/global_errors';
import { setup as setupSpellChecker } from '../node/spell_check';

import electronLocalshortcut from 'electron-localshortcut';
import packageJson from '../../package.json';

addHandler();

const getRealPath = (p: string) => fs.realpathSync(p);

// All of our polling is done from the renderer thread, so we need to set this flag
// to keep polling even if the renderer hidden/minimized.
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
powerSaveBlocker.start('prevent-app-suspension');

// Hardcoding appId to prevent build failures on release.
// const appUserModelId = packageJson.build.appId;
const appUserModelId = 'com.loki-project.messenger-desktop';
console.log('Set Windows Application User Model ID (AUMID)', {
  appUserModelId,
});
app.setAppUserModelId(appUserModelId);

// Keep a global reference of the window object, if you don't, the window will
//   be closed automatically when the JavaScript object is garbage collected.
let mainWindow: BrowserWindow | null = null;

function getMainWindow() {
  return mainWindow;
}

let readyForShutdown: boolean = false;

// Tray icon and related objects
let tray: any = null;

import { config } from '../node/config';

// Very important to put before the single instance check, since it is based on the
//   userData directory.
import { userConfig } from '../node/config/user_config';
import * as PasswordUtil from '../util/passwordUtils';

const development = (config as any).environment === 'development';
const appInstance = config.util.getEnv('NODE_APP_INSTANCE') || 0;

// We generally want to pull in our own modules after this point, after the user
//   data directory has been set.
import { initAttachmentsChannel } from '../node/attachment_channel';

import * as updater from '../updater/index';

import { ephemeralConfig } from '../node/config/ephemeral_config';
import { createTemplate } from '../node/menu';
import { installPermissionsHandler } from '../node/permissions';
import { installFileHandler, installWebHandler } from '../node/protocol_filter';
import { sqlNode } from '../node/sql';
import * as sqlChannels from '../node/sql_channel';
import { createTrayIcon } from '../node/tray_icon';
import { windowMarkShouldQuit, windowShouldQuit } from '../node/window_state';

let appStartInitialSpellcheckSetting = true;

function openDevToolsTestIntegration() {
  return isTestIntegration() && !isEmpty(process.env.TEST_OPEN_DEV_TOOLS);
}

async function getSpellCheckSetting() {
  const json = sqlNode.getItemById('spell-check');
  // Default to `true` if setting doesn't exist yet
  if (!json) {
    return true;
  }

  return json.value;
}

function showWindow() {
  if (!mainWindow) {
    return;
  }

  // Using focus() instead of show() seems to be important on Windows when our window
  //   has been docked using Aero Snap/Snap Assist. A full .show() call here will cause
  //   the window to reposition:
  //   https://github.com/signalapp/Signal-Desktop/issues/1429
  if (mainWindow.isVisible()) {
    mainWindow.focus();
  } else {
    mainWindow.show();
  }

  // toggle the visibility of the show/hide tray icon menu entries
  if (tray) {
    tray.updateContextMenu();
  }
}

if (!process.mas) {
  console.log('making app single instance');
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    // Don't allow second instance if we are in prod
    if (appInstance === 0) {
      console.log('quitting; we are the second instance');
      app.exit();
    }
  } else {
    app.on('second-instance', () => {
      // Someone tried to run a second instance, we should focus our window
      if (mainWindow) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }

        showWindow();
      }
      return true;
    });
  }
}

const windowFromUserConfig = userConfig.get('window');
const windowFromEphemeral = ephemeralConfig.get('window');
let windowConfig = windowFromEphemeral || windowFromUserConfig;
if (windowFromUserConfig) {
  userConfig.set('window', null);
  ephemeralConfig.set('window', windowConfig);
}

import { readFile } from 'fs-extra';
import { getAppRootPath } from '../node/getRootPath';
import { setLatestRelease } from '../node/latest_desktop_release';
import { isDevProd, isTestIntegration } from '../shared/env_vars';
import { classicDark } from '../themes';

import { isSessionLocaleSet, getCrowdinLocale } from '../util/i18n/shared';
import { loadLocalizedDictionary } from '../node/locale';
import { simpleDictionary } from '../localization/locales';
import LIBSESSION_CONSTANTS from '../session/utils/libsession/libsession_constants';
import { isReleaseChannel } from '../updater/types';
import { canAutoUpdate, checkForUpdates } from '../updater/updater';
import { initializeMainProcessLogger } from '../util/logger/main_process_logging';

import * as log from '../util/logger/log';
import { DURATION } from '../session/constants';
import { tr } from '../localization/localeTools';

function prepareURL(pathSegments: Array<string>, moreKeys?: { theme: any }) {
  const urlObject: url.UrlObject = {
    pathname: join(...pathSegments),
    protocol: 'file:',
    slashes: true,
    query: {
      name: packageJson.productName,
      locale: getCrowdinLocale(),
      version: app.getVersion(),
      commitHash: config.get('commitHash'),
      environment: (config as any).environment,
      node_version: process.versions.node,
      hostname: os.hostname(),
      appInstance: process.env.NODE_APP_INSTANCE,
      proxyUrl: process.env.HTTPS_PROXY || process.env.https_proxy,
      appStartInitialSpellcheckSetting,
      ...moreKeys,
    },
  };
  return url.format(urlObject);
}

function handleUrl(event: any, target: string) {
  event?.preventDefault();
  const { protocol } = url.parse(target);

  if (protocol === 'http:' || protocol === 'https:') {
    void shell.openExternal(target);
  }
}

function captureClicks(window: BrowserWindow) {
  window.webContents.on('will-navigate', handleUrl);

  window.webContents.setWindowOpenHandler(({ url: urlToOpen }) => {
    handleUrl(undefined, urlToOpen);
    return { action: 'deny' };
  });
}

function getDefaultWindowSize() {
  return {
    defaultWidth: 880,
    defaultHeight: openDevToolsTestIntegration() ? 1000 : 820, // the dev tools open at the bottom hide some stuff which should be visible
    minWidth: 880,
    minHeight: 600,
  };
}

function getWindowSize() {
  const screenSize = screen.getPrimaryDisplay().workAreaSize;
  const { minWidth, minHeight, defaultWidth, defaultHeight } = getDefaultWindowSize();
  // Ensure that the screen can fit within the default size
  const width = Math.min(defaultWidth, Math.max(minWidth, screenSize.width));
  const height = Math.min(defaultHeight, Math.max(minHeight, screenSize.height));

  return { width, height, minWidth, minHeight };
}

function isVisible(window: { x: number; y: number; width: number }, bounds: any) {
  const boundsX = _.get(bounds, 'x') || 0;
  const boundsY = _.get(bounds, 'y') || 0;
  const boundsWidth = _.get(bounds, 'width') || getDefaultWindowSize().defaultWidth;
  const boundsHeight = _.get(bounds, 'height') || getDefaultWindowSize().defaultHeight;
  const BOUNDS_BUFFER = 100;

  // requiring BOUNDS_BUFFER pixels on the left or right side

  const rightSideClearOfLeftBound = window.x + window.width >= boundsX + BOUNDS_BUFFER;
  const leftSideClearOfRightBound = window.x <= boundsX + boundsWidth - BOUNDS_BUFFER;

  // top can't be offscreen, and must show at least BOUNDS_BUFFER pixels at bottom
  const topClearOfUpperBound = window.y >= boundsY;
  const topClearOfLowerBound = window.y <= boundsY + boundsHeight - BOUNDS_BUFFER;

  return (
    rightSideClearOfLeftBound &&
    leftSideClearOfRightBound &&
    topClearOfUpperBound &&
    topClearOfLowerBound
  );
}

function getStartInTray() {
  const startInTray =
    process.argv.some(arg => arg === '--start-in-tray') || userConfig.get('startInTray');
  const usingTrayIcon = startInTray || process.argv.some(arg => arg === '--use-tray-icon');
  return { usingTrayIcon, startInTray };
}

async function createWindow() {
  const { minWidth, minHeight, width, height } = getWindowSize();
  windowConfig = windowConfig || {};
  const picked = {
    maximized: (windowConfig as any).maximized || false,
    autoHideMenuBar: (windowConfig as any).autoHideMenuBar || false,
    width: (windowConfig as any).width || width,
    height: (windowConfig as any).height || height,
    x: (windowConfig as any).x,
    y: (windowConfig as any).y,
  };

  if (isTestIntegration()) {
    const screenWidth =
      screen.getPrimaryDisplay().workAreaSize.width - getDefaultWindowSize().defaultWidth;
    const screenHeight =
      screen.getPrimaryDisplay().workAreaSize.height - getDefaultWindowSize().defaultHeight;

    picked.x = Math.floor(Math.random() * screenWidth);
    picked.y = Math.floor(Math.random() * screenHeight);
  }

  const windowOptions = {
    show: true,
    minWidth,
    minHeight,
    fullscreen: false as boolean | undefined,
    // Default theme is Classic Dark
    backgroundColor: classicDark['--background-primary-color'],
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true,
      nodeIntegrationInWorker: true,
      contextIsolation: false,
      preload: path.join(getAppRootPath(), 'preload.js'),
      nativeWindowOpen: true,
      spellcheck: await getSpellCheckSetting(),
      backgroundThrottling: false,
    },
    // only set icon for Linux, the executable one will be used by default for other platforms
    icon:
      (osPlatform === 'linux' && path.join(getAppRootPath(), 'images/session/session_icon.png')) ||
      undefined,
    ...picked,
  };

  if (!_.isNumber(windowOptions.width) || windowOptions.width < minWidth) {
    windowOptions.width = Math.max(minWidth, width);
  }
  if (!_.isNumber(windowOptions.height) || windowOptions.height < minHeight) {
    windowOptions.height = Math.max(minHeight, height);
  }
  if (!_.isBoolean(windowOptions.maximized)) {
    delete windowOptions.maximized;
  }
  if (!_.isBoolean(windowOptions.autoHideMenuBar)) {
    delete windowOptions.autoHideMenuBar;
  }

  const visibleOnAnyScreen = _.some(screen.getAllDisplays(), display => {
    if (!_.isNumber(windowOptions.x) || !_.isNumber(windowOptions.y)) {
      return false;
    }

    return isVisible(windowOptions, _.get(display, 'bounds'));
  });
  if (!visibleOnAnyScreen) {
    console.log('Location reset needed');
    delete windowOptions.x;
    delete windowOptions.y;
  }

  if (windowOptions.fullscreen === false) {
    delete windowOptions.fullscreen;
  }

  console.log(`Initializing BrowserWindow config: ${JSON.stringify(windowOptions)}`);

  // Create the browser window.
  mainWindow = new BrowserWindow(windowOptions);

  setupSpellChecker(mainWindow);

  const setWindowFocus = () => {
    if (!mainWindow) {
      return;
    }
    mainWindow.webContents.send('set-window-focus', mainWindow.isFocused());
  };
  mainWindow.on('focus', setWindowFocus);
  mainWindow.on('blur', setWindowFocus);
  mainWindow.once('ready-to-show', setWindowFocus);
  // This is a fallback in case we drop an event for some reason.
  global.setInterval(setWindowFocus, 5000);

  electronLocalshortcut.register(mainWindow, 'F5', () => {
    if (!mainWindow) {
      return;
    }
    mainWindow.reload();
  });
  electronLocalshortcut.register(mainWindow, 'CommandOrControl+R', () => {
    if (!mainWindow) {
      return;
    }
    mainWindow.reload();
  });

  function captureAndSaveWindowStats() {
    if (!mainWindow) {
      return;
    }

    const size = mainWindow.getSize();
    const position = mainWindow.getPosition();

    // so if we need to recreate the window, we have the most recent settings
    windowConfig = {
      maximized: mainWindow.isMaximized(),
      autoHideMenuBar: mainWindow.isMenuBarAutoHide(),
      width: size[0],
      height: size[1],
      x: position[0],

      y: position[1],
      fullscreen: false as boolean | undefined,
    };

    if (mainWindow.isFullScreen()) {
      // Only include this property if true, because when explicitly set to
      // false the fullscreen button will be disabled on osx
      (windowConfig as any).fullscreen = true;
    }

    console.log(`Updating BrowserWindow config: ${JSON.stringify(windowConfig)}`);
    ephemeralConfig.set('window', windowConfig);
  }

  const debouncedCaptureStats = _.debounce(captureAndSaveWindowStats, 500);
  mainWindow.on('resize', debouncedCaptureStats);
  mainWindow.on('move', debouncedCaptureStats);

  mainWindow.on('focus', () => {
    if (!mainWindow) {
      return;
    }
    mainWindow.flashFrame(false);
    if (passwordWindow) {
      passwordWindow.close();
      passwordWindow = null;
    }
  });

  const urlToLoad = prepareURL([getAppRootPath(), 'background.html']);

  await mainWindow.loadURL(urlToLoad);
  if (openDevToolsTestIntegration()) {
    setTimeout(() => {
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.openDevTools({
          mode: 'bottom',
          activate: false,
        });
      }
    }, 5000);
  }

  if (isDevProd() && !isTestIntegration()) {
    // Open the DevTools.
    mainWindow.webContents.openDevTools({
      mode: 'bottom',
      activate: false,
    });
  }

  captureClicks(mainWindow);

  // Emitted when the window is about to be closed.
  // Note: We do most of our shutdown logic here because all windows are closed by
  //   Electron before the app quits.
  mainWindow.on('close', async e => {
    console.log('close event', {
      readyForShutdown: mainWindow ? readyForShutdown : null,
      shouldQuit: windowShouldQuit(),
    });
    // If the application is terminating, just do the default
    if (mainWindow && readyForShutdown && windowShouldQuit()) {
      return;
    }

    // Prevent the shutdown
    e.preventDefault();
    mainWindow?.hide();

    // On Mac, or on other platforms when the tray icon is in use, the window
    // should be only hidden, not closed, when the user clicks the close button
    if (!windowShouldQuit() && (getStartInTray().usingTrayIcon || process.platform === 'darwin')) {
      // toggle the visibility of the show/hide tray icon menu entries
      if (tray) {
        tray.updateContextMenu();
      }

      return;
    }

    await requestShutdown();
    if (mainWindow) {
      readyForShutdown = true;
    }
    app.quit();
  });

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
}

ipc.on('show-window', () => {
  showWindow();
});

ipc.on('set-release-from-file-server', (_event, releaseInfoFromFileServer) => {
  const [releaseVersion, releaseChannel] = releaseInfoFromFileServer;

  if (!releaseVersion || !releaseChannel || !isReleaseChannel(releaseChannel)) {
    console.error(
      `[updater] set-release-from-file-server: invalid release information, version=${releaseVersion} or channel=${releaseChannel}`
    );
    return;
  }

  setLatestRelease(releaseInfoFromFileServer);
});

let isReadyForUpdates = false;

async function readyForUpdates() {
  console.log('[updater] isReadyForUpdates', isReadyForUpdates);
  if (isReadyForUpdates) {
    return;
  }

  isReadyForUpdates = true;

  // Second, start checking for app updates
  try {
    // if the user disabled auto updates, this will actually not start the updater
    await updater.start(getMainWindow, userConfig, log);
  } catch (error) {
    (log || console).error(
      '[updater] Error starting update checks:',
      error && error.stack ? error.stack : error
    );
  }
}

ipc.once('ready-for-updates', readyForUpdates);

// NOTE fetchReleaseFromFSAndUpdateMain must be called at least once before checkForUpdates gets called
ipc.handle('force-update-check', async () => {
  try {
    if (!log) {
      throw new Error('Must provide logger!');
    }

    if (!isReadyForUpdates) {
      throw new Error('Not ready for updates');
    }

    const canUpdate = await canAutoUpdate();

    if (!canUpdate) {
      throw new Error('Cannot use auto update! See canAutoUpdate() for more info.');
    }

    const success = await checkForUpdates(getMainWindow, log, true);
    if (!success) {
      throw new Error('Failed to check for updates');
    }
    return true;
  } catch (error) {
    console.error('[updater] force-update-check', error && error.stack ? error.stack : error);
    return false;
  }
});

// Forcefully call readyForUpdates after 10 minutes.
// This ensures we start the updater.
const TEN_MINUTES = 10 * 60 * 1000;
setTimeout(readyForUpdates, TEN_MINUTES);

function openReleaseNotes() {
  void shell.openExternal(
    `https://github.com/session-foundation/session-desktop/releases/tag/v${app.getVersion()}`
  );
}

function openSupportPage() {
  void shell.openExternal('https://docs.oxen.io/products-built-on-oxen/session');
}

let passwordWindow: BrowserWindow | null = null;

async function showPasswordWindow() {
  if (passwordWindow) {
    passwordWindow.show();
    return;
  }
  const { minWidth, minHeight, width, height } = getWindowSize();
  const windowOptions = {
    show: true, // allow to start minimised in tray
    width,
    height,
    minWidth,
    minHeight,
    autoHideMenuBar: false,
    // Default theme is Classic Dark
    backgroundColor: classicDark['--background-primary-color'],
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true,
      nodeIntegrationInWorker: false,
      contextIsolation: false,

      // sandbox: true,
      preload: path.join(getAppRootPath(), 'password_preload.js'),
      nativeWindowOpen: true,
    },
    // don't setup icon, the executable one will be used by default
  };

  passwordWindow = new BrowserWindow(windowOptions);

  await passwordWindow.loadURL(prepareURL([getAppRootPath(), 'password.html']));

  captureClicks(passwordWindow);

  passwordWindow.on('close', e => {
    // If the application is terminating, just do the default
    if (windowShouldQuit()) {
      return;
    }

    // Prevent the shutdown
    e.preventDefault();
    passwordWindow?.hide();

    // On Mac, or on other platforms when the tray icon is in use, the window
    // should be only hidden, not closed, when the user clicks the close button
    if (!windowShouldQuit() && (getStartInTray().usingTrayIcon || process.platform === 'darwin')) {
      // toggle the visibility of the show/hide tray icon menu entries
      if (tray) {
        tray.updateContextMenu();
      }

      return;
    }

    if (passwordWindow) {
      (passwordWindow as any).readyForShutdown = true;
    }
    // Quit the app if we don't have a main window
    if (!mainWindow) {
      app.quit();
    }
  });

  passwordWindow.on('closed', () => {
    passwordWindow = null;
  });
}

let aboutWindow: BrowserWindow | null;

async function showAbout() {
  if (aboutWindow) {
    aboutWindow.show();
    return;
  }

  if (!mainWindow) {
    console.info('about window needs mainwindow as parent');
    return;
  }

  const theme = await getThemeFromMainWindow();
  const options = {
    width: 550,
    height: 550,
    resizeable: true,
    title: tr('about'),
    autoHideMenuBar: true,
    backgroundColor: classicDark['--background-primary-color'],
    show: false,
    webPreferences: {
      nodeIntegration: true,
      nodeIntegrationInWorker: false,
      contextIsolation: false,
      preload: path.join(getAppRootPath(), 'about_preload.js'),
      nativeWindowOpen: true,
    },
    parent: mainWindow,
  };

  aboutWindow = new BrowserWindow(options);

  captureClicks(aboutWindow);

  await aboutWindow.loadURL(prepareURL([getAppRootPath(), 'about.html'], { theme }));

  aboutWindow.on('closed', () => {
    aboutWindow = null;
  });

  aboutWindow.once('ready-to-show', () => {
    aboutWindow?.setBackgroundColor(classicDark['--background-primary-color']);
  });

  // looks like sometimes ready-to-show is not fired by electron.
  // the fix mentioned here does not work neither: https://github.com/electron/electron/issues/7779.
  // But, just showing the aboutWindow right away works correctly, so just force it to be shown when just created.
  // It might take half a second to render it's content though.
  aboutWindow?.show();
}

async function saveDebugLog(_event: any) {
  ipc.emit('export-logs');
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
let ready = false;
app.on('ready', async () => {
  const userDataPath = getRealPath(app.getPath('userData'));
  const installPath = getRealPath(join(app.getAppPath(), '..', '..'));

  installFileHandler({
    protocol: electronProtocol,
    userDataPath,
    installPath,
    isWindows: process.platform === 'win32',
  });

  installWebHandler({
    protocol: electronProtocol,
  });

  installPermissionsHandler({ userConfig });

  await initializeMainProcessLogger(getMainWindow);
  console.log('app ready');
  console.log(`starting session-desktop version ${packageJson.version}`);
  console.log(
    `Libsession Commit Hash: ${LIBSESSION_CONSTANTS.LIBSESSION_UTIL_VERSION || 'Unknown'}`
  );
  console.log(
    `Libsession NodeJS Version/Hash: ${LIBSESSION_CONSTANTS.LIBSESSION_NODEJS_VERSION || 'Unknown'}/${LIBSESSION_CONSTANTS.LIBSESSION_NODEJS_COMMIT || 'Unknown'}`
  );

  if (!isSessionLocaleSet()) {
    const appLocale = process.env.LANGUAGE || app.getLocale() || 'en';
    const loadedLocale = loadLocalizedDictionary({ appLocale });
    console.log(`appLocale is ${appLocale}`);
    console.log(`crowdin locale is ${loadedLocale.crowdinLocale}`);
  }

  const key = getDefaultSQLKey();
  // Try to show the main window with the default key
  // If that fails then show the password window
  const dbHasPassword = userConfig.get('dbHasPassword');
  if (dbHasPassword) {
    console.log('showing password window');
    await showPasswordWindow();
  } else {
    console.log('showing main window');
    await showMainWindow(key);
  }
});

function getDefaultSQLKey() {
  let key = userConfig.get('key');
  if (!key) {
    console.log('key/initialize: Generating new encryption key, since we did not find it on disk');
    // https://www.zetetic.net/sqlcipher/sqlcipher-api/#key
    key = crypto.randomBytes(32).toString('hex');
    userConfig.set('key', key);
  }

  return key as string;
}

async function removeDB() {
  // this don't remove attachments and stuff like that...
  const userDir = getRealPath(app.getPath('userData'));
  sqlNode.removeDB(userDir);

  try {
    console.error('Remove DB: removing.', userDir);

    try {
      userConfig.remove();
    } catch (e) {
      if (e.code !== 'ENOENT') {
        throw e;
      }
    }
    try {
      ephemeralConfig.remove();
    } catch (e) {
      if (e.code !== 'ENOENT') {
        throw e;
      }
    }
  } catch (e) {
    console.error('Remove DB: Failed to remove configs.', e);
  }
}

async function showMainWindow(sqlKey: string, passwordAttempt = false) {
  const userDataPath = getRealPath(app.getPath('userData'));

  await sqlNode.initializeSql({
    configDir: userDataPath,
    key: sqlKey,
    passwordAttempt,
  });
  appStartInitialSpellcheckSetting = await getSpellCheckSetting();
  sqlChannels.initializeSqlChannel();

  await initAttachmentsChannel({
    userDataPath,
  });

  ready = true;

  await createWindow();

  if (getStartInTray().usingTrayIcon) {
    tray = createTrayIcon(getMainWindow);
  }

  setupMenu();
}

function setupMenu() {
  const { platform } = process;
  const menuOptions = {
    development,
    saveDebugLog,
    showWindow,
    showAbout,
    openReleaseNotes,
    openSupportPage,
    platform,
  };
  const template = createTemplate(menuOptions);
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

async function requestShutdown() {
  if (!mainWindow || !mainWindow.webContents) {
    return;
  }

  console.log('requestShutdown: Requesting close of mainWindow...');
  const request = new Promise((resolve, reject) => {
    ipc.once('now-ready-for-shutdown', (_event, error) => {
      console.log('requestShutdown: Response received');

      if (error) {
        reject(error);
        return;
      }

      resolve(undefined);
    });
    mainWindow?.webContents.send('get-ready-for-shutdown');

    // We'll wait two minutes, then force the app to go down. This can happen if someone
    //   exits the app before we've set everything up in preload() (so the browser isn't
    //   yet listening for these events), or if there are a whole lot of stacked-up tasks.
    // Note: two minutes is also our timeout for SQL tasks in data.ts in the browser.
    setTimeout(() => {
      console.log('requestShutdown: Response never received; forcing shutdown.');
      resolve(undefined);
    }, 2 * DURATION.MINUTES);
  });

  try {
    await request;
  } catch (error) {
    console.log('requestShutdown error:', error && error.stack ? error.stack : error);
  }
}

app.on('before-quit', () => {
  console.log('before-quit event', {
    readyForShutdown: mainWindow ? readyForShutdown : null,
    shouldQuit: windowShouldQuit(),
  });
  if (tray) {
    tray.destroy();
  }

  windowMarkShouldQuit();
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  if (!ready) {
    return;
  }

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow) {
    mainWindow.show();
  } else {
    await createWindow();
  }
});

// Defense in depth. We never intend to open webviews or windows. Prevent it completely.
app.on('web-contents-created', (_createEvent, contents) => {
  contents.on('will-attach-webview', attachEvent => {
    attachEvent.preventDefault();
  });
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});

// Ingested in preload.js via a sendSync call
ipc.on('locale-data', event => {
  // eslint-disable-next-line no-param-reassign
  event.returnValue = {
    crowdinLocale: getCrowdinLocale(),
  };
});

ipc.on('draw-attention', () => {
  if (!mainWindow) {
    return;
  }
  if (process.platform === 'win32') {
    mainWindow.flashFrame(true);
  }
});

ipc.on('restart', () => {
  app.relaunch();
  app.quit();
});

ipc.on('resetDatabase', async () => {
  await removeDB();
  app.relaunch();
  app.quit();
});

ipc.on('set-auto-hide-menu-bar', (_event, autoHide) => {
  if (mainWindow) {
    mainWindow.setAutoHideMenuBar(autoHide);
  }
});

ipc.on('set-menu-bar-visibility', (_event, visibility) => {
  if (mainWindow) {
    mainWindow.setMenuBarVisibility(visibility);
  }
});

ipc.on('close-about', () => {
  if (aboutWindow) {
    aboutWindow.close();
  }
});

// Password screen related IPC calls
ipc.on('password-window-login', async (event, passPhrase) => {
  const sendResponse = (e: string | undefined) => {
    event.sender.send('password-window-login-response', e);
  };

  try {
    const passwordAttempt = true;
    await showMainWindow(passPhrase, passwordAttempt);
    sendResponse(undefined);
  } catch (e) {
    sendResponse(tr('passwordIncorrect'));
  }
});

ipc.on('password-recovery-phrase', async (event, passPhrase) => {
  const sendResponse = (e: string | undefined) => {
    event.sender.send('password-recovery-phrase-response', e);
  };

  try {
    // Check if the hash we have stored matches the given password.
    const hash = sqlNode.getPasswordHash();

    const hashMatches = passPhrase && PasswordUtil.matchesHash(passPhrase, hash);
    if (hash && !hashMatches) {
      throw new Error('Invalid password');
    }
    // no issues. send back undefined, meaning OK
    sendResponse(undefined);
  } catch (e) {
    const localisedError = simpleDictionary.passwordIncorrect[getCrowdinLocale()];
    // send back the error
    sendResponse(localisedError);
  }
});

ipc.on('start-in-tray-on-start', (event, newValue) => {
  try {
    userConfig.set('startInTray', newValue);
    if (newValue) {
      if (!tray) {
        tray = createTrayIcon(getMainWindow);
      }
    } else {
      // destroy is not working for a lot of desktop env. So for simplicity, we don't destroy it here but just
      // show a toast to explain to the user that he needs to restart
      // tray.destroy();
      // tray = null;
    }
    event.sender.send('start-in-tray-on-start-response', null);
  } catch (e) {
    event.sender.send('start-in-tray-on-start-response', e);
  }
});

ipc.on('get-start-in-tray', event => {
  try {
    const val = userConfig.get('startInTray');
    event.sender.send('get-start-in-tray-response', val);
  } catch (e) {
    event.sender.send('get-start-in-tray-response', false);
  }
});

ipcMain.on('update-badge-count', (_event, count) => {
  if (app.isReady()) {
    app.setBadgeCount(isNumber(count) && isFinite(count) && count >= 0 ? count : 0);
  }
});

ipc.on('get-opengroup-pruning', event => {
  try {
    const val = userConfig.get('opengroupPruning');
    event.sender.send('get-opengroup-pruning-response', val);
  } catch (e) {
    event.sender.send('get-opengroup-pruning-response', false);
  }
});

ipc.on('set-opengroup-pruning', (event, newValue) => {
  try {
    userConfig.set('opengroupPruning', newValue);
    event.sender.send('set-opengroup-pruning-response', null);
  } catch (e) {
    event.sender.send('set-opengroup-pruning-response', e);
  }
});

ipc.on('set-password', async (event, passPhrase, oldPhrase) => {
  const sendResponse = (response: string | undefined) => {
    event.sender.send('set-password-response', response);
  };

  try {
    // Check if the hash we have stored matches the hash of the old passphrase.
    const hash = sqlNode.getPasswordHash();

    const hashMatches = oldPhrase && PasswordUtil.matchesHash(oldPhrase, hash);
    if (hash && !hashMatches) {
      sendResponse(tr('passwordCurrentIncorrect'));
      return;
    }

    if (isEmpty(passPhrase)) {
      const defaultKey = getDefaultSQLKey();
      sqlNode.setSQLPassword(defaultKey);
      sqlNode.removePasswordHash();
      userConfig.set('dbHasPassword', false);
      sendResponse(undefined);
    } else {
      sqlNode.setSQLPassword(passPhrase);
      const newHash = PasswordUtil.generateHash(passPhrase);
      sqlNode.savePasswordHash(newHash);
      const updatedHash = sqlNode.getPasswordHash();
      userConfig.set('dbHasPassword', true);
      sendResponse(updatedHash);
    }
  } catch (e) {
    sendResponse(tr('passwordFailed'));
  }
});

// Debug Log-related IPC calls
ipc.on('load-maxmind-data', async (event: IpcMainEvent) => {
  try {
    const appRoot =
      app.isPackaged && process.resourcesPath ? process.resourcesPath : app.getAppPath();
    const fileToRead = path.join(appRoot, 'mmdb', 'GeoLite2-Country.mmdb');
    console.info(`loading maxmind data from file:"${fileToRead}"`);
    const buffer = await readFile(fileToRead);
    event.reply('load-maxmind-data-complete', new Uint8Array(buffer.buffer));
  } catch (e) {
    event.reply('load-maxmind-data-complete', null);
  }
});

// This should be called with an ipc sendSync
ipc.on('get-media-permissions', event => {
  // eslint-disable-next-line no-param-reassign
  event.returnValue = userConfig.get('mediaPermissions') || false;
});
ipc.on('set-media-permissions', (event, value) => {
  userConfig.set('mediaPermissions', value);

  // We reinstall permissions handler to ensure that a revoked permission takes effect
  installPermissionsHandler({ userConfig });

  event.sender.send('set-success-media-permissions', null);
});

// This should be called with an ipc sendSync
ipc.on('get-call-media-permissions', event => {
  // eslint-disable-next-line no-param-reassign
  event.returnValue = userConfig.get('callMediaPermissions') || false;
});
ipc.on('set-call-media-permissions', (event, value) => {
  userConfig.set('callMediaPermissions', value);

  // We reinstall permissions handler to ensure that a revoked permission takes effect
  installPermissionsHandler({ userConfig });

  event.sender.send('set-success-call-media-permissions', null);
});

// Session - Auto updating
ipc.on('get-auto-update-setting', event => {
  const configValue = userConfig.get('autoUpdate');
  // eslint-disable-next-line no-param-reassign
  event.returnValue = typeof configValue !== 'boolean' ? true : configValue;
});

ipc.on('set-auto-update-setting', async (_event, enabled) => {
  userConfig.set('autoUpdate', !!enabled);

  if (enabled) {
    await readyForUpdates();
  } else {
    updater.stop();
    isReadyForUpdates = false;
  }
});

ipc.on('get-native-theme', event => {
  event.sender.send('send-native-theme', nativeTheme.shouldUseDarkColors);
});

nativeTheme.on('updated', () => {
  // Inform all renderer processes of the theme change
  mainWindow?.webContents.send('native-theme-update', nativeTheme.shouldUseDarkColors);
});

async function getThemeFromMainWindow() {
  return new Promise(resolve => {
    ipc.once('get-success-theme-setting', (_event, value) => {
      resolve(value);
    });
    mainWindow?.webContents.send('get-theme-setting');
  });
}

async function askForMediaAccess() {
  // Microphone part
  let status = systemPreferences.getMediaAccessStatus('microphone');
  if (status !== 'granted') {
    await systemPreferences.askForMediaAccess('microphone');
  }
  // Camera part
  status = systemPreferences.getMediaAccessStatus('camera');
  if (status !== 'granted') {
    await systemPreferences.askForMediaAccess('camera');
  }
}

ipc.on('media-access', async () => {
  await askForMediaAccess();
});

ipc.handle('get-storage-profile', async (): Promise<string> => {
  return app.getPath('userData');
});
