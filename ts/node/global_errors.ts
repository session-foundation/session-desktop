import { app, dialog, clipboard } from 'electron';
import os from 'node:os';
import { isObject } from 'lodash';

import { reallyJsonStringify } from '../util/reallyJsonStringify';
import { Errors } from '../types/Errors';
import { redactAll } from '../util/privacy';
import { logCrash } from './crash/log_crash';
import { sleepFor } from '../session/utils/Promise';

// TODO: use localised strings
const quitText = 'Quit';
const copyErrorAndQuitText = 'Copy error and quit';

function handleError(prefix: string, error: Error): void {
  const formattedError = Errors.toString(error);
  if (console._error) {
    console._error(`${prefix}:`, formattedError);
  }
  console.error(`${prefix}:`, formattedError);

  if (app.isReady()) {
    // title field is not shown on macOS, so we don't use it
    const buttonIndex = dialog.showMessageBoxSync({
      buttons: [quitText, copyErrorAndQuitText],
      defaultId: 0,
      detail: redactAll(formattedError),
      message: prefix,
      noLink: true,
      type: 'error',
    });

    if (buttonIndex === 1) {
      clipboard.writeText(
        `${prefix}\n\n${redactAll(formattedError)}\n\n` +
          `App Version: ${app.getVersion()}\n` +
          `OS: ${os.platform()}`
      );
    }
  } else {
    dialog.showErrorBox(prefix, formattedError);
  }

  // allow 1s for graceful exit, then kill the app.
  // eslint-disable-next-line more/no-then
  void Promise.any([() => sleepFor(1000), app.quit()])
    .then(() => app.exit(1))
    .catch(e => {
      console.error('app.quit failed', e.message);
      app.exit(1);
    });
}

function _getError(reason: unknown): Error {
  if (reason instanceof Error) {
    return reason;
  }

  const errorString = reallyJsonStringify(reason);
  return new Error(`Promise rejected with a non-error: ${errorString}`);
}

export const addHandler = (): void => {
  // Note: we could maybe add a handler for when the renderer process died here?
  // (but also ignore the valid death like on restart/quit)
  process.on('uncaughtException', (reason: unknown) => {
    try {
      if (isObject(reason) && 'message' in reason && reason.message === 'write EPIPE') {
        return;
      }

      logCrash('main', { reason: 'uncaughtException', error: reason });

      handleError('Unhandled Error', _getError(reason));
    } catch (e) {
      // ignore (do not log as it just loops the error)
    }
  });

  process.on('unhandledRejection', (reason: unknown) => {
    try {
      logCrash('main', { reason: 'unhandledRejection', error: reason });

      handleError('Unhandled Promise Rejection', _getError(reason));
    } catch (e) {
      // ignore (do not log as it just loops the error)
    }
  });
};
