import { useMemo } from 'react';
import { formatFullDate } from '../util/i18n/formatting/generics';
import { CONVERSATION } from '../session/constants';

export function useFormatFullDate(timestampMs?: number) {
  return useMemo(() => {
    if (!timestampMs || timestampMs === CONVERSATION.LAST_JOINED_FALLBACK_TIMESTAMP) {
      return '';
    }
    return formatFullDate(new Date(timestampMs));
  }, [timestampMs]);
}
