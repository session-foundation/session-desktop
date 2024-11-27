import { PubkeyType } from 'libsession_util_nodejs';
import { ConvoHub } from '../session/conversations';
import { PropsForExpirationTimer } from '../state/ducks/conversations';
import { PubKey } from '../session/types';
import { UserUtils } from '../session/utils';
import { TimerOptions } from '../session/disappearing_messages/timerOptions';
import { isLegacyDisappearingModeEnabled } from '../session/disappearing_messages/legacy';
import type { LocalizerComponentPropsObject } from '../types/localizer';

export function getTimerNotificationStr({
  expirationMode,
  timespanSeconds,
  convoId,
  author,
  isGroup,
}: Pick<PropsForExpirationTimer, 'expirationMode' | 'timespanSeconds'> & {
  author: PubkeyType;
  convoId: string;
  isGroup: boolean;
}): LocalizerComponentPropsObject {
  const is03group = PubKey.is03Pubkey(convoId);
  const authorIsUs = author === UserUtils.getOurPubKeyStrFromCache();
  const isLegacyGroup = isGroup && !is03group;
  const timespanText = TimerOptions.getName(timespanSeconds || 0);
  const disabled = !timespanSeconds || timespanSeconds <= 0;

  const authorName = ConvoHub.use().getContactProfileNameOrShortenedPubKey(author);

  // TODO: legacy messages support will be removed in a future release
  if (isLegacyDisappearingModeEnabled(expirationMode)) {
    return {
      token: 'deleteAfterLegacyDisappearingMessagesTheyChangedTimer',
      args: {
        name: authorIsUs ? window.i18n('you') : authorName,
        time: timespanText,
      },
    } as const;
  }

  const disappearing_messages_type =
    expirationMode === 'deleteAfterRead'
      ? window.i18n('disappearingMessagesTypeRead')
      : window.i18n('disappearingMessagesTypeSent');

  if (isLegacyGroup || isGroup) {
    if (disabled) {
      return authorIsUs
        ? {
            token: 'disappearingMessagesTurnedOffYouGroup',
          }
        : {
            token: 'disappearingMessagesTurnedOffGroup',
            args: {
              name: authorName,
            },
          };
    }
    return authorIsUs
      ? {
          token: 'disappearingMessagesSetYou',
          args: { time: timespanText, disappearing_messages_type },
        }
      : {
          token: 'disappearingMessagesSet',
          args: { name: authorName, time: timespanText, disappearing_messages_type },
        };
  }

  // legacy groups and groups are handled above.
  // This can only be a private chat or Note to Self.
  if (disabled) {
    return authorIsUs
      ? {
          token: 'disappearingMessagesTurnedOffYou',
        }
      : {
          token: 'disappearingMessagesTurnedOff',
          args: {
            name: authorName,
          },
        };
  }

  return authorIsUs
    ? {
        token: 'disappearingMessagesSetYou',
        args: {
          time: timespanText,
          disappearing_messages_type,
        },
      }
    : {
        token: 'disappearingMessagesSet',
        args: {
          time: timespanText,
          disappearing_messages_type,
          name: authorName,
        },
      };
}
