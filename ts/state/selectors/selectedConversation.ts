import { isString } from 'lodash';
import { useSelector } from 'react-redux';
import { useUnreadCount } from '../../hooks/useParamSelector';
import { isOpenOrClosedGroup } from '../../models/conversationAttributes';
import { ConversationTypeEnum } from '../../models/types';
import {
  DisappearingMessageConversationModeType,
  DisappearingMessageConversationModes,
} from '../../session/disappearing_messages/types';
import { PubKey } from '../../session/types';
import { UserUtils } from '../../session/utils';
import { StateType } from '../reducer';
import {
  getIsMessageSelectionMode,
  getSelectedConversation,
  getSelectedMessageIds,
} from './conversations';
import { getLibMembersPubkeys, useLibGroupName } from './groups';
import { getCanWrite, getModerators, getSubscriberCount } from './sogsRoomInfo';
import { getLibGroupDestroyed, useLibGroupDestroyed } from './userGroups';

const getIsSelectedPrivate = (state: StateType): boolean => {
  return Boolean(getSelectedConversation(state)?.isPrivate) || false;
};

export const getIsSelectedBlocked = (state: StateType): boolean => {
  return Boolean(getSelectedConversation(state)?.isBlocked) || false;
};

const getSelectedApprovedMe = (state: StateType): boolean => {
  return Boolean(getSelectedConversation(state)?.didApproveMe) || false;
};

/**
 * Returns true if the currently selected conversation is active (has an active_at field > 0)
 */
const getIsSelectedActive = (state: StateType): boolean => {
  return Boolean(getSelectedConversation(state)?.activeAt) || false;
};

const getIsSelectedNoteToSelf = (state: StateType): boolean => {
  return getSelectedConversation(state)?.isMe || false;
};

export const getSelectedConversationKey = (state: StateType): string | undefined => {
  return state.conversations.selectedConversation;
};

/**
 * Returns true if the current conversation selected is a public group and false otherwise.
 */
export const getSelectedConversationIsPublic = (state: StateType): boolean => {
  return Boolean(getSelectedConversation(state)?.isPublic) || false;
};

/**
 * Returns true if the current conversation selected can be typed into
 */
export function getSelectedCanWrite(state: StateType) {
  const selectedConvoPubkey = getSelectedConversationKey(state);
  const isSelectedGroupDestroyed = getLibGroupDestroyed(state, selectedConvoPubkey);
  if (!selectedConvoPubkey) {
    return false;
  }
  const selectedConvo = getSelectedConversation(state);
  if (!selectedConvo) {
    return false;
  }
  const canWriteSogs = getCanWrite(state, selectedConvoPubkey);
  const { isBlocked, isKickedFromGroup, isPublic } = selectedConvo;

  const readOnlySogs = isPublic && !canWriteSogs;

  const isBlindedAndDisabledMsgRequests = getSelectedBlindedDisabledMsgRequests(state); // true if isPrivate, blinded and explicitly disabled msgreq

  return !(
    isBlocked ||
    isKickedFromGroup ||
    isSelectedGroupDestroyed ||
    readOnlySogs ||
    isBlindedAndDisabledMsgRequests
  );
}

function getSelectedBlindedDisabledMsgRequests(state: StateType) {
  const selectedConvoPubkey = getSelectedConversationKey(state);
  if (!selectedConvoPubkey) {
    return false;
  }
  const selectedConvo = getSelectedConversation(state);
  if (!selectedConvo) {
    return false;
  }
  const { blocksSogsMsgReqsTimestamp, isPrivate } = selectedConvo;

  const isBlindedAndDisabledMsgRequests = Boolean(
    isPrivate && PubKey.isBlinded(selectedConvoPubkey) && blocksSogsMsgReqsTimestamp
  );

  return isBlindedAndDisabledMsgRequests;
}

/**
 * Defaults to 'all' if undefined/unset
 */
function getSelectedNotificationSetting(state: StateType) {
  return getSelectedConversation(state)?.currentNotificationSetting || 'all';
}

const getSelectedConversationType = (state: StateType): ConversationTypeEnum | null => {
  const selected = getSelectedConversation(state);
  if (!selected || !selected.type) {
    return null;
  }
  return selected.type;
};

const getSelectedConversationIsGroupOrCommunity = (state: StateType): boolean => {
  const type = getSelectedConversationType(state);
  return type ? isOpenOrClosedGroup(type) : false;
};

/**
 * Returns true if the current conversation selected is a group conversation.
 * Returns false if the current conversation selected is not a group conversation, or none are selected
 */
const getSelectedConversationIsGroupV2 = (state: StateType): boolean => {
  const selected = getSelectedConversation(state);
  if (!selected || !selected.type) {
    return false;
  }
  return selected.type
    ? selected.type === ConversationTypeEnum.GROUPV2 && PubKey.is03Pubkey(selected.id)
    : false;
};

/**
 * Returns true if the current conversation selected is a closed group and false otherwise.
 */
export const isClosedGroupConversation = (state: StateType): boolean => {
  const selected = getSelectedConversation(state);
  if (!selected) {
    return false;
  }
  return (
    (selected.type === ConversationTypeEnum.GROUP && !selected.isPublic) ||
    selected.type === ConversationTypeEnum.GROUPV2 ||
    false
  );
};

const getSelectedMembersCount = (state: StateType): number => {
  const selected = getSelectedConversation(state);
  if (!selected) {
    return 0;
  }
  if (PubKey.is03Pubkey(selected.id)) {
    return getLibMembersPubkeys(state, selected.id).length || 0;
  }
  if (selected.isPrivate || selected.isPublic) {
    return 0;
  }
  return selected.members?.length || 0;
};

const getSelectedGroupAdmins = (state: StateType): Array<string> => {
  const selected = getSelectedConversation(state);
  if (!selected) {
    return [];
  }

  return selected.groupAdmins || [];
};

const getSelectedSubscriberCount = (state: StateType): number | undefined => {
  const convo = getSelectedConversation(state);
  if (!convo) {
    return undefined;
  }
  return getSubscriberCount(state, convo.id);
};

export const getSelectedConversationExpirationModes = (state: StateType) => {
  const convo = getSelectedConversation(state);
  if (!convo) {
    return undefined;
  }

  // NOTE this needs to be as any because the number of modes can change depending on if v2 is released or we are in single mode
  let modes: any = DisappearingMessageConversationModes;
  // TODO legacy messages support will be removed in a future release
  // TODO remove legacy mode
  modes = modes.slice(0, -1);

  // Note to Self and Closed Groups only support deleteAfterSend
  const isClosedGroup = !convo.isPrivate && !convo.isPublic;
  if (convo?.isMe || isClosedGroup) {
    modes = [modes[0], modes[2]];
  }

  // NOTE disabled = true
  const modesWithDisabledState: Record<string, boolean> = {};
  if (modes && modes.length > 1) {
    modes.forEach((mode: any) => {
      modesWithDisabledState[mode] = isClosedGroup ? !convo.weAreAdmin : false;
    });
  }

  return modesWithDisabledState;
};

// ============== SELECTORS RELEVANT TO SELECTED/OPENED CONVERSATION ==============

export function useSelectedConversationKey() {
  return useSelector(getSelectedConversationKey);
}

export function useSelectedIsGroupOrCommunity() {
  return useSelector(getSelectedConversationIsGroupOrCommunity);
}

export function useSelectedIsGroupV2() {
  return useSelector(getSelectedConversationIsGroupV2);
}

/**
 *
 * @returns true if the selected conversation is a group (or group v2), but not a community
 */
export function useSelectedIsGroupOrGroupV2() {
  const isGroupOrCommunity = useSelectedIsGroupOrCommunity();
  const isPublic = useSelectedIsPublic();

  return isGroupOrCommunity && !isPublic;
}

/**
 *
 * @returns true if the selected conversation is a community (public groups)
 */
export function useSelectedIsPublic() {
  return useSelector(getSelectedConversationIsPublic);
}

/**
 *
 * @returns true if the conversation is a legacy group (closed group with a 05 pubkey)
 */
export function useSelectedIsLegacyGroup() {
  const isGroupOrCommunity = useSelectedIsGroupOrCommunity();
  const isGroupV2 = useSelectedIsGroupV2();
  const isPublic = useSelectedIsPublic();

  return isGroupOrCommunity && !isGroupV2 && !isPublic;
}

export function useSelectedIsPrivate() {
  return useSelector(getIsSelectedPrivate);
}

export function useSelectedIsBlocked() {
  return useSelector(getIsSelectedBlocked);
}

export function useSelectedIsApproved() {
  return useSelector((state: StateType): boolean => {
    return !!(getSelectedConversation(state)?.isApproved || false);
  });
}

export function useSelectedApprovedMe() {
  return useSelector(getSelectedApprovedMe);
}

export function useSelectedHasDisabledBlindedMsgRequests() {
  return useSelector(getSelectedBlindedDisabledMsgRequests);
}

export function useSelectedNotificationSetting() {
  return useSelector(getSelectedNotificationSetting);
}

/**
 * Returns true if the given arguments corresponds to a private contact which is approved both sides. i.e. a friend.
 */
export function isPrivateAndFriend({
  approvedMe,
  isApproved,
  isPrivate,
}: {
  isPrivate: boolean;
  isApproved: boolean;
  approvedMe: boolean;
}) {
  return isPrivate && isApproved && approvedMe;
}

/**
 * Returns true if the selected conversation is private and is approved both sides
 */
export function useSelectedIsPrivateFriend() {
  const isPrivate = useSelectedIsPrivate();
  const isApproved = useSelectedIsApproved();
  const approvedMe = useSelectedApprovedMe();
  return isPrivateAndFriend({ isPrivate, isApproved, approvedMe });
}

export function useSelectedIsActive() {
  return useSelector(getIsSelectedActive);
}

export function useSelectedUnreadCount() {
  const selectedConversation = useSelectedConversationKey();
  return useUnreadCount(selectedConversation);
}

export function useSelectedIsNoteToSelf() {
  return useSelector(getIsSelectedNoteToSelf);
}

export function useSelectedMembersCount() {
  return useSelector(getSelectedMembersCount);
}

export function useSelectedGroupAdmins() {
  return useSelector(getSelectedGroupAdmins);
}

export function useSelectedSubscriberCount() {
  return useSelector(getSelectedSubscriberCount);
}

export function useSelectedIsKickedFromGroup() {
  return useSelector(
    (state: StateType) => Boolean(getSelectedConversation(state)?.isKickedFromGroup) || false
  );
}

export function useSelectedIsGroupDestroyed() {
  const convoKey = useSelectedConversationKey();
  return useLibGroupDestroyed(convoKey);
}

export function useSelectedExpireTimer(): number | undefined {
  return useSelector((state: StateType) => getSelectedConversation(state)?.expireTimer);
}

export function useSelectedConversationDisappearingMode():
  | DisappearingMessageConversationModeType
  | undefined {
  return useSelector((state: StateType) => getSelectedConversation(state)?.expirationMode);
}

export function useSelectedConversationIdOrigin() {
  return useSelector((state: StateType) => getSelectedConversation(state)?.conversationIdOrigin);
}

export function useSelectedNickname() {
  return useSelector((state: StateType) => getSelectedConversation(state)?.nickname);
}

export function useSelectedDisplayNameInProfile() {
  return useSelector((state: StateType) => getSelectedConversation(state)?.displayNameInProfile);
}

/**
 * For a private chat, this returns the (xxxx...xxxx) shortened pubkey
 * If this is a private chat, but somehow, we have no pubkey, this returns the localized `anonymous` string
 * Otherwise, this returns the localized `unknown` string
 */
export function useSelectedShortenedPubkeyOrFallback() {
  const isPrivate = useSelectedIsPrivate();
  const selected = useSelectedConversationKey();
  if (isPrivate && selected) {
    return PubKey.shorten(selected);
  }
  return window.i18n('unknown');
}

/**
 * That's a very convoluted way to say "nickname or profile name or shortened pubkey or ("Anonymous" or "unknown" depending on the type of conversation).
 * This also returns the localized "Note to Self" if the conversation is the note to self.
 */
export function useSelectedNicknameOrProfileNameOrShortenedPubkey() {
  const selectedId = useSelectedConversationKey();
  const nickname = useSelectedNickname();
  const profileName = useSelectedDisplayNameInProfile();
  const shortenedPubkey = useSelectedShortenedPubkeyOrFallback();
  const isMe = useSelectedIsNoteToSelf();
  const libGroupName = useLibGroupName(selectedId);
  if (isMe) {
    return window.i18n('noteToSelf');
  }
  if (selectedId && PubKey.is03Pubkey(selectedId)) {
    return libGroupName || profileName || shortenedPubkey;
  }
  return nickname || profileName || shortenedPubkey;
}

export function useSelectedWeAreAdmin() {
  return useSelector((state: StateType) => getSelectedConversation(state)?.weAreAdmin || false);
}

/**
 * Only for communities.
 * @returns true if the selected convo is a community and we are one of the moderators
 */
export function useSelectedWeAreModerator() {
  // TODO might be something to memoize let's see
  const isPublic = useSelectedIsPublic();
  const selectedConvoKey = useSelectedConversationKey();
  const us = UserUtils.getOurPubKeyStrFromCache();
  const mods = useSelector((state: StateType) => getModerators(state, selectedConvoKey));

  const weAreModerator = mods.includes(us);
  return isPublic && isString(selectedConvoKey) && weAreModerator;
}

export function useIsMessageSelectionMode() {
  return useSelector(getIsMessageSelectionMode);
}

export function useSelectedLastMessage() {
  return useSelector((state: StateType) => getSelectedConversation(state)?.lastMessage);
}

export function useSelectedMessageIds() {
  return useSelector(getSelectedMessageIds);
}
