import { useMemo } from 'react';
import { tr } from '../../localization/localeTools';
import {
  ConversationNotificationSetting,
  type ConversationNotificationSettingType,
} from '../../models/conversationAttributes';

type Context = 'action' | 'state' | 'title';

function tokenForContextAndNotification(
  context: Context,
  notification: ConversationNotificationSettingType
) {
  switch (context) {
    case 'action':
      return notification === 'disabled'
        ? ('notificationsMute' as const)
        : notification === 'mentions_only'
          ? ('notificationsMentionsOnly' as const)
          : ('notificationsAllMessages' as const);
    case 'state':
      return notification === 'disabled'
        ? ('notificationsMuted' as const)
        : notification === 'mentions_only'
          ? ('notificationsMentionsOnly' as const)
          : ('notificationsAllMessages' as const);
    case 'title':
    default:
      return notification === 'disabled'
        ? ('notificationsHeaderMute' as const)
        : notification === 'mentions_only'
          ? ('notificationsHeaderMentionsOnly' as const)
          : ('notificationsHeaderAllMessages' as const);
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

      return { value: n, name: tr(token) };
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
