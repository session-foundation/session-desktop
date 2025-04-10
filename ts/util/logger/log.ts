import type { LogFn } from './Logging';
import { LogLevel } from './Logging';

type LogFnType = (level: LogLevel, ...args: ReadonlyArray<unknown>) => void;

let logAtLevel: LogFnType = () => {};
let hasInitialized = false;

export const fatal: LogFn = (...args) => logAtLevel(LogLevel.Fatal, ...args);
export const error: LogFn = (...args) => logAtLevel(LogLevel.Error, ...args);
export const warn: LogFn = (...args) => logAtLevel(LogLevel.Warn, ...args);
export const info: LogFn = (...args) => logAtLevel(LogLevel.Info, ...args);
export const debug: LogFn = (...args) => logAtLevel(LogLevel.Debug, ...args);
export const trace: LogFn = (...args) => logAtLevel(LogLevel.Trace, ...args);

/**
 * Call this to set how this logger should log every log line.
 */
export function setLogAtLevel(log: LogFnType): void {
  if (hasInitialized) {
    throw new Error('Logger has already been initialized');
  }
  logAtLevel = log;
  hasInitialized = true;
}
