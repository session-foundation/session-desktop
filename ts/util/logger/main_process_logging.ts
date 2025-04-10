// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// NOTE: Temporarily allow `then` until we convert the entire file to `async` / `await`:
/* eslint-disable more/no-then */
/* eslint-disable no-console */

import type { BrowserWindow } from 'electron';
import { app, ipcMain as ipc, dialog } from 'electron';
import { filter, flatten, isBoolean, isString, map, memoize, pick, sortBy } from 'lodash';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { rm, readdir, stat } from 'node:fs/promises';
import { join } from 'path';
import pino from 'pino';
import path from 'node:path';
import readLastLines from 'read-last-lines';
import readFirstLine from 'firstline';

import * as log from './log';

import type { FetchLogIpcData, LogEntryType } from './shared';
import {
  LogLevel,
  cleanArgs,
  getLogLevelString,
  isFetchLogIpcData,
  isLogEntry,
  levelMaxLength,
} from './shared';
import type { LoggerType } from './Logging';
import { Errors } from '../../types/Errors';

import { reallyJsonStringify } from '../reallyJsonStringify';
import { buildPinoLogger } from './buildPinoLogger';
import { isRecord } from '../../types/isRecord';
import { FILESIZE } from '../../session/constants';

const MAX_LOG_LINES_MERGED_EXPORT = 1_000_000;
// a million lines of log (per file) should be more than enough.
const MAX_LOG_LINES_PER_FILE = 1_000_000;

declare global {
  // We want to extend `Console`, so we need an interface.
  // eslint-disable-next-line no-restricted-syntax
  interface Console {
    _log: typeof console.log;
    _warn: typeof console.warn;
    _error: typeof console.error;
  }
}

let globalLogger: undefined | pino.Logger;

export async function initializeMainProcessLogger(
  getMainWindow: () => null | BrowserWindow
): Promise<LoggerType> {
  if (globalLogger) {
    throw new Error('Already called initialize!');
  }

  const basePath = app.getPath('userData');
  const logPath = join(basePath, 'logs');
  console.warn('[log] filepath', logPath);

  mkdirSync(logPath, { recursive: true });

  try {
    await cleanupLogs(logPath);
  } catch (error) {
    const errorString = `Failed to clean logs; deleting all. Error: ${Errors.toString(error)}`;
    console.error(errorString);
    await deleteAllLogs(logPath, false);
    mkdirSync(logPath, { recursive: true });

    // If we want this log entry to persist on disk, we need to wait until we've
    //   set up our logging infrastructure.
    setTimeout(() => {
      console.error(errorString);
    }, 500);
  }

  const logFile = join(logPath, 'main.log');

  const onClose = () => {
    globalLogger = undefined;

    console.log('initializeMainProcessLogger onClose was called');
    void initializeMainProcessLogger(getMainWindow);
  };

  const logger = buildPinoLogger(logFile, onClose);

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  ipc.on('export-logs', async () => {
    const mainWindow = getMainWindow();
    if (!mainWindow) {
      logger.info('Logs were requested, but the main window is missing');
      return;
    }
    const additionalInfo = await fetchAdditionalLogData(mainWindow);

    if (!existsSync(logPath)) {
      mkdirSync(logPath, { recursive: true });
    }

    let data: FetchLogIpcData;
    try {
      logger.info(`Trying to loading log data in ${logPath}`);
      const logEntries = fetchLogs(logPath);
      data = {
        logEntries,
      };
    } catch (error) {
      logger.error(`Problem loading log data in ${logPath}: ${Errors.toString(error)}`);
      return;
    }

    const options: Electron.SaveDialogOptions = {
      title: 'Save debug log',
      defaultPath: path.join(
        app.getPath('desktop'),
        `session_debug_${new Date().toISOString().replace(/:/g, '_')}.txt`
      ),
      properties: ['createDirectory'],
    };

    try {
      const result = await dialog.showSaveDialog(options);
      const outputPath = result.filePath;
      console.info(`[log] About to save logs to ${outputPath}`);
      if (result === undefined || outputPath === undefined || outputPath === '') {
        throw Error("User clicked Save button but didn't create a file");
      }

      // append any additional info to body here
      const { body, countOfLines } = getLogFromData(data, additionalInfo);
      const start = Date.now();
      console.info(`[log] About to write to exported file ${countOfLines} lines`);
      writeFileSync(outputPath, body, { encoding: 'utf-8', flush: true });

      console.info(
        `[log] Exported logs to ${outputPath} from ${logPath} took: ${Date.now() - start}ms`
      );
    } catch (err) {
      console.error(`Error saving debug log ${Errors.toString(err)}`);
    }
  });

  ipc.removeHandler('delete-all-logs');
  ipc.handle('delete-all-logs', async (_event, keepCurrent: unknown) => {
    if (!isBoolean(keepCurrent)) {
      throw new Error('delete-all-logs: excepted boolean for keepCurrent');
    }

    try {
      await deleteAllLogs(logPath, keepCurrent);
    } catch (error) {
      logger.error(`Problem deleting all logs: ${Errors.toString(error)}`);
    }
    return fetchLogsStorageUsed(logPath);
  });

  ipc.removeHandler('get-logs-folder-size');
  ipc.handle('get-logs-folder-size', async () => {
    return fetchLogsStorageUsed(logPath);
  });
  ipc.on('get-user-data-path', event => {
    // eslint-disable-next-line no-param-reassign
    event.returnValue = app.getPath('userData');
  });

  globalLogger = logger;

  return log;
}

async function deleteAllLogs(logPath: string, keepCurrent: boolean): Promise<void> {
  // The "current" log file written to is always `*.log`.
  // The ones from a previous rotation always match `*.log.1`, `.log.2`, etc
  // So, when we've been told to keep the current one, we remove only the files with `.log.` in the name
  // (Note the last "." at the end of the `.log.` here)
  const pattern = keepCurrent ? '.log.' : '.log';

  try {
    const files = await readdir(logPath);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = path.join(logPath, file);

      if (filePath.includes(pattern)) {
        console.info(`removed log file: "${filePath}"`);
        // eslint-disable-next-line no-await-in-loop
        await rm(filePath, { force: true });
      }
    }
  } catch (error) {
    globalLogger?.error('deleteAllLogs: Error reading directory or files:', error);
  }
}

async function fetchLogsStorageUsed(logPath: string): Promise<number> {
  try {
    const files = await readdir(logPath);
    let totalSize = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = path.join(logPath, file);

      if (file.includes('.log')) {
        // eslint-disable-next-line no-await-in-loop
        const fileStats = await stat(filePath);

        if (fileStats.isFile()) {
          totalSize += fileStats.size;
        }
      }
    }
    return totalSize;
  } catch (error) {
    globalLogger?.error('fetchLogsStorageUsed: Error reading directory or files:', error);
    return 0;
  }
}

async function cleanupLogs(logPath: string) {
  const now = new Date();
  const earliestDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 3)
  );
  console.log(`cleanupLogs: ${now}, earliestDate:${earliestDate}`);

  try {
    const remaining = await eliminateOutOfDateFiles(logPath, earliestDate);
    const files = filter(remaining, file => !file.start && file.end);
    if (!files.length) {
      return;
    }
    await eliminateOldEntries(files, earliestDate);
  } catch (error) {
    console.error(
      'Error cleaning logs; deleting and starting over from scratch.',
      Errors.toString(error)
    );

    // delete and re-create the log directory
    await deleteAllLogs(logPath, false);
    mkdirSync(logPath, { recursive: true });
  }
}

function isLineAfterDate(line: string, date: Readonly<Date>): boolean {
  if (!line) {
    return false;
  }

  try {
    const data = JSON.parse(line);
    return new Date(data.time).getTime() > date.getTime();
  } catch (e) {
    console.log('error parsing log line', Errors.toString(e), line);
    return false;
  }
}

async function readFirstAndLastLines(targetFile: string) {
  try {
    const firstLine = await readFirstLine(targetFile);
    const lastLines = await readLastLines.read(targetFile, 2);

    return [firstLine, lastLines];
  } catch (e) {
    return ['', ''];
  }
}

function eliminateOutOfDateFiles(
  logPath: string,
  date: Readonly<Date>
): Promise<
  Array<{
    path: string;
    start: boolean;
    end: boolean;
  }>
> {
  const files = readdirSync(logPath);
  const paths = files.map(file => join(logPath, file));

  return Promise.all(
    map(paths, target =>
      readFirstAndLastLines(target).then(results => {
        const start = results[0];
        const end = results[1].split('\n');

        const file = {
          path: target,
          start: isLineAfterDate(start, date),
          end:
            isLineAfterDate(end[end.length - 1], date) ||
            isLineAfterDate(end[end.length - 2], date),
        };

        if (!file.start && !file.end) {
          console.log(`eliminateOutOfDateFiles: removing "${file.path}"`);
          unlinkSync(file.path);
        }

        return file;
      })
    )
  );
}

/**
 * Return the size in bytes of that file.
 */
async function getFileSize(filePath: string): Promise<number> {
  const stats = await stat(filePath);
  return stats.size;
}

async function eliminateOldEntries(files: ReadonlyArray<{ path: string }>, date: Readonly<Date>) {
  const maxFileSize = 100 * FILESIZE.MB;
  for (let index = 0; index < files.length; index++) {
    const file = files[index];

    // eslint-disable-next-line no-await-in-loop
    const fileSize = await getFileSize(file.path);
    if (fileSize > maxFileSize) {
      console.warn(`${file.path} is more than 100MB, discarding it`);
      unlinkSync(file.path);
      return;
    }
    console.log(`eliminateOldEntries of ${file.path}...`);

    const lines = fetchLog(file.path);

    const recent = filter(lines, line => new Date(line.time) >= date);
    const text = map(recent, line => JSON.stringify(line)).join('\n');

    writeFileSync(file.path, `${text}\n`);
  }
}

function fetchLog(logFile: string): Array<LogEntryType> {
  const content = readFileSync(logFile, 'utf-8');
  const lines = content.split(/\r?\n/);
  // filter out lines that are not valid
  const validEntries: Array<LogEntryType> = new Array(MAX_LOG_LINES_PER_FILE);

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];

    try {
      if (!line.length) {
        continue;
      }
      const parsed = JSON.parse(line);
      const result = parsed && pick(parsed, ['level', 'time', 'msg']);
      if (!isLogEntry(result)) {
        globalLogger?.warn(`fetchLog: entry is not a valid log entry: ${line}`);
        continue;
      }

      validEntries.push(result);
    } catch (e) {
      globalLogger?.warn(
        `fetchLog: json parse failed in file "${logFile}" with ${Errors.toString(e)}`
      );
    }
  }

  return validEntries;
}

function fetchLogs(logPath: string): Array<LogEntryType> {
  const files = readdirSync(logPath);
  const paths = files.map(file => join(logPath, file));

  // creating a manual log entry for the final log result
  const fileListEntry: LogEntryType = {
    level: LogLevel.Info,
    time: new Date().toISOString(),
    msg: `Loaded this list of log files from logPath: ${files.join(', ')}`,
  };

  const fetchedAllLogs = paths.map(fetchLog);

  const data = flatten(fetchedAllLogs);

  data.push(fileListEntry);

  const sorted = sortBy(
    data.filter(m => isRecord(m) && m?.time),
    logEntry => logEntry.time
  );

  // no point exporting more than MAX_LOG_LINES_MERGED_EXPORT lines
  return sorted.slice(-MAX_LOG_LINES_MERGED_EXPORT);
}

function logAtLevel(level: LogLevel, ...args: ReadonlyArray<unknown>) {
  // main side, we only need to log to the globalLogger, it prints to stdout and the rotating file
  const levelString = getLogLevelString(level);
  const cleanedArgs = cleanArgs(args);
  if (globalLogger) {
    globalLogger[levelString](cleanedArgs);
  } else {
    // Note: it is very important to have a fallback here, otherwise the logs made in this file that are
    // made before `globalLogger = logger` above will not be printed anywhere, and debugging will be a pain.
    // This is the case for *all* the log lines added while doing the log rotation, and cleaning of
    // the existing logs.
    console._log(levelString, cleanedArgs);
  }
}

// This blows up using mocha --watch, so we ensure it is run just once
if (!console._log) {
  log.setLogAtLevel(logAtLevel);

  // Warning: this is done when the .ts file is loaded.
  // Which means that anything written to the console before that event,
  // and the globalLogger being initialised needs to be force redirected to stdout.
  // See the comment in logAtLevel
  console._log = console.log;
  console.log = log.info;
  console._error = console.error;
  console.error = log.error;
  console._warn = console.warn;
  console.warn = log.warn;
}

const getLevel = memoize((level: LogLevel): string => {
  const text = getLogLevelString(level);
  return text.toUpperCase().padEnd(levelMaxLength, ' ');
});

function toFallbackLogEntry(unknownContent: unknown) {
  return {
    level: LogLevel.Error,
    msg: `Invalid IPC data when fetching logs. Here's what we could recover: ${reallyJsonStringify(
      unknownContent
    )}`,
    time: new Date().toISOString(),
  };
}

function tryParseLogEntry(mightBeStringifiedEntry: unknown): LogEntryType {
  try {
    if (isLogEntry(mightBeStringifiedEntry)) {
      return mightBeStringifiedEntry;
    }
    if (!isString(mightBeStringifiedEntry)) {
      return toFallbackLogEntry(mightBeStringifiedEntry);
    }
    const parsed = JSON.parse(mightBeStringifiedEntry);
    if (isLogEntry(parsed)) {
      return parsed;
    }
  } catch (e) {
    // nothing to do here, we fallback below
  }
  return toFallbackLogEntry(mightBeStringifiedEntry);
}

function formatLine(mightBeEntry: unknown): string {
  const entry: LogEntryType = tryParseLogEntry(mightBeEntry);

  return `${getLevel(entry.level)} ${entry.time} ${entry.msg}`;
}

export function getLogFromData(data: unknown, additionalData: unknown) {
  let body: string;
  let countOfLines = 0;
  if (isFetchLogIpcData(data)) {
    const { logEntries } = data;
    console.info('[logging] logEntries length:', logEntries.length);
    countOfLines += logEntries.length;
    body = logEntries.map(formatLine).join('\n');
  } else {
    const entry: LogEntryType = {
      level: LogLevel.Error,
      msg: 'Invalid IPC data when fetching logs; dropping all logs',
      time: new Date().toISOString(),
    };
    body = formatLine(entry);
    countOfLines += 1;
  }
  if (additionalData && Array.isArray(additionalData)) {
    if (additionalData?.length) {
      countOfLines += additionalData.length;

      body += `\n\n${additionalData.map(formatLine).join('\n')}`;
    }
  }

  return { body: `${body}`, countOfLines };
}

const fetchAdditionalLogData = (mainWindow: BrowserWindow): Promise<unknown> =>
  new Promise(resolve => {
    mainWindow.webContents.send('additional-log-data-request');
    ipc.once('additional-log-data-response', (_event, data) => {
      resolve(data);
    });
  });
