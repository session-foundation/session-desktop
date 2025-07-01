import {
  FormatDistanceStrictOptions,
  FormatDistanceToNowStrictOptions,
  format,
  formatDistanceStrict,
  formatDistanceToNowStrict,
  formatRelative,
} from 'date-fns';
import { omit, upperFirst } from 'lodash';
import { getBrowserLocale, getTimeLocaleDictionary } from '../shared';
import { getForcedEnglishTimeLocale, timeLocaleMap } from '../timeLocaleMap';
import type { CrowdinLocale } from '../../../localization/constants';

/**
 * Formats a duration in milliseconds into a localized human-readable string.
 *
 * @param durationMs - The duration in milliseconds.
 * @param options - An optional object containing formatting options.
 * @returns A formatted string representing the duration.
 */
export const formatTimeDurationMs = (
  durationMs: number,
  options?: Omit<FormatDistanceStrictOptions, 'locale'>
) => {
  return formatDistanceStrict(new Date(durationMs), new Date(0), {
    locale: getTimeLocaleDictionary(),
    ...options,
  });
};

export const formatToTimeWithLocale = (date: Date) => {
  return new Intl.DateTimeFormat(getBrowserLocale(), {
    hour: 'numeric',
    minute: 'numeric',
    hour12: undefined, // am/pm depending on the locale
  }).format(date);
};

export const formatDateWithLocale = ({ date, formatStr }: { date: Date; formatStr: string }) => {
  return format(date, formatStr, { locale: getTimeLocaleDictionary() });
};

export const formatDateOnlyInEnglish = ({ date, formatStr }: { date: Date; formatStr: string }) => {
  return format(date, formatStr, { locale: timeLocaleMap.en });
};

/**
 * Returns a formatted date like `Wednesday, Jun 12, 2024, 4:29 PM`
 */
export const formatFullDate = (date: Date) => {
  return upperFirst(
    date.toLocaleString(getBrowserLocale(), {
      year: 'numeric',
      month: 'short',
      weekday: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    })
  );
};

/**
 * @param timestampMs The timestamp in ms to display with a relative string
 * @returns a localized string like "last thursday", "yesterday at 10:28am", ...
 */
export const formatRelativeTimestampWithLocale = (timestampMs: number) => {
  return upperFirst(formatRelative(timestampMs, Date.now(), { locale: getTimeLocaleDictionary() }));
};

/**
 * Returns a forced in english string to describe - in relative terms - durationSeconds.
 *
 */
export const formatTimeDistanceToNow = (
  durationSeconds: number,
  options?: Omit<FormatDistanceToNowStrictOptions, 'locale'>
) => {
  return formatDistanceToNowStrict(durationSeconds * 1000, {
    locale: getForcedEnglishTimeLocale(),
    ...options,
  });
};

/**
 * Formats a number as a string using the browser's locale.
 * If the value is not a finite number, it returns the value as a string.
 *
 * @param value - The number to format.
 * @param options - An optional object containing formatting options
 */
export const formatNumber = (
  value: number,
  options: Intl.NumberFormatOptions & { locale?: CrowdinLocale } = {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }
): string => {
  if (!Number.isFinite(value)) {
    return value.toString();
  }

  const locale = options.locale || getBrowserLocale();
  return new Intl.NumberFormat(locale, omit(options, 'locale')).format(value);
};

/**
 * Returns an English formatted date like `12 June 2024`
 */
export const formatToDateOnlyInEnglish = (date: Date) => {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
};

/**
 * Returns an English formatted time like `2:29 PM`
 */
export const formatToTimeOnlyInEnglish = (date: Date) => {
  return new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  }).format(date);
};
