import path from 'path';

import { app, type BrowserWindow, Menu, Tray } from 'electron';
import type { SetupI18nReturnType } from '../types/localizer';
import { getAppRootPath } from './getRootPath';
import { LOCALE_DEFAULTS } from '../localization/constants';

let trayContextMenu = null;
let tray: Tray | null = null;
let trayAny: any;

export function createTrayIcon(
  getMainWindow: () => BrowserWindow | null,
  i18n: SetupI18nReturnType
) {
  // keep the duplicated part to allow for search and find
  const iconFile = process.platform === 'darwin' ? 'session_icon_16.png' : 'session_icon_32.png';
  const iconNoNewMessages = path.join(getAppRootPath(), 'images', 'session', iconFile);
  tray = new Tray(iconNoNewMessages);
  trayAny = tray;
  trayAny.forceOnTop = (mainWindow: BrowserWindow) => {
    if (mainWindow) {
      // On some versions of GNOME the window may not be on top when restored.
      // This trick should fix it.
      // Thanks to: https://github.com/Enrico204/Whatsapp-Desktop/commit/6b0dc86b64e481b455f8fce9b4d797e86d000dc1
      mainWindow.setAlwaysOnTop(true);
      mainWindow.focus();
      mainWindow.setAlwaysOnTop(false);
    }
  };

  trayAny.toggleWindowVisibility = () => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();

        trayAny.forceOnTop(mainWindow);
      }
    }
    trayAny.updateContextMenu();
  };

  trayAny.showWindow = () => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      if (!mainWindow.isVisible()) {
        mainWindow.show();
      }

      trayAny.forceOnTop(mainWindow);
    }
    trayAny.updateContextMenu();
  };

  trayAny.updateContextMenu = () => {
    const mainWindow = getMainWindow();

    // NOTE: we want to have the show/hide entry available in the tray icon
    // context menu, since the 'click' event may not work on all platforms.
    // For details please refer to:
    // https://github.com/electron/electron/blob/master/docs/api/tray.md.
    trayContextMenu = Menu.buildFromTemplate([
      {
        id: 'toggleWindowVisibility',
        label: mainWindow?.isVisible() ? i18n('hide') : i18n('show'),
        click: trayAny.toggleWindowVisibility,
      },
      {
        id: 'quit',
        label: i18n('quit'),
        click: app.quit.bind(app),
      },
    ]);

    trayAny.setContextMenu(trayContextMenu);
  };

  tray.on('click', trayAny.showWindow);

  tray.setToolTip(LOCALE_DEFAULTS.app_name);
  trayAny.updateContextMenu();

  return tray;
}
