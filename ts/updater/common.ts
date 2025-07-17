import { BrowserWindow, dialog } from 'electron';
import { tr } from '../localization/localeTools';

export async function showDownloadUpdateDialog(
  mainWindow: BrowserWindow,
  version: string
): Promise<boolean> {
  const DOWNLOAD_BUTTON = 0;
  const LATER_BUTTON = 1;
  const options = {
    type: 'info' as const,
    buttons: [tr('download'), tr('later')],
    title: tr('updateSession'),
    message: tr('updateNewVersionDescription', { version }),
    defaultId: LATER_BUTTON,
    cancelId: DOWNLOAD_BUTTON,
  };

  const ret = await dialog.showMessageBox(mainWindow, options);

  return ret.response === DOWNLOAD_BUTTON;
}

export async function showUpdateDialog(mainWindow: BrowserWindow): Promise<boolean> {
  const RESTART_BUTTON = 0;
  const LATER_BUTTON = 1;
  const options: Electron.MessageBoxOptions = {
    type: 'info' as const,
    buttons: [tr('restart'), tr('later')],
    title: tr('updateSession'),
    message: tr('updateDownloaded'),
    defaultId: LATER_BUTTON,
    cancelId: RESTART_BUTTON,
  };
  const ret = await dialog.showMessageBox(mainWindow, options);

  return ret.response === RESTART_BUTTON;
}

export async function showCannotUpdateDialog(mainWindow: BrowserWindow) {
  const options = {
    type: 'error' as const,
    buttons: [tr('okay')],
    title: tr('updateError'),
    message: tr('updateErrorDescription'),
  };
  await dialog.showMessageBox(mainWindow, options);
}
