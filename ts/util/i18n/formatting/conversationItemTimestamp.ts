import { isAfter, isBefore, subDays } from 'date-fns';
import { getBrowserLocale } from '../shared';

function getStartOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export const getConversationItemString = (date: Date) => {
  const now = new Date();

  // if this is in the future, or older than 7 days ago we display date only
  if (isAfter(date, now) || isBefore(date, subDays(now, 7))) {
    const formatter = new Intl.DateTimeFormat(getBrowserLocale(), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: undefined,
      minute: undefined,
      hour12: undefined, // am/pm depending on the locale
    });
    return formatter.format(date);
  }

  // if it is today, display the hour and minutes only, am/pm locale dependent
  if (isAfter(date, getStartOfToday())) {
    const formatter = new Intl.DateTimeFormat(getBrowserLocale(), {
      hour: 'numeric',
      minute: 'numeric',
      hour12: undefined, // am/pm depending on the locale
    });
    return formatter.format(date);
  }
  // less than 7 days ago, display the day of the week + time
  const formatter = new Intl.DateTimeFormat(getBrowserLocale(), {
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: undefined, // am/pm depending on the locale
  });
  return formatter.format(date);
};
