// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-env node */

/* eslint-disable no-console */

import { ipcRenderer as ipc } from 'electron';
import * as path from 'path';
import pino from 'pino';

import {
  LogLevel,
  cleanArgs,
  getLogLevelString,
  levelMaxLength,
  type LogEntryType,
} from './shared';
import * as log from './log';
import { isUnitTest } from '../../shared/env_vars';
import { Errors } from '../../types/Errors';
import LIBSESSION_CONSTANTS from '../../session/utils/libsession/libsession_constants';
import { buildPinoLogger } from './buildPinoLogger';

function consoleLog(...args: ReadonlyArray<unknown>) {
  logAtLevel(LogLevel.Info, ...args);
}

if (window.console) {
  if (!isUnitTest()) {
    console._log = console.log;
    console.log = consoleLog;
  }
}

let globalLogger: undefined | pino.Logger;

export function initializeRendererProcessLogger(): void {
  if (globalLogger) {
    throw new Error('Already called initialize!');
  }

  const basePath = ipc.sendSync('get-user-data-path');

  const logFile = path.join(basePath, 'logs', 'app.log');

  const onClose = () => {
    console._log('initializeRendererProcessLogger onClose was called');
    globalLogger = undefined;
  };
  globalLogger = buildPinoLogger(logFile, onClose);

  log.setLogAtLevel(logAtLevel);
}

// Backwards-compatible logging, simple strings and no level (defaulted to INFO)
function now() {
  const date = new Date();
  return date.toJSON();
}

function logAtLevel(level: LogLevel, ...args: ReadonlyArray<unknown>): void {
  // we are in renderer, we log to the console tab, always
  const prefix = getLogLevelString(level).toUpperCase().padEnd(levelMaxLength, ' ');
  console._log(prefix, now(), ...args);

  const levelString = getLogLevelString(level);
  const msg = cleanArgs(args);

  if (!globalLogger) {
    throw new Error('Logger has not been initialized yet');
  }
  // then we also log with the globalLogger, that logs to stdout and the rotating file
  globalLogger[levelString](msg);
}

window.log = {
  fatal: log.fatal,
  error: log.error,
  warn: log.warn,
  info: log.info,
  debug: log.debug,
  trace: log.trace,
};

function toLocation(
  event: string | Event,
  sourceArg?: string,
  lineArg?: number,
  columnArg?: number
) {
  let source = sourceArg;
  let line = lineArg;
  let column = columnArg;

  if (event instanceof ErrorEvent) {
    source ??= event.filename;
    line ??= event.lineno;
    column ??= event.colno;
  }

  if (source == null) {
    return '(@ unknown)';
  }
  if (line != null && column != null) {
    return `(@ ${source}:${line}:${column})`;
  }
  if (line != null) {
    return `(@ ${source}:${line})`;
  }
  return `(@ ${source})`;
}

window.onerror = (event, source, line, column, error) => {
  const errorInfo = Errors.toString(error);
  log.error(`Top-level unhandled error: ${errorInfo}`, toLocation(event, source, line, column));
};

window.addEventListener('unhandledrejection', rejectionEvent => {
  const error = rejectionEvent.reason;
  const errorString = Errors.toString(error);
  log.error(`Top-level unhandled promise rejection: ${errorString}`);
});

export function saveLogToDesktop() {
  window.saveLog();
}

// eslint-disable-next-line @typescript-eslint/no-misused-promises
ipc?.on('additional-log-data-request', async event => {
  let otherDetails = 'Other details:\n';
  otherDetails += ` userAgent: ${window.navigator.userAgent}\n`;
  otherDetails += ` node: ${window?.getNodeVersion()}\n`;
  otherDetails += ` env: ${window?.getEnvironment()}\n`;

  const versionInfo = `v${window.getVersion()}`;
  const systemInfo = `System Information: ${window.getOSRelease()}`;
  const commitInfo = `Commit Hash: ${window.getCommitHash()}` || 'Unknown';
  const libsessionCommitInfo =
    `Libsession Commit Hash: ${LIBSESSION_CONSTANTS.LIBSESSION_UTIL_VERSION}` || 'Unknown';
  const libsessionNodeJSCommitInfo =
    `Libsession NodeJS Version/Hash: ${LIBSESSION_CONSTANTS.LIBSESSION_NODEJS_VERSION}/${LIBSESSION_CONSTANTS.LIBSESSION_NODEJS_COMMIT}` ||
    'Unknown';
  const debugLogWithSystemInfo = `
******************************************************************************
# Application Info
${versionInfo}
${systemInfo}
${commitInfo}
${libsessionCommitInfo}
${libsessionNodeJSCommitInfo}
${otherDetails}
******************************************************************************`;
  const additionalData: Array<LogEntryType> = debugLogWithSystemInfo.split('\n').map(line => {
    return { time: new Date().toISOString(), level: LogLevel.Info, msg: line };
  });

  event.sender.send('additional-log-data-response', additionalData);
});
