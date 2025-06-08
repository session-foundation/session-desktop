import { debounce, last } from 'lodash';
import { SettingsKey } from '../data/settings-key';
import { getStatus } from '../notifications';
import { UserSetting } from '../notifications/getStatus';
import { isMacOS } from '../OS';
import { isAudioNotificationSupported } from '../types/Settings';
import { isWindowFocused } from './focusListener';
import { Storage } from './storage';
import { LOCALE_DEFAULTS } from '../localization/constants';
import {
  isSessionFeatureFlag,
  type SessionFeatureFlagKeys,
} from '../state/ducks/types/releasedFeaturesReduxTypes';

function filter(text?: string) {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

let sound: any;

export type SessionNotification = {
  title: string;
  message: string;
  iconUrl?: string;
  messageId?: string;
  conversationId?: string;
  isExpiringMessage?: boolean;
};

let isEnabled: boolean = false;
let currentNotification: null | Notification = null;

let currentNotifications: Array<SessionNotification> = [];

// Testing indicated that trying to create/destroy notifications too quickly
//   resulted in notifications that stuck around forever, requiring the user
//   to manually close them. This introduces a minimum amount of time between calls,
//   and batches up the quick successive update() calls we get from an incoming
//   read sync, which might have a number of messages referenced inside of it.
const debouncedUpdate = debounce(update, 2000, { trailing: true, maxWait: 2000 });
const fastUpdate = update;

function clear() {
  // window.log.info('Remove all notifications');
  currentNotifications = [];
  debouncedUpdate();
}

// We don't usually call this, but when the process is shutting down, we should at
//   least try to remove the notification immediately instead of waiting for the
//   normal debounce.
function fastClear() {
  currentNotifications = [];
  fastUpdate();
}

function enable() {
  const needUpdate = !isEnabled;
  isEnabled = true;
  if (needUpdate) {
    debouncedUpdate();
  }
}

function disable() {
  isEnabled = false;
}

/**
 *
 * @param forceRefresh Should only be set when the user triggers a test notification from the settings
 */
function addNotification(notif: SessionNotification) {
  const alreadyThere = currentNotifications.find(
    n => n.conversationId === notif.conversationId && n.messageId === notif.messageId
  );

  if (alreadyThere) {
    return;
  }
  currentNotifications.push(notif);
  debouncedUpdate();
}

/**
 * Special case when we want to display a preview of what notifications looks like
 */
function addPreviewNotification(notif: SessionNotification) {
  currentNotifications.push(notif);
  update(true);
}

/**
 * Only use this for release notifications
 */
function addReleaseNotification(feature: SessionFeatureFlagKeys, notif: SessionNotification) {
  if (!isSessionFeatureFlag(feature)) {
    window.log.warn(`[releasedFeature] Notification failed. Invalid feature flag "${feature}"`);
    return;
  }

  window.log.info(`[releasedFeature] Notification for "${feature}"\n\n  ${JSON.stringify(notif)}`);
  currentNotifications.push(notif);
  update(true);
}

function clearByConversationID(convoId: string) {
  const oldLength = currentNotifications.length;
  currentNotifications = currentNotifications.filter(n => n.conversationId === convoId);
  if (oldLength !== currentNotifications.length) {
    onRemove();
  }
}

function clearByMessageId(messageId: string) {
  if (!messageId) {
    return;
  }
  const oldLength = currentNotifications.length;
  currentNotifications = currentNotifications.filter(n => n.messageId === messageId);
  if (oldLength !== currentNotifications.length) {
    onRemove();
  }
}

function getNotificationDetails(
  notifications: Array<SessionNotification>,
  userSetting: UserSetting
): SessionNotification | null {
  if (!notifications.length) {
    return null;
  }
  if (userSetting === 'off') {
    return null;
  }

  const messagesNotificationCount = currentNotifications.length;

  // NOTE: i18n has more complex rules for pluralization than just
  // distinguishing between zero (0) and other (non-zero),
  // e.g. Russian:
  // http://docs.translatehouse.org/projects/localization-guide/en/latest/l10n/pluralforms.html
  const newMessageCountLabel = window.i18n('messageNew', { count: messagesNotificationCount });

  const lastNotification = last(currentNotifications);

  if (!lastNotification || messagesNotificationCount <= 0) {
    return null;
  }
  const lastNotificationTitle = lastNotification.title;
  const lastNotificationMessage = lastNotification.message;
  const mostRecentFrom = window.i18n('notificationsMostRecent', { name: lastNotificationTitle });

  // if the last message is an expiring one, fallback to the COUNT only option so we don't leak the message in the notification status
  // on macos.
  const overriddenUserSetting: UserSetting =
    lastNotification.isExpiringMessage && isMacOS() ? 'count' : userSetting;

  switch (overriddenUserSetting) {
    case 'name': {
      return {
        title: newMessageCountLabel,
        iconUrl: lastNotification.iconUrl,
        message:
          messagesNotificationCount === 1
            ? `${window.i18n('from')} ${lastNotificationTitle}`
            : mostRecentFrom,
      };
    }
    case 'message':
      return {
        title: messagesNotificationCount === 1 ? lastNotificationTitle : newMessageCountLabel,
        iconUrl: lastNotification.iconUrl,
        message:
          messagesNotificationCount === 1
            ? lastNotificationMessage
            : `${mostRecentFrom}: ${lastNotificationMessage}`,
      };
    case 'count':
    default:
      // default case: assume we want the most privacy so COUNT of messages only
      return {
        title: LOCALE_DEFAULTS.app_name,
        message: newMessageCountLabel,
      };
  }
}

function update(forceRefresh = false) {
  if (currentNotification) {
    currentNotification.close();
    currentNotification = null;
  }

  const isAppFocused = isWindowFocused();
  const isAudioNotificationEnabled =
    (Storage.get(SettingsKey.settingsAudioNotification) as boolean) || false;
  const audioNotificationSupported = isAudioNotificationSupported();
  const numNotifications = currentNotifications.length;
  const userSetting = getUserSetting();

  const status = getStatus({
    isAppFocused: forceRefresh ? false : isAppFocused,
    isAudioNotificationEnabled,
    isAudioNotificationSupported: audioNotificationSupported,
    isEnabled,
    numNotifications,
    userSetting,
  });

  // window.log.info(
  //   'Update notifications:',
  //   Object.assign({}, status, {
  //     isNotificationGroupingSupported,
  //   })
  // );

  if (status.type !== 'ok') {
    if (status.shouldClearNotifications) {
      currentNotifications = [];
    }

    return;
  }

  if (!currentNotifications.length) {
    return;
  }

  const lastNotification = last(currentNotifications);

  if (!lastNotification) {
    return;
  }

  // We continue to build up more and more messages for our notifications
  // until the user comes back to our app or closes the app. Then we’ll
  // clear everything out. The good news is that we'll have a maximum of
  // 1 notification in the Notification area (something like
  // ‘10 new messages’) assuming that `Notification::close` does its job.
  const details = getNotificationDetails(currentNotifications, getUserSetting());
  if (!details) {
    return;
  }

  window.drawAttention();
  if (status.shouldPlayNotificationSound) {
    if (!sound) {
      sound = new Audio('sound/new_message.mp3');
    }
    void sound.play();
  }
  currentNotification = new Notification(details.title || '', {
    body: window.platform === 'linux' ? filter(details.message) : details.message,
    // NOTE only Linux needs a fallback, macOS and Windows already show the app icon
    icon: details.iconUrl
      ? details.iconUrl
      : window.platform === 'linux'
        ? 'images/session/session_icon.png'
        : undefined,
    silent: true,
  });
  currentNotification.onclick = () => {
    window.openFromNotification(lastNotification.conversationId);
  };
}
function getUserSetting() {
  return (Storage.get('notification-setting') as UserSetting) || 'message';
}
function onRemove() {
  // window.log.info('Remove notification');
  debouncedUpdate();
}

export const Notifications = {
  addNotification,
  addPreviewNotification,
  addReleaseNotification,
  disable,
  enable,
  clear,
  fastClear,
  clearByConversationID,
  clearByMessageId,
};
