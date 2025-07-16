import { createSelector } from '@reduxjs/toolkit';
import { PubkeyType, type GroupPubkeyType } from 'libsession_util_nodejs';
import { compact, isEmpty, isFinite, isNumber, pick } from 'lodash';
import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import {
  hasValidIncomingRequestValues,
  hasValidOutgoingRequestValues,
} from '../models/conversation';
import { ConversationTypeEnum } from '../models/types';
import { isUsAnySogsFromCache } from '../session/apis/open_group_api/sogsv3/knownBlindedkeys';
import { TimerOptions, TimerOptionsArray } from '../session/disappearing_messages/timerOptions';
import { PubKey } from '../session/types';
import { UserUtils } from '../session/utils';
import { PropsForExpiringMessage } from '../state/ducks/conversations';
import { StateType } from '../state/reducer';
import {
  getMessagePropsByMessageId,
  getMessageReactsProps,
} from '../state/selectors/conversations';
import { useLibGroupAdmins, useLibGroupMembers, useLibGroupName } from '../state/selectors/groups';
import { isPrivateAndFriend } from '../state/selectors/selectedConversation';
import { useOurPkStr } from '../state/selectors/user';
import {
  useLibGroupDestroyed,
  useLibGroupInvitePending,
  useLibGroupKicked,
} from '../state/selectors/userGroups';
import { ConversationInteractionStatus, ConversationInteractionType } from '../interactions/types';
import { localize } from '../localization/localeTools';

export function useAvatarPath(convoId: string | undefined) {
  const convoProps = useConversationPropsById(convoId);
  return convoProps?.avatarPath || null;
}

export function useOurAvatarPath() {
  return useAvatarPath(UserUtils.getOurPubKeyStrFromCache());
}

/**
 *
 * @returns convo.nickname || convo.displayNameInProfile || convo.id or undefined if the convo is not found
 */
export function useConversationUsername(convoId?: string) {
  const convoProps = useConversationPropsById(convoId);
  const groupName = useLibGroupName(convoId);

  if (convoId && PubKey.is03Pubkey(convoId) && groupName) {
    // when getting a new 03 group from the user group wrapper,
    // we set the displayNameInProfile with the name from the wrapper.
    // So let's keep falling back to convoProps?.displayNameInProfile if groupName is not set yet (it comes later through the groupInfos namespace)
    return groupName;
  }
  if (convoId && (PubKey.is03Pubkey(convoId) || PubKey.is05Pubkey(convoId))) {
    return convoProps?.nickname || convoProps?.displayNameInProfile || PubKey.shorten(convoId);
  }
  return convoProps?.nickname || convoProps?.displayNameInProfile || convoId;
}

/**
 * Returns either the nickname, displayNameInProfile, or the shorten pubkey
 */
export function useNicknameOrProfileNameOrShortenedPubkey(convoId?: string) {
  const convoProps = useConversationPropsById(convoId);

  return (
    convoProps?.nickname ||
    convoProps?.displayNameInProfile ||
    (convoId && PubKey.shorten(convoId)) ||
    window.i18n('unknown')
  );
}

/**
 * Returns the nickname set for this conversation if it has one, or undefined
 */
export function useNickname(convoId?: string) {
  const convoProps = useConversationPropsById(convoId);

  return convoProps?.nickname;
}

/**
 * Returns the name of that conversation.
 * This is the group name, or the realName of a user for a private conversation with a recent nickname set
 */
export function useConversationRealName(convoId?: string) {
  const convoProps = useConversationPropsById(convoId);
  return convoProps?.isPrivate ? convoProps?.displayNameInProfile : undefined;
}

function usernameForQuoteOrFullPk(pubkey: string, state: StateType) {
  if (pubkey === UserUtils.getOurPubKeyStrFromCache() || pubkey.toLowerCase() === 'you') {
    return window.i18n('you');
  }
  // use the name from the cached libsession wrappers if available
  if (PubKey.is03Pubkey(pubkey)) {
    const info = state.groups.infos[pubkey];
    if (info && info.name) {
      return info.name;
    }
  }
  const convo = state.conversations.conversationLookup[pubkey];

  const nameGot = convo?.nickname || convo?.displayNameInProfile;
  return nameGot?.length ? nameGot : null;
}

export function usernameForQuoteOrFullPkOutsideRedux(pubkey: string) {
  if (window?.inboxStore?.getState()) {
    return usernameForQuoteOrFullPk(pubkey, window.inboxStore.getState()) || PubKey.shorten(pubkey);
  }
  return PubKey.shorten(pubkey);
}

/**
 * Returns either the nickname, the profileName, in '"' or the full pubkeys given
 */
export function useConversationsUsernameWithQuoteOrFullPubkey(pubkeys: Array<string>) {
  return useSelector((state: StateType) => {
    return pubkeys.map(pubkey => {
      const nameGot = usernameForQuoteOrFullPk(pubkey, state);
      return nameGot?.length ? nameGot : pubkey;
    });
  });
}

export function useConversationsNicknameRealNameOrShortenPubkey(pubkeys: Array<string>) {
  return useSelector((state: StateType) => {
    return pubkeys.map(pk => {
      if (pk === UserUtils.getOurPubKeyStrFromCache() || pk.toLowerCase() === 'you') {
        return window.i18n('you');
      }
      const convo = state.conversations.conversationLookup[pk];

      return convo?.nickname || convo?.displayNameInProfile || PubKey.shorten(pk);
    });
  });
}

export function useOurConversationUsername() {
  return useConversationUsername(UserUtils.getOurPubKeyStrFromCache());
}

export function useIsMe(pubkey?: string) {
  return Boolean(pubkey && pubkey === UserUtils.getOurPubKeyStrFromCache());
}

export function useIsClosedGroup(convoId?: string) {
  const convoProps = useConversationPropsById(convoId);
  return (convoProps && !convoProps.isPrivate && !convoProps.isPublic) || false;
}

export function useIsLegacyGroup(convoId?: string) {
  const isGroup = useIsClosedGroup(convoId);

  return isGroup && !!convoId && PubKey.is05Pubkey(convoId);
}

export function useIsPrivate(convoId?: string) {
  const convoProps = useConversationPropsById(convoId);
  return Boolean(convoProps && convoProps.isPrivate);
}

export function useIsPrivateAndFriend(convoId?: string) {
  const convoProps = useConversationPropsById(convoId);
  if (!convoProps) {
    return false;
  }
  return isPrivateAndFriend({
    approvedMe: convoProps.didApproveMe || false,
    isApproved: convoProps.isApproved || false,
    isPrivate: convoProps.isPrivate || false,
  });
}

export function useIsBlinded(convoId?: string) {
  if (!convoId) {
    return false;
  }
  return Boolean(PubKey.isBlinded(convoId));
}

export function useHasNickname(convoId?: string) {
  const convoProps = useConversationPropsById(convoId);
  return Boolean(convoProps && !isEmpty(convoProps.nickname));
}

export function useNotificationSetting(convoId?: string) {
  const convoProps = useConversationPropsById(convoId);
  return convoProps?.currentNotificationSetting || 'all';
}

export function useIsGroupV2(convoId?: string): convoId is GroupPubkeyType {
  const convoProps = useConversationPropsById(convoId);
  return (
    (convoId && convoProps?.type === ConversationTypeEnum.GROUPV2 && PubKey.is03Pubkey(convoId)) ||
    false
  );
}

export function useIsPublic(convoId?: string) {
  const convoProps = useConversationPropsById(convoId);
  return Boolean(convoProps && convoProps.isPublic);
}

export function useIsBlocked(convoId?: string) {
  const convoProps = useConversationPropsById(convoId);
  return Boolean(convoProps && convoProps.isBlocked);
}

export function useActiveAt(convoId?: string): number | undefined {
  const convoProps = useConversationPropsById(convoId);
  return convoProps?.activeAt;
}

export function useIsActive(convoId?: string) {
  return !!useActiveAt(convoId);
}

export function useIsKickedFromGroup(convoId?: string) {
  const convoProps = useConversationPropsById(convoId);
  const libIsKicked = useLibGroupKicked(convoId);
  if (convoId && PubKey.is03Pubkey(convoId)) {
    return libIsKicked ?? false;
  }
  return Boolean(convoProps && (convoProps.isKickedFromGroup || libIsKicked)); // not ideal, but until we trust what we get from libsession for all cases, we have to either trust what we have in the DB
}

export function useIsGroupDestroyed(convoId?: string) {
  const libIsDestroyed = useLibGroupDestroyed(convoId);
  if (convoId && PubKey.is03Pubkey(convoId)) {
    return !!libIsDestroyed;
  }
  return false;
}

export function useWeAreAdmin(convoId?: string) {
  const groupAdmins = useGroupAdmins(convoId);
  const us = useOurPkStr();
  return Boolean(groupAdmins.includes(us));
}

export function useGroupAdmins(convoId?: string) {
  const convoProps = useConversationPropsById(convoId);

  const libMembers = useLibGroupAdmins(convoId);

  if (convoId && PubKey.is03Pubkey(convoId)) {
    return compact(libMembers?.slice()?.sort()) || [];
  }

  return convoProps?.groupAdmins || [];
}

export function useExpireTimer(convoId?: string) {
  const convoProps = useConversationPropsById(convoId);
  return convoProps && convoProps.expireTimer;
}

export function useIsPinned(convoId?: string) {
  const convoProps = useConversationPropsById(convoId);
  return Boolean(
    convoProps &&
      isNumber(convoProps.priority) &&
      isFinite(convoProps.priority) &&
      convoProps.priority > 0
  );
}

export function useIsHidden(convoId?: string) {
  const convoProps = useConversationPropsById(convoId);
  return Boolean(
    convoProps &&
      isNumber(convoProps.priority) &&
      isFinite(convoProps.priority) &&
      convoProps.priority < 0
  );
}

export function useIsApproved(convoId?: string) {
  const convoProps = useConversationPropsById(convoId);
  return Boolean(convoProps && convoProps.isApproved);
}

export function useIsIncomingRequest(convoId?: string) {
  const convoProps = useConversationPropsById(convoId);
  const invitePending = useLibGroupInvitePending(convoId) || false;
  if (!convoProps) {
    return false;
  }
  return Boolean(
    convoProps &&
      hasValidIncomingRequestValues({
        id: convoProps.id,
        isMe: convoProps.isMe || false,
        isApproved: convoProps.isApproved || false,
        isPrivate: convoProps.isPrivate || false,
        isBlocked: convoProps.isBlocked || false,
        didApproveMe: convoProps.didApproveMe || false,
        activeAt: convoProps.activeAt || 0,
        invitePending,
        priority: convoProps.priority,
      })
  );
}

export function useIsOutgoingRequest(convoId?: string) {
  const convoProps = useConversationPropsById(convoId);
  if (!convoProps) {
    return false;
  }

  return Boolean(
    convoProps &&
      hasValidOutgoingRequestValues({
        isMe: convoProps.isMe || false,
        isApproved: convoProps.isApproved || false,
        didApproveMe: convoProps.didApproveMe || false,
        isPrivate: convoProps.isPrivate || false,
        isBlocked: convoProps.isBlocked || false,
        activeAt: convoProps.activeAt || 0,
      })
  );
}

/**
 * Note: NOT to be exported:
 * This selector is too generic and needs to be broken down into individual fields selectors.
 * Make sure when writing a selector that you fetch the data from libsession if needed.
 * (check useSortedGroupMembers() as an example)
 */
function useConversationPropsById(convoId?: string) {
  return useSelector((state: StateType) => {
    if (!convoId) {
      return null;
    }
    const convo = state.conversations.conversationLookup[convoId];
    if (!convo) {
      return null;
    }
    return convo;
  });
}

export function useMessageReactsPropsById(messageId?: string) {
  return useSelector((state: StateType) => {
    if (!messageId) {
      return null;
    }
    const messageReactsProps = getMessageReactsProps(state, messageId);
    if (!messageReactsProps) {
      return null;
    }
    return messageReactsProps;
  });
}

/**
 * Returns the unread count of that conversation, or 0 if none are found.
 * Note: returned value is capped at a max of CONVERSATION.MAX_CONVO_UNREAD_COUNT
 */
export function useUnreadCount(conversationId?: string): number {
  const convoProps = useConversationPropsById(conversationId);
  return convoProps?.unreadCount || 0;
}

export function useHasUnread(conversationId?: string): boolean {
  return useUnreadCount(conversationId) > 0;
}

export function useIsForcedUnreadWithoutUnreadMsg(conversationId?: string): boolean {
  const convoProps = useConversationPropsById(conversationId);
  return convoProps?.isMarkedUnread || false;
}

function useMentionedUsUnread(conversationId?: string) {
  const convoProps = useConversationPropsById(conversationId);
  return convoProps?.mentionedUs || false;
}

export function useMentionedUs(conversationId?: string): boolean {
  const hasMentionedUs = useMentionedUsUnread(conversationId);
  const hasUnread = useHasUnread(conversationId);

  return hasMentionedUs && hasUnread;
}

export function useIsTyping(conversationId?: string): boolean {
  return useConversationPropsById(conversationId)?.isTyping || false;
}

const getMessageExpirationProps = createSelector(
  getMessagePropsByMessageId,
  (props): PropsForExpiringMessage | undefined => {
    if (!props || isEmpty(props)) {
      return undefined;
    }

    const msgProps: PropsForExpiringMessage = {
      ...pick(props.propsForMessage, [
        'convoId',
        'direction',
        'receivedAt',
        'isUnread',
        'expirationTimestamp',
        'expirationDurationMs',
        'isExpired',
      ]),
      messageId: props.propsForMessage.id,
    };

    return msgProps;
  }
);

export function useMessageExpirationPropsById(messageId?: string) {
  return useSelector((state: StateType) => {
    if (!messageId) {
      return null;
    }
    const messageExpirationProps = getMessageExpirationProps(state, messageId);
    if (!messageExpirationProps) {
      return null;
    }
    return messageExpirationProps;
  });
}

export function useTimerOptionsByMode(disappearingMessageMode?: string, hasOnlyOneMode?: boolean) {
  return useMemo(() => {
    const options: TimerOptionsArray = [];
    if (hasOnlyOneMode) {
      options.push({
        name: TimerOptions.getName(TimerOptions.VALUES[0]),
        value: TimerOptions.VALUES[0],
      });
    }
    switch (disappearingMessageMode) {
      case 'deleteAfterRead':
        options.push(
          ...TimerOptions.DELETE_AFTER_READ.map(option => ({
            name: TimerOptions.getName(option),
            value: option,
          }))
        );
        break;
      case 'deleteAfterSend':
        options.push(
          ...TimerOptions.DELETE_AFTER_SEND.map(option => ({
            name: TimerOptions.getName(option),
            value: option,
          }))
        );
        break;
      default:
        return [];
    }
    return options;
  }, [disappearingMessageMode, hasOnlyOneMode]);
}

export function useQuoteAuthorName(authorId?: string): {
  authorName: string | undefined;
  isMe: boolean;
} {
  const convoProps = useConversationPropsById(authorId);

  const isMe = Boolean(authorId && isUsAnySogsFromCache(authorId));
  const authorName = isMe
    ? window.i18n('you')
    : convoProps?.nickname || convoProps?.isPrivate
      ? convoProps?.displayNameInProfile
      : undefined;

  return { authorName, isMe };
}

export function use05GroupMembers(convoId: string | undefined): Array<PubkeyType> {
  const props = useConversationPropsById(convoId);
  const members = props?.members || [];
  if (members.every(m => PubKey.is05Pubkey(m))) {
    return members;
  }
  throw new Error('use05GroupMembers: some members not 05 prefixed. That cannot be possible.');
}

/**
 * Get the list of members of a closed group or []
 * @param convoId the closed group id to extract members from
 */
export function useSortedGroupMembers(convoId: string | undefined): Array<PubkeyType> {
  const members = use05GroupMembers(convoId);
  const isPublic = useIsPublic(convoId);
  const isPrivate = useIsPrivate(convoId);
  const libMembers = useLibGroupMembers(convoId);
  if (isPrivate || isPublic) {
    return [];
  }
  if (convoId && PubKey.is03Pubkey(convoId)) {
    return compact(libMembers.slice()?.sort());
  }
  // we need to clone the array before being able to call sort() it
  return compact(members.slice()?.sort());
}

/**
 * Returns the disappearing message setting text for the convoId.
 * Note: the time is not localised and displayed always in its shortened version (i.e. 2weeks -> 2w).
 * This is because 2w is assumed to understood by every locales as 2 weeks, but 2 weeks might not be.
 */
export function useDisappearingMessageSettingText({ convoId }: { convoId?: string }) {
  const convoProps = useConversationPropsById(convoId);

  const offReturn = { id: 'off', label: localize('off').toString() };
  if (!convoProps) {
    return offReturn;
  }

  const { expirationMode, expireTimer } = convoProps;

  const expireTimerText = isNumber(expireTimer) ? TimerOptions.getAbbreviated(expireTimer) : null;

  if (!expireTimerText) {
    return offReturn;
  }

  return expirationMode === 'deleteAfterRead'
    ? {
        id: expirationMode,
        label: localize('disappearingMessagesDisappearAfterReadState')
          .withArgs({ time: expireTimerText })
          .toString(),
      }
    : expirationMode === 'deleteAfterSend'
      ? {
          id: expirationMode,
          label: localize('disappearingMessagesDisappearAfterSendState')
            .withArgs({ time: expireTimerText })
            .toString(),
        }
      : offReturn;
}

export function useLastMessage(convoId?: string) {
  const convoProps = useConversationPropsById(convoId);

  if (!convoId || !convoProps) {
    return null;
  }

  return convoProps.lastMessage;
}

export function useLastMessageIsLeaveError(convoId?: string) {
  const lastMessage = useLastMessage(convoId);

  return (
    lastMessage?.interactionType === ConversationInteractionType.Leave &&
    lastMessage?.interactionStatus === ConversationInteractionStatus.Error
  );
}
