import { useMemo } from 'react';
import { localize, type MergedLocalizerTokens } from '../../localization/localeTools';
import {
  ConversationNotificationSetting,
  type ConversationNotificationSettingType,
} from '../../models/conversationAttributes';

type Context = 'action' | 'state' | 'title';

function tokenForContextAndNotification(
  context: Context,
  notification: ConversationNotificationSettingType
): MergedLocalizerTokens {
  switch (context) {
    case 'action':
      return notification === 'disabled'
        ? 'notificationsMute'
        : notification === 'mentions_only'
          ? 'notificationsMentionsOnly'
          : 'notificationsAllMessages';
    case 'state':
      return notification === 'disabled'
        ? 'notificationsMuted'
        : notification === 'mentions_only'
          ? 'notificationsMentionsOnly'
          : 'notificationsAllMessages';
    case 'title':
    default:
      return notification === 'disabled'
        ? 'notificationsHeaderMute'
        : notification === 'mentions_only'
          ? 'notificationsHeaderMentionsOnly'
          : 'notificationsHeaderAllMessages';
  }
}

/**
 * return the localised notification options as a memoized array.
 * @param context is used to tell apart if we want the string for the state, for the action or for the header
 * For instance, mute will be localised as "Muted" as the state, but "Mute" as the action.
 *
 */
export const useLocalisedNotificationOptions = (context: Context) => {
  return useMemo(() => {
    return ConversationNotificationSetting.map((n: ConversationNotificationSettingType) => {
      const token = tokenForContextAndNotification(context, n);

      return { value: n, name: localize(token).toString() };
    });
  }, [context]);
};

export const useLocalisedNotificationOf = (
  notification: ConversationNotificationSettingType,
  context: Context
) => {
  const localisedNotificationOptions = useLocalisedNotificationOptions(context);
  const name = localisedNotificationOptions.find(m => m.value === notification)?.name;
  if (!name) {
    throw new Error('useLocalisedNotificationOf() called with an invalid notification type');
  }
  return name;
};
