import { LOCALE_DEFAULTS } from '../localization/constants';
import {
  FEATURE_RELEASE_CHECK_INTERVAL,
  type SessionFeatureFlagKeys,
} from '../state/ducks/types/releasedFeaturesReduxTypes';
import { Notifications } from './notifications';
import { Storage } from './storage';

/**
 * Handle the release notification for a feature.
 * @param featureName The name of the feature being released
 * @param notifyAt The time to notify the user
 * @param lastRefreshedAt The last time we checked if the feature is ready for release
 * @param delayMs The delay in milliseconds to wait before notifying the user after a feature is released
 * @param force Ignore any stored notification times and set the notification to now + delayMs
 */
export const handleReleaseNotification = ({
  featureName,
  message,
  notifyAt: _notifyAt,
  lastRefreshedAt,
  delayMs,
  force,
}: {
  featureName: SessionFeatureFlagKeys;
  message: string;
  notifyAt: number;
  lastRefreshedAt: number;
  delayMs?: number;
  force?: boolean;
}): number => {
  let notifyAt = _notifyAt;

  // if we are ready but haven't set the notification yet
  if (!notifyAt) {
    // is the notification time set in storage
    if (Storage.get(`releaseNotification-${featureName}`)) {
      notifyAt = Number(Storage.get(`releaseNotification-${featureName}`));
      //  NOTE only log upcoming stored notifications
      if (notifyAt >= lastRefreshedAt) {
        window.log.debug(
          `[handleReleaseNotification] Loaded stored notification for ${featureName}. Time: ${new Date(notifyAt).toLocaleString()}`
        );
      }
    } else {
      // set the notification time to now or now + offset time
      notifyAt = delayMs ? lastRefreshedAt + delayMs : lastRefreshedAt;
      void Storage.put(`releaseNotification-${featureName}`, notifyAt);
      window.log.debug(
        `[handleReleaseNotification] Set notification for ${featureName}. Time: ${new Date(notifyAt).toLocaleString()}`
      );
    }
  }

  if (force) {
    notifyAt = delayMs ? lastRefreshedAt + delayMs : lastRefreshedAt;
    window.log.debug(
      `[handleReleaseNotification] Forced notification for ${featureName}. Time: ${new Date(notifyAt).toLocaleString()}`
    );
  }

  const diff = Date.now() - notifyAt;
  if (diff > 0 && diff <= FEATURE_RELEASE_CHECK_INTERVAL) {
    Notifications.addReleaseNotification(featureName, {
      conversationId: `release-notification-${featureName}`,
      message,
      title: LOCALE_DEFAULTS.app_name,
    });
  }

  return notifyAt;
};
