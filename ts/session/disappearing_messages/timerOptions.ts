import { isDevProd } from '../../shared/env_vars';
import {
  formatAbbreviatedExpireTimer,
  formatNonAbbreviatedExpireTimer,
} from '../../util/i18n/formatting/expirationTimer';

export type TimerSeconds =
  | 0
  | 5
  | 10
  | 30
  | 60
  | 300
  | 1800
  | 3600
  | 21600
  | 43200
  | 86400
  | 604800
  | 1209600;

type TimerOptionsEntry = { name: string; value: TimerSeconds };
export type TimerOptionsArray = Array<TimerOptionsEntry>;

// prettier-ignore
const VALUES: Array<TimerSeconds> = [
  /** off */
  0,
  /** 5 seconds */
  5,
  /** 10 seconds */
  10,
  /** 30 seconds */
  30,
  /** 1 minute */
  60,
  /** 5 minutes */
  300,
  /** 30 minutes */
  1800,
  /** 1 hour */
  3600,
  /** 6 hours */
  21600,
  /** 12 hours */
  43200,
  /** 1 day */
  86400,
  /** 1 week */
  604800,
  /** 2 weeks */
  1209600,
] as const;

function getName(seconds = 0) {
  if (seconds === 0) {
    return window.i18n('off');
  }
  if (seconds > 0) {
    return formatNonAbbreviatedExpireTimer(seconds);
  }

  return [seconds, 'seconds'].join(' ');
}

function getAbbreviated(seconds: number) {
  if (seconds >= 0) {
    return formatAbbreviatedExpireTimer(seconds);
  }

  return [seconds, 's'].join('');
}

const filterOutDebugValues = (option: number) => {
  return isDevProd() || option > 60; // when not a dev build, filter out options with less than 60s
};

const DELETE_AFTER_READ = VALUES.filter(option => {
  return (
    option === 10 || // 10 seconds: filtered out when app is packaged with filterOutDebugValues
    option === 30 || // 30 seconds: filtered out when app is packaged with filterOutDebugValues
    option === 60 || // 1 minute  : filtered out when app is packaged with filterOutDebugValues
    option === 300 || // 5 minutes
    option === 3600 || // 1 hour
    option === 43200 || // 12 hours
    option === 86400 || // 1 day
    option === 604800 || // 1 week
    option === 1209600 // 2 weeks
  );
}).filter(filterOutDebugValues);

const DELETE_AFTER_SEND = VALUES.filter(option => {
  return (
    option === 10 || // 10 seconds: filtered out when app is packaged with filterOutDebugValues
    option === 30 || // 30 seconds: filtered out when app is packaged with filterOutDebugValues
    option === 60 || // 1 minute  : filtered out when app is packaged with filterOutDebugValues
    option === 43200 || // 12 hours
    option === 86400 || // 1 day
    option === 604800 || // 1 week
    option === 1209600 // 2 weeks
  );
}).filter(filterOutDebugValues);

const DEFAULT_OPTIONS = {
  DELETE_AFTER_READ: 43200, // 12 hours
  DELETE_AFTER_SEND: 86400, // 1 day
};

export const TimerOptions = {
  DEFAULT_OPTIONS,
  VALUES,
  DELETE_AFTER_READ,
  DELETE_AFTER_SEND,
  getName,
  getAbbreviated,
};
