import { defaults } from 'lodash';
import { DisappearingMessageConversationModeType } from '../session/disappearing_messages/types';

import { ConversationTypeEnum, CONVERSATION_PRIORITIES } from './types';
import { ConversationInteractionType, ConversationInteractionStatus } from '../interactions/types';
import { LastMessageStatusType } from '../state/ducks/types';

export function isOpenOrClosedGroup(conversationType: ConversationTypeEnum) {
  return (
    conversationType === ConversationTypeEnum.GROUP ||
    conversationType === ConversationTypeEnum.GROUPV2
  );
}

export function isDirectConversation(conversationType: ConversationTypeEnum) {
  return conversationType === ConversationTypeEnum.PRIVATE;
}

/**
 * all: all  notifications enabled, the default
 * disabled: no notifications at all
 * mentions_only: trigger a notification only on mentions of ourself
 */
export const ConversationNotificationSetting = ['all', 'disabled', 'mentions_only'] as const;
export type ConversationNotificationSettingType = (typeof ConversationNotificationSetting)[number];

/**
 * Some fields are retrieved from the database as a select, but should not be saved in a commit()
 * TODO (do we, and can we use this)
 */
export type ConversationAttributesNotSaved = {
  mentionedUs: boolean;
  unreadCount: number;
};

export type ConversationAttributesWithNotSavedOnes = ConversationAttributes &
  ConversationAttributesNotSaved;

export interface ConversationAttributes {
  id: string;
  type: ConversationTypeEnum.PRIVATE | ConversationTypeEnum.GROUPV2 | ConversationTypeEnum.GROUP;

  // 0 means inactive (undefined and null too but we try to get rid of them and only have 0 = inactive)
  active_at: number; // this field is the one used to sort conversations in the left pane from most recent

  /**
   * lastMessage is actually just a preview of the last message text, shortened to 60 chars.
   * This is to avoid filling the redux store with a huge last message when it's only used in the
   * preview of a conversation (left pane).
   * The shortening is made in sql.ts directly.
   */
  lastMessage: string | null;
  lastMessageStatus: LastMessageStatusType;
  lastMessageInteractionType: ConversationInteractionType | null;
  lastMessageInteractionStatus: ConversationInteractionStatus | null;

  left: boolean; // legacy & groupv2, should eventually be removed to rely on libsession value directly

  /**
   * We now require all avatars stored on desktop to have in additions of their normal avatars
   * a static version of it. Static as in not-animated.
   * So:
   * - if the avatarPath points to a file that is animated, staticAvatarPath must point to file containing its first frame,
   * - if the avatarPath points to a file that is not animated, staticAvatarPath is the same as avatarPath
   *
   * avatarInProfile is the avatar as the user set it, once downloaded and stored in the application attachments folder.
   *
   * Note: if the user is Pro, but didn't set an animated avatar, `avatarInProfile` and `fallbackAvatarInProfile` will point to the same file
   */
  avatarInProfile?: string;
  /**
   * This is the always static version of the avatar in profile.
   * If the user has pro, avatarInProfile will be used (and so his avatar will be animated if it was already).
   * If the user doesn't have pro, fallbackAvatarInProfile will be used, and the avatar will be displayed as a static image.
   *
   * Note: if the user is Pro, but didn't set an animated avatar, `avatarInProfile` and `fallbackAvatarInProfile` will point to the same file
   */
  fallbackAvatarInProfile?: string;

  isTrustedForAttachmentDownload: boolean; // not synced across devices, this field is used if we should auto download attachments from this conversation or not

  conversationIdOrigin?: string; // The conversation from which this conversation originated from: blinded message request or 03-group admin who invited us

  // TODOLATER those two items are only used for legacy closed groups and will be removed when we get rid of the legacy closed groups support
  lastJoinedTimestamp: number; // GroupV2: last time we were added to this group, should eventually be removed to rely on libsession value directly

  // ===========================================================================
  // All of the items below are duplicated one way or the other with libsession.
  // It would be nice to at some point be able to only rely on libsession dumps
  // for those so there is no need to keep them in sync, but just have them in the dumps.
  // Note: If we do remove them, we also need to add some logic to the wrappers. For instance, we can currently search by nickname or display name and that works through the DB.

  displayNameInProfile?: string; // no matter the type of conversation, this is the real name as set by the user/name of the open or closed group
  nickname?: string; // this is the name WE gave to that user (only applicable to private chats, not closed group neither opengroups)
  profileKey?: string; // If set, this is a hex string.

  /**
   * This is the url of the avatar on the file server v2 or sogs server.
   * We use this to detect if we need to re-download the avatar from someone/ a community.
   */
  avatarPointer?: string;
  /**
   * This is the timestamp of the last time the profile of that user was updated.
   * Only used for private chats (or blinded), but not for groups avatars nor communities.
   * An incoming avatarPointer & profileKey will only be applied if the provided
   * profileUpdatedSeconds is more recent than the currently stored one.
   */
  profileUpdatedSeconds?: number;
  triggerNotificationsFor: ConversationNotificationSettingType;
  /** in seconds, 0 means no expiration */
  expireTimer: number;

  /**
   * Members of 03-groups and legacy groups until we remove them entirely (not used for communities)
   */
  members: Array<string>;
  /**
   * For sogs and closed group: the unique admins of that group
   */
  groupAdmins: Array<string>;

  /**
   * -1 = hidden (contact and NTS only), 0 = normal, 1 = pinned
   */
  priority: number;

  isApproved: boolean; // if we sent a message request or sent a message to this contact, we approve them. If isApproved & didApproveMe, a message request becomes a contact
  didApproveMe: boolean; // if our message request was approved already (or they've sent us a message request/message themselves). If isApproved & didApproveMe, a message request becomes a contact

  markedAsUnread: boolean; // Force the conversation as unread even if all the messages are read. Used to highlight a conversation the user wants to check again later, synced.

  blocksSogsMsgReqsTimestamp: number; // if the convo is blinded and the user has denied contact through sogs, this field be set to the user's latest message timestamp

  /** disappearing messages setting for this conversation */
  expirationMode: DisappearingMessageConversationModeType;

  /**
   * An 03-group is expired if an admin didn't come online for the last 30 days.
   * In that case, we might not have any keys on the swarm, and so restoring from seed would mean we can't actually
   * send any messages/nor decrypt any.
   */
  isExpired03Group?: boolean;
}

/**
 * This function mutates optAttributes
 * @param optAttributes the entry object attributes to set the defaults to.
 *
 * Test are in ConversationModels_test.ts
 */
export const fillConvoAttributesWithDefaults = (
  optAttributes: ConversationAttributes
): ConversationAttributes => {
  return defaults(optAttributes, {
    members: [],
    groupAdmins: [],

    lastJoinedTimestamp: 0,
    expirationMode: 'off',
    expireTimer: 0,

    active_at: 0,

    lastMessage: null,
    lastMessageStatus: undefined,
    lastMessageInteractionType: null,
    lastMessageInteractionStatus: null,

    triggerNotificationsFor: 'all', // if the settings is not set in the db, this is the default

    isTrustedForAttachmentDownload: false, // we don't trust a contact until we say so
    isApproved: false,
    didApproveMe: false,
    left: false,
    priority: CONVERSATION_PRIORITIES.default,
    markedAsUnread: false,
    blocksSogsMsgReqsTimestamp: 0,
  });
};

export const READ_MESSAGE_STATE = {
  unread: 1,
  read: 0,
} as const;

export enum ConvoTypeNarrow {
  /**
   * Our own conversation.
   * Those details needs to be stored in libsession's nts config (UserProfile).
   */
  nts = 'nts',
  /**
   * A blinded acquaintance is a user we are **not** chatting to directly (i.e. not approved nor didApproveMe),
   * but they are blinded.
   * This could be any user of a blinded community to which we have not sent a message request, and they did not either.
   * Those are not saved in libsession currently.
   */
  blindedAcquaintance = 'blindedAcquaintance',
  /**
   * A blinded contact is a user we have sent a message request through a blinded community.
   * Those are not saved in libsession currently, but libsession could store them for us.
   */
  blindedContact = 'blindedContact',
  /**
   * A non-blinded user we have not directly talk to, but through a group/(unblinded) community only.
   * They could just be members of a group we are part of.
   * Those are not saved in libsession's contact, but as group members in MetaGroup if we know them through a group.
   * If we know them through a community, they are not saved in libsession at all currently..
   */
  privateAcquaintance = 'privateAcquaintance',
  /**
   * This is a contact that we have approved, or they sent us a message request.
   * We could be friends with them, if both flags are true.
   * This contact must be stored in the contacts config.
   */
  contact = 'contact',
  /**
   * This conversation is a community. It must be stored in the libsession's community config.
   */
  community = 'community',
  /**
   * Those are legacy groups. i.e. private groups that start with 05.
   */
  legacyGroup = 'legacyGroup',
  /**
   * Those are 03-groups. i.e. private groups that start with 03.
   */
  group = 'group',
}
