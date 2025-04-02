import { app, ipcMain } from 'electron';
import { ephemeralConfig } from './config/ephemeral_config';
import { userConfig } from './config/user_config';
import { sqlNode } from './sql';

let initialized = false;

const SQL_CHANNEL_KEY = 'sql-channel';
const ERASE_SQL_KEY = 'erase-sql-key';

export function initializeSqlChannel() {
  if (initialized) {
    throw new Error('sqlChannels: already initialized!');
  }

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  ipcMain.on(SQL_CHANNEL_KEY, async (event, jobId, callName, ...args) => {
    try {
      const fn = (sqlNode as any)[callName];
      if (!fn) {
        throw new Error(`sql channel: ${callName} is not an available function`);
      }

      const result = await fn(...args);

      event.sender.send(`${SQL_CHANNEL_KEY}-done`, jobId, null, result);
    } catch (error) {
      const errorForDisplay = error && error.stack ? error.stack : error;
      console.log(`sql channel error with call ${callName}: ${errorForDisplay}`);
    }
  });

  ipcMain.on(ERASE_SQL_KEY, event => {
    try {
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
      event.sender.send(`${ERASE_SQL_KEY}-done`);
    } catch (error) {
      const errorForDisplay = error && error.stack ? error.stack : error;
      console.log(`sql-erase error: ${errorForDisplay}`);
      event.sender.send(`${ERASE_SQL_KEY}-done`, error);
    }
  });

  ipcMain.on('get-user-data-path', event => {
    // eslint-disable-next-line no-param-reassign
    event.returnValue = app.getPath('userData');
  });
  ipcMain.handle('get-data-path', () => {
    return app.getAppPath();
  });
  initialized = true;
}
