/* eslint-env node */

/* eslint strict: ['error', 'never'] */
/* eslint-disable no-console */

import { ipcRenderer } from 'electron';
import _ from 'lodash';

import { redactAll } from './privacy';
import LIBSESSION_CONSTANTS from '../session/utils/libsession/libsession_constants';

const ipc = ipcRenderer;

// Default Bunyan levels: https://github.com/trentm/node-bunyan#levels
// To make it easier to visually scan logs, we make all levels the same length
const BLANK_LEVEL = '     ';
const LEVELS: Record<number, string> = {
  60: 'fatal',
  50: 'error',
  40: 'warn ',
  30: 'info ',
  20: 'debug',
  10: 'trace',
};

// Backwards-compatible logging, simple strings and no level (defaulted to INFO)
function now() {
  const current = Date.now();
  return `${current}`;
}

// To avoid [Object object] in our log since console.log handles non-strings smoothly
function cleanArgsForIPC(args: any) {
  const str = args.map((item: any) => {
    if (typeof item !== 'string') {
      try {
        return JSON.stringify(item);
      } catch (error) {
        return item;
      }
    }

    return item;
  });

  return str.join(' ');
}

function log(...args: any) {
  logAtLevel('info', 'INFO ', ...args);
}

if (window.console) {
  (console as any)._log = (console as any).log;
  (console as any).log = log;
  (console as any)._trace = (console as any).trace;
  (console as any)._debug = (console as any).debug;
  (console as any)._info = (console as any).info;
  (console as any)._warn = (console as any).warn;
  (console as any)._error = (console as any).error;
  (console as any)._fatal = (console as any).error;
}

// The mechanics of preparing a log for publish

function getHeader() {
  let header = window.navigator.userAgent;

  header += ` node/${window?.getNodeVersion()}`;
  header += ` env/${window?.getEnvironment()}`;

  return header;
}

function getLevel(level: number) {
  const text = LEVELS[level];
  if (!text) {
    return BLANK_LEVEL;
  }

  return text.toUpperCase();
}

type EntryType = {
  level: number;
  time: number;
  msg: string;
};

function formatLine(entry: EntryType) {
  return `${getLevel(entry.level)} ${entry.time} ${entry.msg}`;
}

function format(entries: Array<EntryType>) {
  return redactAll(entries.map(formatLine).join('\n'));
}

export async function fetchNodeLog() {
  return new Promise(resolve => {
    ipc.on('fetched-log', (_event, text) => {
      const result = `${getHeader()}\n${format(text)}`;
      resolve(result);
    });
    ipc.send('fetch-log');
  });
}

const development = window && window?.getEnvironment && window?.getEnvironment() !== 'production';

// A modern logging interface for the browser

// The Bunyan API: https://github.com/trentm/node-bunyan#log-method-api
function logAtLevel(level: string, prefix: string, ...args: any) {
  // when unit testing with mocha, we just log whatever we get to the console.log
  if (typeof (global as any).it === 'function') {
    (console as any)._log(prefix, now(), ...args);
    return;
  }

  if (prefix === 'DEBUG' && !window.sessionFeatureFlags.debug.debugLogging) {
    return;
  }
  if (development) {
    const fn = `_${level}`;
    (console as any)[fn](prefix, now(), ...args);
  } else {
    (console as any)._log(prefix, now(), ...args);
  }

  const str = cleanArgsForIPC(args);
  const logText = redactAll(str);
  ipc.send(`log-${level}`, logText);
}

window.log = {
  fatal: _.partial(logAtLevel, 'fatal', 'FATAL'),
  error: _.partial(logAtLevel, 'error', 'ERROR'),
  warn: _.partial(logAtLevel, 'warn', 'WARN '),
  info: _.partial(logAtLevel, 'info', 'INFO '),
  debug: _.partial(logAtLevel, 'debug', 'DEBUG'),
  trace: _.partial(logAtLevel, 'trace', 'TRACE'),
};

window.onerror = (_message, _script, _line, _col, error) => {
  const errorInfo = JSON.stringify(error);

  window.log.error(
    `Top-level unhandled error: "${_message}";"${_script}";"${_line}";"${_col}" ${errorInfo}`,
    error
  );
};

window.addEventListener('unhandledrejection', rejectionEvent => {
  const error = rejectionEvent.reason;
  const errorInfo = error && error.stack ? error.stack : error;
  window.log.error('Top-level unhandled promise rejection:', errorInfo);
});

export function saveLogToDesktop() {
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
******************************************************************************`;
  window.saveLog(debugLogWithSystemInfo);
}
