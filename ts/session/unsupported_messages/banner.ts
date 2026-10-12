import { isFinite, isNumber } from 'lodash';
import { SettingsKey } from '../../data/settings-key';
import { Storage } from '../../util/storage';
import { DURATION } from '../constants';

/**
 * After a dismissal the banner only comes back for a trigger at least this long after it. Anyone can
 * deposit newer-format data into a 1o1 namespace, so this bounds how often a stranger can raise it.
 */
export const UNSUPPORTED_BANNER_REAPPEAR_AFTER_DISMISSAL_MS = 7 * DURATION.DAYS;

export type UnsupportedBannerTrigger =
  | 'newerFormat'
  /** an unknown type from one of our own devices which could not be placed in a conversation */
  | 'otherDevice';

export type UnsupportedBannerState = 'hidden' | 'general' | 'otherDevice';

export function unsupportedBannerState({
  triggeredAtMs,
  otherDeviceTriggeredAtMs,
  dismissedAtMs,
}: {
  triggeredAtMs: number | null;
  otherDeviceTriggeredAtMs: number | null;
  dismissedAtMs: number | null;
}): UnsupportedBannerState {
  if (triggeredAtMs === null) {
    return 'hidden';
  }
  const visibleFromMs =
    dismissedAtMs === null ? null : dismissedAtMs + UNSUPPORTED_BANNER_REAPPEAR_AFTER_DISMISSAL_MS;

  if (visibleFromMs !== null && triggeredAtMs < visibleFromMs) {
    return 'hidden';
  }
  // A missing other-device trigger must not count as "at or after the threshold" just because there is
  // no threshold, or a general trigger would show the other-device text.
  if (
    otherDeviceTriggeredAtMs === null ||
    (visibleFromMs !== null && otherDeviceTriggeredAtMs < visibleFromMs)
  ) {
    return 'general';
  }
  return 'otherDevice';
}

const listeners = new Set<() => void>();

function readMs(key: string): number | null {
  const value = Storage.get(key);
  return isNumber(value) && isFinite(value) ? value : null;
}

function notifyListeners() {
  listeners.forEach(listener => listener());
}

export function getUnsupportedBannerState() {
  return unsupportedBannerState({
    triggeredAtMs: readMs(SettingsKey.unsupportedMessageBannerTriggeredAtMs),
    otherDeviceTriggeredAtMs: readMs(SettingsKey.unsupportedMessageBannerOtherDeviceTriggeredAtMs),
    dismissedAtMs: readMs(SettingsKey.unsupportedMessageBannerDismissedAtMs),
  });
}

export function subscribeToUnsupportedBanner(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function recordUnsupportedBannerTrigger(
  trigger: UnsupportedBannerTrigger,
  nowMs: number
) {
  await Storage.put(SettingsKey.unsupportedMessageBannerTriggeredAtMs, nowMs);
  if (trigger === 'otherDevice') {
    await Storage.put(SettingsKey.unsupportedMessageBannerOtherDeviceTriggeredAtMs, nowMs);
  }
  notifyListeners();
}

export async function dismissUnsupportedBanner(nowMs: number) {
  await Storage.put(SettingsKey.unsupportedMessageBannerDismissedAtMs, nowMs);
  notifyListeners();
}
