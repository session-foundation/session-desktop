// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import fs from 'fs';
import pino from 'pino';

import { DURATION } from '../../session/constants';
import { LogLevel } from './Logging';

/**
 * Keep at most rotated 3 files, so  4 files total including the "current" one
 */
const MAX_ROTATIONS = 3;

/**
 * Do the file rotation every 24 hours, that should be enough for multiple
 * restarts and prevent the files getting too big
 */
const ROTATION_INTERVAL = 24 * DURATION.HOURS;

const RETRY_DELAY = 12 * DURATION.SECONDS;

// 5 seconds * 12 = 1 minute
const MAX_RETRY_COUNT = 12;

export type RotatingPinoDestOptionsType = Readonly<{
  logFile: string;
}>;

export function createRotatingPinoDest({
  logFile,
}: RotatingPinoDestOptionsType): ReturnType<typeof pino.destination> {
  const maxSavedLogFiles = MAX_ROTATIONS;

  const boom = pino.destination({
    dest: logFile,
    sync: true,
    mkdir: true,
  });

  let retryCount = 0;

  const warn = (msg: string) => {
    const line = JSON.stringify({
      level: LogLevel.Warn,
      time: new Date(),
      msg,
    });
    boom.write(`${line}\n`);
  };

  function maybeRotate(startingIndex = maxSavedLogFiles - 1) {
    let pendingFileIndex = startingIndex;
    try {
      const { birthtimeMs } = fs.statSync(logFile);

      // more recent than
      if (birthtimeMs > Date.now() - ROTATION_INTERVAL) {
        return;
      }

      for (; pendingFileIndex >= 0; pendingFileIndex -= 1) {
        const currentPath = pendingFileIndex === 0 ? logFile : `${logFile}.${pendingFileIndex}`;
        const nextPath = `${logFile}.${pendingFileIndex + 1}`;

        if (fs.existsSync(nextPath)) {
          warn(`rotatingPinoDest: removed nextPath during rotation: "${nextPath}"`);
          fs.unlinkSync(nextPath);
        }
        if (!fs.existsSync(currentPath)) {
          continue;
        }

        fs.renameSync(currentPath, nextPath);
      }
    } catch (error) {
      // If we can't access the old log files - try rotating after a small
      // delay.
      if (retryCount < MAX_RETRY_COUNT && (error.code === 'EACCES' || error.code === 'EPERM')) {
        retryCount += 1;
        warn(`rotatingPinoDest: retrying rotation, retryCount=${retryCount}`);
        setTimeout(() => maybeRotate(pendingFileIndex), RETRY_DELAY);
        return;
      }

      boom.destroy();
      boom.emit('error', error);
      return;
    }

    // Success, reopen
    boom.reopen();
    warn('======================================================================');
    warn('============================ new log file ============================');
    warn('======================================================================');

    if (retryCount !== 0) {
      warn(`rotatingPinoDest: rotation succeeded after ${retryCount} retries`);
    }

    retryCount = 0;
  }

  maybeRotate();
  setInterval(maybeRotate, ROTATION_INTERVAL);

  return boom;
}
