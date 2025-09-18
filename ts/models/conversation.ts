import autoBind from 'auto-bind';
import { from_hex, to_hex } from 'libsodium-wrappers-sumo';
import {
  debounce,
  includes,
  isArray,
  isEmpty,
  isEqual,
  isFinite,
  isNil,
  isNumber,
  isString,
  sortBy,
  throttle,
  uniq,
  xor,
} from 'lodash';

import { DisappearingMessageConversationModeType } from 'libsession_util_nodejs';
import { v4 } from 'uuid';
import { SignalService } from '../protobuf';
import { ConvoHub } from '../session/conversations';
import { ClosedGroupV2VisibleMessage } from '../session/messages/outgoing/visibleMessage/ClosedGroupVisibleMessage';
import { PubKey } from '../session/types';
import { ToastUtils, UserUtils } from '../session/utils';
import { BlockedNumberController } from '../util';
import { MessageModel } from './message';
import { MessageAttributesOptionals, type MessageAttributes } from './messageType';

import { Data } from '../data/data';
import { OpenGroupUtils } from '../session/apis/open_group_api/utils';
import { getOpenGroupV2FromConversationId } from '../session/apis/open_group_api/utils/OpenGroupUtils';
import { ExpirationTimerUpdateMessage } from '../session/messages/outgoing/controlMessage/ExpirationTimerUpdateMessage';
import { TypingMessage } from '../session/messages/outgoing/controlMessage/TypingMessage';
import { CommunityInvitationMessage } from '../session/messages/outgoing/visibleMessage/CommunityInvitationMessage';
import { OpenGroupVisibleMessage } from '../session/messages/outgoing/visibleMessage/OpenGroupVisibleMessage';
import {
  VisibleMessage,
  VisibleMessageParams,
} from '../session/messages/outgoing/visibleMessage/VisibleMessage';
import { perfEnd, perfStart } from '../session/utils/Performance';
import { ed25519Str } from '../session/utils/String';
import { createTaskWithTimeout } from '../session/utils/TaskWithTimeout';
import {
  actions as conversationActions,
  conversationsChanged,
  markConversationFullyRead,
  messagesDeleted,
  ReduxConversationType,
} from '../state/ducks/conversations';

import {
  ReplyingToMessageProps,
  SendMessageType,
} from '../components/conversation/composition/CompositionBox';
import { OpenGroupData } from '../data/opengroups';
import { SettingsKey } from '../data/settings-key';
import {
  findCachedOurBlindedPubkeyOrLookItUp,
  getUsBlindedInThatServer,
  isUsAnySogsFromCache,
} from '../session/apis/open_group_api/sogsv3/knownBlindedkeys';
import { SogsBlinding } from '../session/apis/open_group_api/sogsv3/sogsBlinding';
import {
  fileDetailsToURL,
  sogsV3FetchPreviewAndSaveIt,
} from '../session/apis/open_group_api/sogsv3/sogsV3FetchFile';
import { SnodeNamespaces } from '../session/apis/snode_api/namespaces';
import { getSodiumRenderer } from '../session/crypto';
import { addMessagePadding } from '../session/crypto/BufferPadding';
import { DecryptedAttachmentsManager } from '../session/crypto/DecryptedAttachmentsManager';
import {
  MessageRequestResponse,
  MessageRequestResponseParams,
} from '../session/messages/outgoing/controlMessage/MessageRequestResponse';
import { SessionUtilContact } from '../session/utils/libsession/libsession_utils_contacts';
import { SessionUtilConvoInfoVolatile } from '../session/utils/libsession/libsession_utils_convo_info_volatile';
import { SessionUtilUserGroups } from '../session/utils/libsession/libsession_utils_user_groups';
import {
  deleteExternalFilesOfConversation,
  getAbsoluteAttachmentPath,
  loadAttachmentData,
} from '../types/MessageAttachment';
import { IMAGE_JPEG } from '../types/MIME';
import { Reaction } from '../types/Reaction';
import {
  assertUnreachable,
  roomHasBlindEnabled,
  roomHasReactionsEnabled,
  SaveConversationReturn,
} from '../types/sqlSharedTypes';
import { Notifications } from '../util/notifications';
import { Reactions } from '../util/reactions';
import { Storage } from '../util/storage';
import {
  ConversationAttributes,
  ConversationNotificationSetting,
  ConvoTypeNarrow,
  fillConvoAttributesWithDefaults,
  isDirectConversation,
  isOpenOrClosedGroup,
  READ_MESSAGE_STATE,
  type ConversationNotificationSettingType,
  type WithAvatarPathAndFallback,
  type WithAvatarPointer,
  type WithAvatarPointerProfileKey,
  type WithProfileKey,
  type WithProfileUpdatedAtSeconds,
} from './conversationAttributes';

import { ReadReceiptMessage } from '../session/messages/outgoing/controlMessage/receipt/ReadReceiptMessage';
import { PreConditionFailed } from '../session/utils/errors';
import { LibSessionUtil } from '../session/utils/libsession/libsession_utils';
import { ReduxSogsRoomInfos } from '../state/ducks/sogsRoomInfo';
import {
  selectLibGroupAdminsOutsideRedux,
  selectLibGroupMembersOutsideRedux,
  selectLibGroupNameOutsideRedux,
} from '../state/selectors/groups';
import {
  getCanWriteOutsideRedux,
  getModeratorsOutsideRedux,
  getRoomDescriptionOutsideRedux,
  getSubscriberCountOutsideRedux,
} from '../state/selectors/sogsRoomInfo'; // decide it it makes sense to move this to a redux slice?

import { handleAcceptConversationRequest } from '../interactions/conversationInteractions';
import { DisappearingMessages } from '../session/disappearing_messages';
import { GroupUpdateInfoChangeMessage } from '../session/messages/outgoing/controlMessage/group_v2/to_group/GroupUpdateInfoChangeMessage';
import { FetchMsgExpirySwarm } from '../session/utils/job_runners/jobs/FetchMsgExpirySwarmJob';
import { GroupSync } from '../session/utils/job_runners/jobs/GroupSyncJob';
import { UpdateMsgExpirySwarm } from '../session/utils/job_runners/jobs/UpdateMsgExpirySwarmJob';
import { getLibGroupKickedOutsideRedux } from '../state/selectors/userGroups';
import {
  MetaGroupWrapperActions,
  UserConfigWrapperActions,
  UserGroupsWrapperActions,
} from '../webworker/workers/browser/libsession_worker_interface';
import { markAttributesAsReadIfNeeded } from './messageFactory';
import { StoreGroupRequestFactory } from '../session/apis/snode_api/factories/StoreGroupRequestFactory';
import { OpenGroupRequestCommonType } from '../data/types';
import { ConversationTypeEnum, CONVERSATION_PRIORITIES } from './types';
import { NetworkTime } from '../util/NetworkTime';
import { MessageQueue } from '../session/sending';
import type { WithMessageHashOrNull } from '../session/types/with';
import { Model } from './models';
import LIBSESSION_CONSTANTS from '../session/utils/libsession/libsession_constants';
import { ReduxOnionSelectors } from '../state/selectors/onions';
import { tr, tStripped } from '../localization/localeTools';
import { getFeatureFlag } from '../state/ducks/types/releasedFeaturesReduxTypes';
import type {
  ConversationInteractionStatus,
  ConversationInteractionType,
} from '../interactions/types';
import type { LastMessageStatusType } from '../state/ducks/types';
import { OutgoingUserProfile } from '../types/message';
import { Timestamp } from '../types/timestamp/timestamp';

type InMemoryConvoInfos = {
  mentionedUs: boolean;
  unreadCount: number;
};

type WithSetSessionProfileType<
  T extends
    | 'displayNameChangeOnlyPrivate'
    | 'resetAvatarPrivate'
    | 'resetAvatarGroup'
    | 'resetAvatarCommunity'
    | 'setAvatarBeforeDownloadPrivate'
    | 'setAvatarBeforeDownloadGroup'
    | 'setAvatarDownloadedPrivate'
    | 'setAvatarDownloadedCommunity'
    | 'setAvatarDownloadedGroup',
> = {
  type: T;
};

type WithDisplayNameChange = { displayName?: string | null };

type SetSessionProfileDetails = WithDisplayNameChange &
  (
    | (WithSetSessionProfileType<'displayNameChangeOnlyPrivate'> & WithProfileUpdatedAtSeconds)
    | (WithSetSessionProfileType<'resetAvatarPrivate'> & WithProfileUpdatedAtSeconds)
    // no need for profileUpdatedAtSeconds for groups/communities
    | WithSetSessionProfileType<'resetAvatarGroup' | 'resetAvatarCommunity'>
    // Note: for communities, we set & download the avatar as a single step
    | (WithSetSessionProfileType<'setAvatarBeforeDownloadPrivate'> &
        WithProfileUpdatedAtSeconds &
        WithAvatarPointerProfileKey)
    // no need for profileUpdatedAtSeconds for groups
    | (WithSetSessionProfileType<'setAvatarBeforeDownloadGroup'> &
        WithProfileKey &
        WithAvatarPointer) // no need for profileUpdatedAtSeconds for groups
    // Note: for communities, we set & download the avatar as a single step
    | (WithSetSessionProfileType<'setAvatarDownloadedPrivate'> &
        WithAvatarPointerProfileKey &
        WithAvatarPathAndFallback)

    // no need for profileUpdatedAtSeconds for groups/communities
    | (WithSetSessionProfileType<'setAvatarDownloadedCommunity' | 'setAvatarDownloadedGroup'> &
        WithAvatarPointerProfileKey &
        WithAvatarPathAndFallback)
  );

type SetSessionProfileReturn = {
  nameChanged: boolean;
  avatarChanged: boolean;
  avatarNeedsDownload: boolean;
};

/**
 *
 * Type guard for the set profile action that is private.
 * We need to do some extra processing for private actions, as they have a updatedAtSeconds field.
 */
function isSetProfileWithUpdatedAtSeconds<T extends SetSessionProfileDetails>(
  action: T
): action is Extract<T, { profileUpdatedAtSeconds: number }> {
  return 'profileUpdatedAtSeconds' in action;
}

/**
 * Some fields are not stored in the database, but are kept in memory.
 * We use this map to keep track of them. The key is the conversation id.
 */
const inMemoryConvoInfos: Map<string, InMemoryConvoInfos> = new Map();

export class ConversationModel extends Model<ConversationAttributes> {
  public updateLastMessage: () => unknown; // unknown because it is a Promise that we do not want to await
  public throttledBumpTyping: () => void;
  public throttledNotify: (message: MessageModel) => void;
  public markConversationRead: (opts: {
    newestUnreadDate: number;
    fromConfigMessage?: boolean;
  }) => void;
  public initialPromise: Promise<ConversationModel | void>;

  private typingRefreshTimer?: NodeJS.Timeout | null;
  private typingPauseTimer?: NodeJS.Timeout | null;
  private typingTimer?: NodeJS.Timeout | null;

  private pending?: Promise<any>;

  constructor(attributes: ConversationAttributes) {
    super(fillConvoAttributesWithDefaults(attributes));

    // This may be overridden by ConvoHub.use().getOrCreate, and signify
    //   our first save to the database. Or first fetch from the database.
    this.initialPromise = Promise.resolve();
    autoBind(this);

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.throttledBumpTyping = throttle(this.bumpTyping, 300);
    this.updateLastMessage = throttle(this.bouncyUpdateLastMessage.bind(this), 1000, {
      trailing: true,
      leading: true,
    });

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.throttledNotify = debounce(this.notify, 2000, { maxWait: 2000, trailing: true });
    // start right away the function is called, and wait 1sec before calling it again
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.markConversationRead = debounce(this.markConversationReadBouncy, 1000, {
      leading: true,
      trailing: true,
    });

    this.typingRefreshTimer = null;
    this.typingPauseTimer = null;
    window.inboxStore?.dispatch(conversationsChanged([this.getConversationModelProps()]));
  }

  public idForLogging(): string {
    const type = this.get('type');
    switch (type) {
      case ConversationTypeEnum.PRIVATE:
        return this.id;
      case ConversationTypeEnum.GROUPV2:
        return `group(${ed25519Str(this.id)})`;
      case ConversationTypeEnum.GROUP: {
        if (this.isPublic()) {
          return this.id;
        }
        return `group(${ed25519Str(this.id)})`;
      }
      default:
        assertUnreachable(type, `idForLogging case not handled for type:"${type}"`);
    }
    return this.id;
  }

  public isMe() {
    return UserUtils.isUsFromCache(this.id);
  }

  /**
   * Same as this.isOpenGroupV2().
   *
   * // TODOLATER merge them together
   */
  public isPublic(): boolean {
    return this.isOpenGroupV2();
  }

  /**
   * Same as this.isPublic().
   *
   * // TODOLATER merge them together
   */
  public isOpenGroupV2(): boolean {
    return OpenGroupUtils.isOpenGroupV2(this.id);
  }

  public isClosedGroup(): boolean {
    return Boolean(
      (this.get('type') === ConversationTypeEnum.GROUP && PubKey.is05Pubkey(this.id)) ||
        this.isClosedGroupV2()
    );
  }

  private getConvoType(): ConvoTypeNarrow {
    if (this.isMe()) {
      return ConvoTypeNarrow.nts;
    }
    // a blinded contact we are not chatting to directly, but they are blinded
    if (this.isPrivateAndBlinded() && !this.isApproved() && !this.didApproveMe()) {
      return ConvoTypeNarrow.blindedAcquaintance;
    }
    if (this.isPrivateAndBlinded()) {
      return ConvoTypeNarrow.blindedContact;
    }
    if (this.isPrivate() && !this.isApproved() && !this.didApproveMe()) {
      // i.e. a user we have not directly talk to, but through a group/community only
      return ConvoTypeNarrow.privateAcquaintance;
    }
    if (this.isPrivate()) {
      return ConvoTypeNarrow.contact;
    }
    if (this.isPublic()) {
      return ConvoTypeNarrow.community;
    }
    if (this.isClosedGroup() && !this.isClosedGroupV2()) {
      return ConvoTypeNarrow.legacyGroup;
    }
    if (this.isClosedGroupV2()) {
      return ConvoTypeNarrow.group;
    }
    throw new Error(
      `getConvoType: can't determine the type of the conversation for ${ed25519Str(this.id)}`
    );
  }

  public isClosedGroupV2() {
    return Boolean(this.get('type') === ConversationTypeEnum.GROUPV2 && PubKey.is03Pubkey(this.id));
  }

  public isPrivate() {
    return isDirectConversation(this.get('type'));
  }

  public isPrivateAndBlinded() {
    return this.isPrivate() && PubKey.isBlinded(this.id);
  }

  /**
   * @returns true if this is a legacy, closed or community
   */
  public isGroup() {
    return isOpenOrClosedGroup(this.get('type'));
  }

  public isBlocked() {
    if (!this.id || this.isMe()) {
      return false;
    }

    if (this.isPrivate() || this.isClosedGroup()) {
      return BlockedNumberController.isBlocked(this.id);
    }

    return false;
  }

  /**
   * Returns true if this conversation is active.
   * i.e. the conversation is visible on the left pane. (Either we or another user created this convo).
   * An active conversation is a user/group we interacted with directly, or they did, at some point.
   * For instance, all of the conversations created when receiving a community are not active, until we start directly talking with them (or they do).
   */
  public isActive() {
    return Boolean(this.getActiveAt());
  }

  /**
   *
   * @returns true if this conversation is private and hidden.
   * A non-private conversation cannot be hidden currently.
   *  - a community is removed straight away when we leave it and not marked hidden
   *  - a legacy group is kept visible if we leave it, until we explicitly delete it. At that time, it is removed completely and not marked hidden
   */
  public isHidden() {
    const priority = this.getPriority();
    return this.isPrivate() && priority === CONVERSATION_PRIORITIES.hidden;
  }

  public async cleanup() {
    await deleteExternalFilesOfConversation(this.attributes);
  }

  public getPriority() {
    if (PubKey.is05Pubkey(this.id) && this.isPrivate()) {
      // TODO once we have a libsession state, we can make this used across the app without repeating as much
      // if a private chat, trust the value from the Libsession wrapper cached first
      const contact = SessionUtilContact.getContactCached(this.id);
      if (contact) {
        return contact.priority;
      }
    }
    return this.get('priority') || CONVERSATION_PRIORITIES.default;
  }

  public getNotificationsFor() {
    return this.get('triggerNotificationsFor');
  }

  public setNotificationsFor(notificationsFor: ConversationNotificationSettingType) {
    this.setKey('triggerNotificationsFor', notificationsFor);
  }

  public setLastJoinedTimestamp(timestamp: number) {
    if (timestamp === this.getLastJoinedTimestamp()) {
      return;
    }
    this.setKey('lastJoinedTimestamp', timestamp);
  }

  public setExpirationArgs({
    mode,
    expireTimer,
  }: {
    mode: DisappearingMessageConversationModeType;
    expireTimer: number | undefined;
  }) {
    if (mode === this.getExpirationMode() && expireTimer === this.getExpireTimer()) {
      return;
    }
    this.setKey('expirationMode', mode);
    this.setKey('expireTimer', expireTimer);
  }

  public setIsExpired03Group(isExpired: boolean) {
    if (!PubKey.is03Pubkey(this.id)) {
      throw new Error('setIsExpired03Group is only for 03 groups');
    }
    if (isExpired === this.getIsExpired03Group()) {
      return;
    }
    this.setKey('isExpired03Group', isExpired);
  }

  public getConversationModelProps(): ReduxConversationType {
    const isPrivate = this.isPrivate();
    const weAreAdmin = this.weAreAdminUnblinded();

    const currentNotificationSetting = this.getNotificationsFor();
    const priorityFromDb = this.getPriority();

    // To reduce the redux store size, only set fields which cannot be undefined.
    // For instance, a boolean can usually be not set if false, etc
    const toRet: ReduxConversationType = {
      id: this.id,
      activeAt: this.getActiveAt(),
      type: this.get('type'),
    };

    if (isFinite(priorityFromDb) && priorityFromDb !== CONVERSATION_PRIORITIES.default) {
      toRet.priority = priorityFromDb;
    }

    if (this.isMarkedUnread()) {
      toRet.isMarkedUnread = this.isMarkedUnread();
    }

    const blocksSogsMsgReqsTimestamp = this.get('blocksSogsMsgReqsTimestamp');
    if (blocksSogsMsgReqsTimestamp) {
      toRet.blocksSogsMsgReqsTimestamp = blocksSogsMsgReqsTimestamp;
    }

    if (isPrivate) {
      toRet.isPrivate = true;
      if (this.typingTimer) {
        toRet.isTyping = true;
      }
      if (this.isMe()) {
        toRet.isMe = true;
      }

      const foundContact = SessionUtilContact.getContactCached(this.id);

      if (!toRet.activeAt && foundContact && isFinite(foundContact.createdAtSeconds)) {
        toRet.activeAt = foundContact.createdAtSeconds * 1000; // active at is in ms
      }
    }

    if (weAreAdmin) {
      toRet.weAreAdmin = true;
    }

    if (this.isPublic()) {
      toRet.isPublic = true;
    }

    const proOrNotAvatarPath = this.getProOrNotAvatarPath();

    if (proOrNotAvatarPath) {
      toRet.avatarPath = proOrNotAvatarPath;
    }

    if (this.getExpirationMode()) {
      toRet.expirationMode = this.getExpirationMode();
    }

    if (this.getIsExpired03Group()) {
      toRet.isExpired03Group = true;
    }

    if (
      currentNotificationSetting &&
      currentNotificationSetting !== ConversationNotificationSetting[0]
    ) {
      toRet.currentNotificationSetting = currentNotificationSetting;
    }

    if (this.getRealSessionUsername()) {
      toRet.displayNameInProfile = this.getRealSessionUsername();
    }
    if (this.getNickname()) {
      toRet.nickname = this.getNickname();
    }
    if (BlockedNumberController.isBlocked(this.id)) {
      toRet.isBlocked = true;
    }
    if (this.didApproveMe()) {
      toRet.didApproveMe = this.didApproveMe();
    }
    if (this.isApproved()) {
      toRet.isApproved = this.isApproved();
    }
    if (this.getExpireTimer()) {
      toRet.expireTimer = this.getExpireTimer();
    }
    if (this.isProUser()) {
      toRet.isProUser = true;
    }
    // those are values coming only from both the DB or the wrapper. Currently we display the data from the DB
    if (this.isClosedGroup()) {
      toRet.members = this.getGroupMembers() || [];
    }

    // those are values coming only from both the DB or the wrapper. Currently we display the data from the DB
    if (this.isClosedGroup() || this.isPublic()) {
      // for public, this value always comes from the DB
      toRet.groupAdmins = this.getGroupAdmins();
    }

    if (this.isClosedGroupV2() || this.isPrivateAndBlinded()) {
      toRet.conversationIdOrigin = this.getConversationIdOrigin();
    }
    if (this.isClosedGroup()) {
      // those are values coming only from the DB when this is a closed group
      if (this.isKickedFromGroup()) {
        toRet.isKickedFromGroup = this.isKickedFromGroup();
      }
    }

    // -- Handle the field stored only in memory for all types of conversation--
    const inMemoryConvoInfo = inMemoryConvoInfos.get(this.id);
    if (inMemoryConvoInfo) {
      if (inMemoryConvoInfo.unreadCount) {
        toRet.unreadCount = inMemoryConvoInfo.unreadCount;
      }
      if (inMemoryConvoInfo.mentionedUs) {
        toRet.mentionedUs = inMemoryConvoInfo.mentionedUs;
      }
    }

    // -- Handle the last message status, if present --
    const lastMessageInteractionType = this.get('lastMessageInteractionType');
    const lastMessageInteractionStatus = this.get('lastMessageInteractionStatus');
    const lastMessageText = this.get('lastMessage');
    if (lastMessageText && lastMessageText.length) {
      const lastMessageStatus = this.get('lastMessageStatus');

      toRet.lastMessage = {
        status: lastMessageStatus,
        text: lastMessageText,
        interactionType: lastMessageInteractionType,
        interactionStatus: lastMessageInteractionStatus,
      };
    } else if (lastMessageInteractionType && lastMessageInteractionStatus) {
      // if there is no last message, we still want to display the interaction status

      toRet.lastMessage = {
        text: '',
        status: 'sent',
        interactionType: lastMessageInteractionType,
        interactionStatus: lastMessageInteractionStatus,
      };
    }

    return toRet;
  }

  /**
   *
   * @param groupAdmins the Array of group admins, where, if we are a group admin, we are present unblinded.
   * @param shouldCommit set this to true to auto commit changes
   * @returns true if the groupAdmins where not the same (and thus updated)
   */
  public async updateGroupAdmins(groupAdmins: Array<string>, shouldCommit: boolean) {
    const sortedNewAdmins = uniq(sortBy(groupAdmins));

    // check if there is any difference between the two, if yes, override it with what we got.
    if (!xor(this.getGroupAdmins(), groupAdmins).length) {
      return false;
    }
    this.set({ groupAdmins: sortedNewAdmins });
    if (shouldCommit) {
      await this.commit();
    }
    return true;
  }

  /**
   * Fetches from the Database an update of what are the memory only information like mentionedUs and the unreadCount, etc
   */
  public async refreshInMemoryDetails(providedMemoryDetails?: SaveConversationReturn) {
    if (!SessionUtilConvoInfoVolatile.isConvoToStoreInWrapper(this)) {
      return;
    }
    const memoryDetails = providedMemoryDetails || (await Data.fetchConvoMemoryDetails(this.id));

    if (!memoryDetails) {
      inMemoryConvoInfos.delete(this.id);
      return;
    }
    if (!inMemoryConvoInfos.get(this.id)) {
      inMemoryConvoInfos.set(this.id, {
        mentionedUs: false,
        unreadCount: 0,
      });
    }

    const existing = inMemoryConvoInfos.get(this.id);
    if (!existing) {
      return;
    }
    let changes = false;
    if (existing.unreadCount !== memoryDetails.unreadCount) {
      existing.unreadCount = memoryDetails.unreadCount;
      changes = true;
    }

    if (existing.mentionedUs !== memoryDetails.mentionedUs) {
      existing.mentionedUs = memoryDetails.mentionedUs;
      changes = true;
    }

    if (changes) {
      this.triggerUIRefresh();
    }
  }

  public async queueJob(callback: () => Promise<void>) {
    const previous = this.pending || Promise.resolve();

    const taskWithTimeout = createTaskWithTimeout(callback, `conversation ${this.idForLogging()}`);

    // eslint-disable-next-line more/no-then
    this.pending = previous.then(taskWithTimeout, taskWithTimeout);
    const current = this.pending;
    // eslint-disable-next-line more/no-then
    void current.then(() => {
      if (this.pending === current) {
        delete this.pending;
      }
    });

    return current;
  }

  public async makeQuote(quotedMessage: MessageModel): Promise<ReplyingToMessageProps | null> {
    const attachments = quotedMessage.get('attachments');
    const preview = quotedMessage.get('preview');

    const body = quotedMessage.get('body');
    const quotedAttachments = await this.getQuoteAttachment(attachments, preview);

    if (!quotedMessage.get('sent_at')) {
      window.log.warn('tried to make a quote without a sent_at timestamp');
      return null;
    }
    let msgSource = quotedMessage.getSource();
    if (this.isPublic()) {
      const room = OpenGroupData.getV2OpenGroupRoom(this.id);
      if (room && roomHasBlindEnabled(room) && msgSource === UserUtils.getOurPubKeyStrFromCache()) {
        // this room should send message with blinded pubkey, so we need to make the quote with them too.
        // when we make a quote to ourself on a blind sogs, that message has a sender being our naked pubkey
        const sodium = await getSodiumRenderer();
        msgSource = await findCachedOurBlindedPubkeyOrLookItUp(room.serverPublicKey, sodium);
      }
    }

    return {
      author: msgSource,
      id: `${quotedMessage.get('sent_at')}` || '',
      // NOTE we send the entire body to be consistent with the other platforms
      text: body,
      attachments: quotedAttachments,
      timestamp: quotedMessage.get('sent_at') || 0,
      convoId: this.id,
    };
  }

  public toOpenGroupV2(): OpenGroupRequestCommonType {
    if (!this.isOpenGroupV2()) {
      throw new Error('tried to run toOpenGroup for not public group v2');
    }
    return getOpenGroupV2FromConversationId(this.id);
  }

  public async sendReactionJob(sourceMessage: MessageModel, reaction: Reaction) {
    try {
      const destination = this.id;

      const sentAt = sourceMessage.get('sent_at');
      if (!sentAt) {
        throw new Error('sendReactMessageJob() sent_at must be set.');
      }
      const expireTimer = this.getExpireTimer();
      const expirationType = DisappearingMessages.changeToDisappearingMessageType(
        this,
        expireTimer,
        this.getExpirationMode()
      );
      const chatMessageParams: VisibleMessageParams = {
        body: '',
        // we need to use a new timestamp here, otherwise android&iOS will consider this message as a duplicate and drop the synced reaction
        createAtNetworkTimestamp: NetworkTime.now(),
        reaction,
        userProfile: await UserUtils.getOurProfile(),
        expirationType,
        expireTimer,
      };

      if (PubKey.isBlinded(this.id)) {
        window.log.info('Sending a blinded message react to this user: ', this.id);
        await this.sendBlindedMessageRequest(chatMessageParams);
        return;
      }

      // handleAcceptConversationRequest will take care of sending response depending on the type of conversation, if needed
      await handleAcceptConversationRequest({
        convoId: this.id,
        approvalMessageTimestamp: NetworkTime.now() - 100,
      });

      if (this.isOpenGroupV2()) {
        // communities have no expiration timer support, so enforce it here.
        chatMessageParams.expirationType = 'unknown';
        chatMessageParams.expireTimer = 0;

        const chatMessageOpenGroupV2 = new OpenGroupVisibleMessage(chatMessageParams);
        const roomInfos = this.toOpenGroupV2();
        if (!roomInfos) {
          throw new Error('Could not find this room in db');
        }
        const openGroup = OpenGroupData.getV2OpenGroupRoom(this.id);
        const blinded = Boolean(roomHasBlindEnabled(openGroup));

        // send with blinding if we need to
        await MessageQueue.use().sendToOpenGroupV2({
          message: chatMessageOpenGroupV2,
          roomInfos,
          blinded,
          filesToLink: [],
        });
        return;
      }

      const destinationPubkey = new PubKey(destination);

      if (this.isPrivate()) {
        const chatMessageMe = new VisibleMessage({
          ...chatMessageParams,
          syncTarget: this.id,
        });
        await MessageQueue.use().sendSyncMessage({
          namespace: SnodeNamespaces.Default,
          message: chatMessageMe,
        });

        const chatMessagePrivate = new VisibleMessage(chatMessageParams);

        await MessageQueue.use().sendToPubKey(
          destinationPubkey,
          chatMessagePrivate,
          SnodeNamespaces.Default
        );
        await Reactions.handleMessageReaction({
          reaction,
          sender: UserUtils.getOurPubKeyStrFromCache(),
          you: true,
        });
        return;
      }

      if (this.isClosedGroupV2()) {
        // we need the return await so that errors are caught in the catch {}
        await this.sendMessageToGroupV2(chatMessageParams);
        await Reactions.handleMessageReaction({
          reaction,
          sender: UserUtils.getOurPubKeyStrFromCache(),
          you: true,
        });
        return;
      }

      if (this.isClosedGroup()) {
        // legacy groups are readonly
        return;
      }

      throw new TypeError(`Invalid conversation type: '${this.get('type')}'`);
    } catch (e) {
      window.log.error(`Reaction job failed id:${reaction.id} error:`, e);
    }
  }

  /**
   * Does this conversation contain the properties to be considered a message request
   */
  public isIncomingRequest(): boolean {
    const id = this.id;
    const invitePending = PubKey.is03Pubkey(id)
      ? UserGroupsWrapperActions.getCachedGroup(id)?.invitePending || false
      : false;
    return hasValidIncomingRequestValues({
      id,
      isMe: this.isMe(),
      isApproved: this.isApproved(),
      isBlocked: this.isBlocked(),
      isPrivate: this.isPrivate(),
      activeAt: this.getActiveAt(),
      didApproveMe: this.didApproveMe(),
      invitePending,
      priority: this.getPriority(),
    });
  }

  /**
   * Is this conversation an outgoing message request
   */
  public isOutgoingRequest(): boolean {
    return hasValidOutgoingRequestValues({
      isMe: this.isMe() || false,
      isApproved: this.isApproved() || false,
      didApproveMe: this.didApproveMe() || false,
      isBlocked: this.isBlocked() || false,
      isPrivate: this.isPrivate() || false,
      activeAt: this.getActiveAt() || 0,
    });
  }

  /**
   * When you have accepted another users message request
   * Note: you shouldn't need to use this directly. Instead use `handleAcceptConversationRequest()`
   */
  public async addOutgoingApprovalMessage(timestamp: number) {
    await this.addSingleOutgoingMessage({
      sent_at: timestamp,
      messageRequestResponse: {},
      expireTimer: 0,
    });

    this.updateLastMessage();
  }

  /**
   * When the other user has accepted your message request
   * @param timestamp For determining message order in conversation
   * @param source For determining the conversation name used in the message.
   */
  public async addIncomingApprovalMessage(timestamp: number, source: string) {
    await this.addSingleIncomingMessage({
      sent_at: timestamp,
      source,
      messageRequestResponse: {},
      unread: READ_MESSAGE_STATE.unread, // 1 means unread
      expireTimer: 0,
    });
    this.updateLastMessage();
  }

  /**
   * Sends an accepted message request response to a private chat
   * Currently, we never send anything for denied message requests.
   * Note: you shouldn't need to use this directly. Instead use `handleAcceptConversationRequest()`
   */
  public async sendMessageRequestResponse() {
    if (!this.isPrivate()) {
      return;
    }

    const messageRequestResponseParams: MessageRequestResponseParams = {
      createAtNetworkTimestamp: NetworkTime.now(),
      userProfile: await UserUtils.getOurProfile(),
    };

    const messageRequestResponse = new MessageRequestResponse(messageRequestResponseParams);
    const pubkeyForSending = new PubKey(this.id);
    window.log.info(`Sending message request accepted message to ${PubKey.shorten(this.id)}`);
    await MessageQueue.use()
      .sendToPubKey(pubkeyForSending, messageRequestResponse, SnodeNamespaces.Default)
      .catch(window?.log?.error);
  }

  private isProUser(): boolean {
    if (this.isPublic()) {
      // Note: communities are considered pro users (they can have animated avatars)
      // but this function is too generic to return true
      return false;
    }

    if (this.isClosedGroupV2()) {
      const admins = this.getGroupAdmins();
      return admins.some(m => {
        // the is05Pubkey is only here to make sure we never have a infinite recursion
        return PubKey.is05Pubkey(m) && ConvoHub.use().get(m)?.isProUser();
      });
    }

    if (this.isMe()) {
      return getFeatureFlag('mockCurrentUserHasPro');
    }

    return getFeatureFlag('mockOthersHavePro');
  }

  public async sendMessage(msg: SendMessageType) {
    const { attachments, body, groupInvitation, preview, quote } = msg;
    this.clearTypingTimers();
    const networkTimestamp = NetworkTime.now();

    window?.log?.info(
      'Sending message to conversation',
      this.idForLogging(),
      'with networkTimestamp: ',
      networkTimestamp
    );

    const attachmentsWithVoiceMessage = attachments
      ? attachments.map(attachment => {
          if (attachment.isVoiceMessage) {
            return { ...attachment, flags: SignalService.AttachmentPointer.Flags.VOICE_MESSAGE };
          }
          return attachment;
        })
      : undefined;

    const messageModel = await this.addSingleOutgoingMessage({
      body,
      quote: isEmpty(quote) ? undefined : quote,
      preview,
      attachments: attachmentsWithVoiceMessage,
      sent_at: networkTimestamp, // overridden later, but we need one to have the sorting done in the UI even when the sending is pending
      expirationType: DisappearingMessages.changeToDisappearingMessageType(
        this,
        this.getExpireTimer(),
        this.getExpirationMode()
      ),
      expireTimer: this.getExpireTimer(),
      serverTimestamp: this.isPublic() ? networkTimestamp : undefined,
      groupInvitation,
    });

    // We're offline!
    if (!ReduxOnionSelectors.isOnlineOutsideRedux()) {
      const error = new Error('Network is not available');
      error.name = 'SendMessageNetworkError';
      (error as any).number = this.id;
      await messageModel.saveErrors(error);
      await this.commit();

      return;
    }

    this.setLastMessage(messageModel.getNotificationText());
    this.setLastMessageStatus('sending');
    this.setActiveAt(networkTimestamp);

    const interactionNotification = messageModel.getInteractionNotification();

    if (interactionNotification) {
      this.setLastMessageInteraction({
        type: interactionNotification?.interactionType,
        status: interactionNotification?.interactionStatus,
      });
    }

    await this.commit();

    void this.queueJob(async () => {
      await this.sendMessageJob(messageModel);
    });
  }

  public async sendReaction(sourceId: string, reaction: Reaction) {
    const sourceMessage = await Data.getMessageById(sourceId);

    if (!sourceMessage) {
      return;
    }

    void this.queueJob(async () => {
      await this.sendReactionJob(sourceMessage, reaction);
    });
  }

  /**
   * Updates the disappearing message settings for this conversation and sends an ExpirationTimerUpdate message if required
   * @param providedDisappearingMode
   * @param providedExpireTimer
   * @param providedSource the pubkey of the user who made the change
   * @param sentAt the timestamp of when the change was sent (when receiving it)
   * @param fromSync if the change was made from a sync message
   * @param shouldCommitConvo if the conversation change should be committed to the DB
   * @param shouldCommitMessage if the timer update message change should be committed to the DB
   * @param existingMessage if we have an existing message model to update
   * @returns true, if the change was made or false if it was ignored
   */
  public async updateExpireTimer({
    providedDisappearingMode,
    providedExpireTimer,
    providedSource,
    sentAt, // is set if it comes from outside
    fromSync, // if the update comes from sync message ONLY
    fromConfigMessage, // if the update comes from a libsession config message ONLY
    fromCurrentDevice,
    shouldCommitConvo = true,
    existingMessage,
    messageHash,
  }: WithMessageHashOrNull & {
    providedDisappearingMode?: DisappearingMessageConversationModeType;
    providedExpireTimer?: number;
    providedSource?: string;
    sentAt?: number; // is set if it comes from outside
    fromSync: boolean;
    fromCurrentDevice: boolean;
    fromConfigMessage: boolean;
    shouldCommitConvo?: boolean;
    existingMessage?: MessageModel;
  }): Promise<boolean> {
    const isRemoteChange = Boolean((sentAt || fromSync || fromConfigMessage) && !fromCurrentDevice);

    // we don't add an update message when this comes from a config message, as we already have the SyncedMessage itself with the right timestamp to display
    if (!this.isClosedGroupV2() && !this.isPrivate()) {
      throw new Error(
        'updateExpireTimer() Disappearing messages are only supported in 03-groups and private chats'
      );
    }

    let expirationMode = providedDisappearingMode;
    let expireTimer = providedExpireTimer;
    const source = providedSource || UserUtils.getOurPubKeyStrFromCache();

    if (expirationMode === undefined || expireTimer === undefined) {
      expirationMode = 'off';
      expireTimer = 0;
    }
    const shouldAddExpireUpdateMsgPrivate = this.isPrivate() && !fromConfigMessage;
    const shouldAddExpireUpdateMsgGroupV2 = this.isClosedGroupV2() && !fromConfigMessage;

    const shouldAddExpireUpdateMessage =
      shouldAddExpireUpdateMsgPrivate || shouldAddExpireUpdateMsgGroupV2;

    // When we add a disappearing messages notification to the conversation, we want it
    // to be above the message that initiated that change, hence the subtraction.
    const createAtNetworkTimestamp = (sentAt || NetworkTime.now()) - 1;

    if (!this.isPrivate()) {
      this.setExpirationArgs({ expireTimer, mode: expirationMode });
    } else if (fromSync || fromCurrentDevice) {
      // this is a private chat and a change we made, set the setting to what was given, otherwise discard it
      this.setExpirationArgs({ expireTimer, mode: expirationMode });
    }

    const convoType = this.getConvoType();
    switch (convoType) {
      case ConvoTypeNarrow.blindedAcquaintance:
      case ConvoTypeNarrow.blindedContact:
      case ConvoTypeNarrow.privateAcquaintance:
      case ConvoTypeNarrow.community:
      case ConvoTypeNarrow.legacyGroup:
        // all of the above do not support expiration timer
        break;
      case ConvoTypeNarrow.nts:
        await UserConfigWrapperActions.setNoteToSelfExpiry(expireTimer);
        break;
      case ConvoTypeNarrow.contact:
      case ConvoTypeNarrow.group:
        // TODO add cases here for groups/contacts to handle the other cases
        break;
      default:
        assertUnreachable(convoType, `convoType ${convoType} is not supported`);
    }

    if (!shouldAddExpireUpdateMessage) {
      await Conversation.cleanUpExpireHistoryFromConvo(this.id, this.isPrivate());

      if (shouldCommitConvo) {
        // tell the UI this conversation was updated
        await this.commit();
      }
      return false;
    }

    let message = existingMessage || undefined;
    const expirationType = DisappearingMessages.changeToDisappearingMessageType(
      this,
      expireTimer,
      expirationMode
    );

    const commonAttributes = {
      flags: SignalService.DataMessage.Flags.EXPIRATION_TIMER_UPDATE,
      expirationTimerUpdate: {
        expirationType,
        expireTimer,
        source,
        fromSync,
      },
      messageHash: messageHash || undefined,
    };

    if (!message) {
      if (!sentAt) {
        // outgoing message
        message = await this.addSingleOutgoingMessage({
          ...commonAttributes,
          sent_at: createAtNetworkTimestamp,
        });
      } else {
        message = await this.addSingleIncomingMessage({
          ...commonAttributes,
          // Even though this isn't reflected to the user, we want to place the last seen indicator above it. We set it to 'unread' to trigger that placement.
          unread: READ_MESSAGE_STATE.unread,
          source,
          sent_at: createAtNetworkTimestamp,
          received_at: createAtNetworkTimestamp,
        });
      }
    }

    // Note: we agreed that a **legacy closed** group ControlMessage message does not expire.
    // Group v2 on the other hand, have expiring disappearing control message

    message.setExpirationType(
      this.isClosedGroup() && !this.isClosedGroupV2() ? 'unknown' : expirationType
    );
    message.setExpireTimer(this.isClosedGroup() && !this.isClosedGroupV2() ? 0 : expireTimer);

    if (!message.id) {
      message.setId(v4());
    }

    if (this.isActive()) {
      this.setActiveAt(createAtNetworkTimestamp);
    }

    if (shouldCommitConvo) {
      // tell the UI this conversation was updated
      await this.commit();
    }

    // if change was made remotely, don't send it to the contact/group
    if (isRemoteChange) {
      window.log.debug(
        `[updateExpireTimer] remote change, not sending message again. sentAt: ${sentAt} fromSync: ${fromSync} fromCurrentDevice: ${fromCurrentDevice} for ${ed25519Str(
          this.id
        )}`
      );

      if (!message.getExpirationStartTimestamp()) {
        // Note: we agreed that a closed group ControlMessage message does not expire.

        const canBeDeleteAfterSend =
          this.isMe() || !(this.isGroup() && !this.isClosedGroupV2() && message.isControlMessage());
        if (canBeDeleteAfterSend || expirationMode === 'deleteAfterSend') {
          message.setMessageExpirationStartTimestamp(
            DisappearingMessages.setExpirationStartTimestamp(
              expirationMode,
              message.get('sent_at'),
              'updateExpireTimer() remote change',
              message.id
            )
          );
        }
      }
      await message.commit();

      await Conversation.cleanUpExpireHistoryFromConvo(this.id, this.isPrivate());
      return true;
    }
    await message.commit();

    await Conversation.cleanUpExpireHistoryFromConvo(this.id, this.isPrivate());
    //
    // Below is the "sending the update to the conversation" part.
    // We would have returned if that message sending part was not needed
    //
    const expireUpdate = {
      identifier: message.id,
      createAtNetworkTimestamp,
      expirationType,
      expireTimer,
    };

    if (this.isMe()) {
      if (expireUpdate.expirationType === 'deleteAfterRead') {
        window.log.info('Note to Self messages cannot be delete after read!');
        return true;
      }

      const expirationTimerMessage = new ExpirationTimerUpdateMessage(expireUpdate);

      await message?.sendSyncMessageOnly(expirationTimerMessage);
      return true;
    }

    if (this.isPrivate()) {
      const expirationTimerMessage = new ExpirationTimerUpdateMessage(expireUpdate);

      const pubkey = new PubKey(this.id);
      await MessageQueue.use().sendToPubKey(
        pubkey,
        expirationTimerMessage,
        SnodeNamespaces.Default
      );
      return true;
    }

    if (this.isClosedGroup()) {
      if (this.isAdmin(UserUtils.getOurPubKeyStrFromCache())) {
        if (this.isClosedGroupV2()) {
          if (!PubKey.is03Pubkey(this.id)) {
            throw new Error('updateExpireTimer v2 group requires a 03 key');
          }
          const group = await UserGroupsWrapperActions.getGroup(this.id);
          if (!group || !group.secretKey) {
            throw new Error(
              'trying to change timer for a group we do not have the secretKey is not possible'
            );
          }
          const info = await MetaGroupWrapperActions.infoGet(this.id);
          info.expirySeconds = expireUpdate.expireTimer;
          await MetaGroupWrapperActions.infoSet(this.id, info);
          const v2groupMessage = new GroupUpdateInfoChangeMessage({
            typeOfChange: SignalService.GroupUpdateInfoChangeMessage.Type.DISAPPEARING_MESSAGES,
            ...expireUpdate,
            groupPk: this.id,
            identifier: message.id,
            sodium: await getSodiumRenderer(),
            secretKey: group.secretKey,
            updatedExpirationSeconds: expireUpdate.expireTimer,
            userProfile: null,
          });

          const extraStoreRequests = await StoreGroupRequestFactory.makeGroupMessageSubRequest(
            [v2groupMessage],
            group
          );

          await GroupSync.pushChangesToGroupSwarmIfNeeded({
            groupPk: this.id,
            extraStoreRequests,
            allow401s: false,
          });

          await GroupSync.queueNewJobIfNeeded(this.id);
          return true;
        }

        // legacy groups are readonly. Nothing to do

        return true;
      }
      window.log.warn(
        'tried to send a disappear update but we are not the creator of that legacy group... Cancelling'
      );
      return false;
    }
    throw new Error('Communities should not use disappearing messages');
  }

  public triggerUIRefresh() {
    updatesToDispatch.set(this.id, this.getConversationModelProps());
    throttledAllConversationsDispatch();
  }

  public async commit() {
    perfStart(`conversationCommit-${this.id}`);
    await Convo.commitConversationAndRefreshWrapper(this.id);
    perfEnd(`conversationCommit-${this.id}`, 'conversationCommit');
  }

  public async addSingleOutgoingMessage(
    messageAttributes: Omit<
      MessageAttributesOptionals,
      'conversationId' | 'source' | 'type' | 'direction' | 'received_at' | 'unread'
    >
  ) {
    let sender: string = UserUtils.getOurPubKeyStrFromCache();
    if (this.isPublic()) {
      const openGroup = OpenGroupData.getV2OpenGroupRoom(this.id);
      if (openGroup && openGroup.serverPublicKey && roomHasBlindEnabled(openGroup)) {
        const signingKeys = await UserUtils.getUserED25519KeyPairBytes();

        if (!signingKeys) {
          throw new Error('addSingleOutgoingMessage: getUserED25519KeyPairBytes returned nothing');
        }

        const sodium = await getSodiumRenderer();

        const ourBlindedPubkeyForCurrentSogs = await findCachedOurBlindedPubkeyOrLookItUp(
          openGroup.serverPublicKey,
          sodium
        );

        if (ourBlindedPubkeyForCurrentSogs) {
          sender = ourBlindedPubkeyForCurrentSogs;
        }
      }
    }

    return this.addSingleMessage({
      ...messageAttributes,
      conversationId: this.id,
      source: sender,
      type: 'outgoing',
      direction: 'outgoing',
      unread: READ_MESSAGE_STATE.read, // an outgoing message must be already read
      received_at: messageAttributes.sent_at, // make sure to set a received_at timestamp for an outgoing message, so the order are right.
    });
  }

  public async addSingleIncomingMessage(
    messageAttributes: Omit<MessageAttributesOptionals, 'conversationId' | 'type' | 'direction'>
  ) {
    // if there's a message by the other user, they've replied to us which we consider an accepted convo
    if (this.isPrivate()) {
      await this.setDidApproveMe(true);
    }

    const toBeAddedAttributes: MessageAttributesOptionals = {
      unread: READ_MESSAGE_STATE.unread, // an incoming is by default unread, unless  messageAttributes or markAttributesAsReadIfNeeded marks it as read
      ...messageAttributes,
      conversationId: this.id,
      type: 'incoming',
      direction: 'incoming',
    };

    // if the message is trying to be added unread, make sure that it shouldn't be already read from our other devices
    markAttributesAsReadIfNeeded(toBeAddedAttributes);
    return this.addSingleMessage(toBeAddedAttributes);
  }

  /**
   * Mark everything as read efficiently if possible.
   *
   * For convos with a expiration timer enable, start the timer as of now.
   * Send read receipt if needed.
   */
  public async markAllAsRead() {
    /**
     *  when marking all as read, there is a bunch of things we need to do.
     *   - we need to update all the messages in the DB not read yet for that conversation
     *   - we need to send the read receipts if there is one needed for those messages
     *   - we need to trigger a change on the redux store, so those messages are read AND mark the whole convo as read.
     *   - we need to remove any notifications related to this conversation ID.
     *
     *
     * (if there is an expireTimer, we do it the slow way, handling each message separately)
     */
    const expireTimerSet = !!this.getExpireTimer();
    const isOpenGroup = this.isOpenGroupV2();

    if (isOpenGroup || !expireTimerSet) {
      // for opengroups, we batch everything as there is no expiration timer to take care of (and potentially a lot of messages)

      // if this is an opengroup there is no need to send read receipt, and so no need to fetch messages updated.
      const allReadMessagesIds = await Data.markAllAsReadByConversationNoExpiration(
        this.id,
        !isOpenGroup
      );

      await this.markAsUnread(false, false);
      await this.commit();
      if (allReadMessagesIds.length) {
        await this.sendReadReceiptsIfNeeded(uniq(allReadMessagesIds));
      }
      Notifications.clearByConversationID(this.id);
      window.inboxStore?.dispatch(markConversationFullyRead(this.id));

      return;
    }

    // otherwise, do it the slow and expensive way
    await this.markConversationReadBouncy({ newestUnreadDate: Date.now() });
  }

  public getUsInThatConversation() {
    const usInThatConversation =
      getUsBlindedInThatServer(this) || UserUtils.getOurPubKeyStrFromCache();
    return usInThatConversation;
  }

  public async sendReadReceiptsIfNeeded(timestamps: Array<number>) {
    if (!this.isPrivate() || !timestamps.length) {
      return;
    }
    const settingsReadReceiptEnabled = Storage.get(SettingsKey.settingsReadReceipt) || false;
    const sendReceipt =
      settingsReadReceiptEnabled && !this.isBlocked() && !this.isIncomingRequest();

    if (!sendReceipt) {
      return;
    }
    window?.log?.info(`Sending ${timestamps.length} read receipts.`);

    const receiptMessage = new ReadReceiptMessage({
      createAtNetworkTimestamp: NetworkTime.now(),
      timestamps,
    });

    const device = new PubKey(this.id);
    await MessageQueue.use().sendToPubKey(device, receiptMessage, SnodeNamespaces.Default);
  }

  public async setNickname(nickname: string | null, shouldCommit = false) {
    if (!this.isPrivate()) {
      window.log.info('cannot setNickname to a non private conversation.');
      return;
    }
    const trimmed = nickname && nickname.trim();
    const truncatedNickname = trimmed?.slice(0, LIBSESSION_CONSTANTS.CONTACT_MAX_NAME_LENGTH);

    if (this.get('nickname') === truncatedNickname) {
      return;
    }

    this.set({
      nickname: truncatedNickname || undefined,
      displayNameInProfile: this.getRealSessionUsername(),
    });

    if (shouldCommit) {
      await this.commit();
    }
  }

  private shouldApplyPrivateProfileUpdate<T extends SetSessionProfileDetails>(
    newProfile: SetSessionProfileDetails
  ): newProfile is Extract<T, { profileUpdatedAtSeconds: number }> {
    if (isSetProfileWithUpdatedAtSeconds(newProfile)) {
      // For the transition period, we need to allow an incoming profile to be applied when
      // the timestamp is not set (defaults to 0).
      if (newProfile.profileUpdatedAtSeconds === 0 && this.getProfileUpdatedSeconds() === 0) {
        window.log.debug(
          `shouldApplyPrivateProfileUpdate for ${ed25519Str(this.id)} incomingSeconds:0 currentSeconds:0. Allowing overwrite`
        );
        return true;
      }
      const ts = new Timestamp({ value: newProfile.profileUpdatedAtSeconds });
      window.log.debug(
        `shouldApplyPrivateProfileUpdate for ${ed25519Str(this.id)} incomingSeconds:${ts.seconds()} currentSeconds:${this.getProfileUpdatedSeconds()} -> ${this.getProfileUpdatedSeconds() < ts.seconds()}`
      );

      return this.getProfileUpdatedSeconds() < ts.seconds();
    }
    // for non private setProfile calls, we do not need to check the updatedAtSeconds
    return true;
  }

  /**
   * Updates this conversation with the provided displayName, avatarPath, staticAvatarPath and avatarPointer.
   * - displayName can be set to null to not update the display name.
   * - if any of the avatar fields is set, they all need to be set.
   *
   * This function does commit to the DB if any changes are detected.
   */
  public async setSessionProfile(
    newProfile: SetSessionProfileDetails
  ): Promise<SetSessionProfileReturn> {
    let nameChanged = false;

    const existingSessionName = this.getRealSessionUsername();
    if (
      this.shouldApplyPrivateProfileUpdate(newProfile) &&
      newProfile.displayName !== existingSessionName &&
      newProfile.displayName
    ) {
      this.set({
        displayNameInProfile: newProfile.displayName,
      });
      // name has changed, also apply the new profileUpdatedAtSeconds timestamp
      if (isSetProfileWithUpdatedAtSeconds(newProfile)) {
        this.set({ profileUpdatedSeconds: newProfile.profileUpdatedAtSeconds });
      }
      nameChanged = true;
    }
    const type = newProfile.type;

    switch (type) {
      case 'displayNameChangeOnlyPrivate': {
        if (nameChanged) {
          await this.commit();
        }
        return { nameChanged, avatarNeedsDownload: false, avatarChanged: false };
      }
      case 'resetAvatarPrivate':
      case 'resetAvatarGroup':
      case 'resetAvatarCommunity': {
        let avatarChanged = false;
        if (
          // When the avatar update is about a private one, we need to check
          // if the profile has been updated more recently that what we have already
          this.shouldApplyPrivateProfileUpdate(newProfile)
        ) {
          if (
            this.getAvatarInProfilePath() ||
            this.getFallbackAvatarInProfilePath() ||
            this.getAvatarPointer() ||
            this.getProfileKey()
          ) {
            this.set({
              avatarInProfile: undefined,
              avatarPointer: undefined,
              profileKey: undefined,
              fallbackAvatarInProfile: undefined,
            });
            avatarChanged = true;
            // avatar has changed, also apply the new profileUpdatedAtSeconds timestamp
            if (isSetProfileWithUpdatedAtSeconds(newProfile)) {
              this.set({ profileUpdatedSeconds: newProfile.profileUpdatedAtSeconds });
            }
          }
        }
        if (avatarChanged || nameChanged) {
          await this.commit();
        }
        return { nameChanged, avatarNeedsDownload: false, avatarChanged };
      }

      case 'setAvatarBeforeDownloadPrivate':
      case 'setAvatarBeforeDownloadGroup': {
        const newProfileKeyHex = isString(newProfile.profileKey)
          ? newProfile.profileKey
          : to_hex(newProfile.profileKey);

        const existingAvatarPointer = this.getAvatarPointer();
        const existingProfileKeyHex = this.getProfileKey();
        const hasAvatarInNewProfile = !!newProfile.avatarPointer || !!newProfileKeyHex;
        // if no changes are needed, return early
        if (
          isEqual(existingAvatarPointer, newProfile.avatarPointer) &&
          isEqual(existingProfileKeyHex, newProfileKeyHex)
        ) {
          if (nameChanged) {
            await this.commit();
          }
          return { nameChanged, avatarNeedsDownload: false, avatarChanged: false };
        }
        this.set({ avatarPointer: newProfile.avatarPointer, profileKey: newProfileKeyHex });

        // avatar has changed, also apply the new profileUpdatedAtSeconds timestamp
        if (isSetProfileWithUpdatedAtSeconds(newProfile)) {
          this.set({ profileUpdatedSeconds: newProfile.profileUpdatedAtSeconds });
        }
        await this.commit();

        return { nameChanged, avatarNeedsDownload: hasAvatarInNewProfile, avatarChanged: true };
      }
      case 'setAvatarDownloadedPrivate':
      case 'setAvatarDownloadedGroup':
      case 'setAvatarDownloadedCommunity': {
        const newProfileKeyHex = isString(newProfile.profileKey)
          ? newProfile.profileKey
          : to_hex(newProfile.profileKey);

        const existingAvatarPointer = this.getAvatarPointer();
        const existingProfileKeyHex = this.getProfileKey();
        const originalAvatar = this.getAvatarInProfilePath();
        const originalFallbackAvatar = this.getFallbackAvatarInProfilePath();

        // if no changes are needed, return early
        if (
          isEqual(originalAvatar, newProfile.avatarPath) &&
          isEqual(originalFallbackAvatar, newProfile.fallbackAvatarPath) &&
          isEqual(existingAvatarPointer, newProfile.avatarPointer) &&
          isEqual(existingProfileKeyHex, newProfileKeyHex)
        ) {
          if (nameChanged) {
            await this.commit();
          }
          return { nameChanged, avatarChanged: false, avatarNeedsDownload: false };
        }

        // avatar has changed, but we are only dealing with the downloaded part of it here
        // so this actually is not a profile update change. Nothing to do, as the newProfile type suggests

        this.set({
          avatarPointer: newProfile.avatarPointer,
          avatarInProfile: newProfile.avatarPath,
          fallbackAvatarInProfile: newProfile.fallbackAvatarPath,
          profileKey: newProfileKeyHex,
        });

        await this.commit();
        return { nameChanged, avatarNeedsDownload: false, avatarChanged: true };
      }
      default:
        assertUnreachable(type, `handlePrivateProfileUpdate: unhandled case "${type}"`);
    }

    throw new Error('Should have returned earlier');
  }

  public getIsTrustedForAttachmentDownload() {
    return this.get('isTrustedForAttachmentDownload');
  }

  public setIsTrustedForAttachmentDownload(isTrusted: boolean) {
    if (isTrusted === this.getIsTrustedForAttachmentDownload()) {
      return;
    }
    this.setKey('isTrustedForAttachmentDownload', isTrusted);
  }

  public setLastMessage(lastMessage: string | null) {
    if (lastMessage === this.getLastMessage()) {
      return;
    }
    this.set({ lastMessage });
  }

  public setLastMessageStatus(lastMessageStatus: LastMessageStatusType | undefined) {
    if (lastMessageStatus === this.getLastMessageStatus()) {
      return;
    }
    this.set({ lastMessageStatus });
  }

  public getLastMessageStatus() {
    return this.get('lastMessageStatus');
  }

  public getLastMessage() {
    return this.get('lastMessage');
  }

  public getLastMessageInteraction() {
    return {
      type: this.get('lastMessageInteractionType'),
      status: this.get('lastMessageInteractionStatus'),
    };
  }

  public setLastMessageInteraction(
    opts: { type: ConversationInteractionType; status: ConversationInteractionStatus } | null
  ) {
    const current = this.getLastMessageInteraction();
    if (opts) {
      if (opts.type === current.type && opts.status === current.status) {
        return;
      }
      this.set({ lastMessageInteractionType: opts.type });
      this.set({ lastMessageInteractionStatus: opts.status });
    }
    if (current === null) {
      return;
    }
    this.set({ lastMessageInteractionType: null, lastMessageInteractionStatus: null });
  }

  /**
   * Update the display name of this conversation with the provided one.
   * Note: cannot be called with private chats: instead use `setSessionProfile`.
   */
  public setNonPrivateNameNoCommit(newDisplayName?: string | null) {
    if (this.isPrivate()) {
      // the name change is only allowed through setSessionProfile for private chats now, see above.
      throw new Error('setNonPrivateNameNoCommit should not be called with private chats');
    }
    const existingSessionName = this.getRealSessionUsername();
    if (newDisplayName !== existingSessionName && newDisplayName) {
      this.set({ displayNameInProfile: newDisplayName });
    }
  }

  /**
   * @returns `displayNameInProfile` so the real username as defined by that user/group
   */
  public getRealSessionUsername(): string | undefined {
    return selectLibGroupNameOutsideRedux(this.id) || this.get('displayNameInProfile');
  }

  /**
   * @returns `nickname` so the nickname we forced for that user. For a group, this returns `undefined`
   */
  public getNickname(): string | undefined {
    return this.isPrivate() ? this.get('nickname') || undefined : undefined;
  }

  /**
   * Returns the profile key attributes of this instance.
   * If the attribute is unset, empty, or not a string, returns `undefined`.
   */
  public getProfileKey(): string | undefined {
    const profileKey = this.get('profileKey');
    if (!profileKey || !isString(profileKey)) {
      return undefined;
    }
    return profileKey;
  }

  public getAvatarPointer(): string | undefined {
    return this.get('avatarPointer');
  }

  public getProfileUpdatedSeconds() {
    if (!this.isPrivate()) {
      throw new Error('Cannot call profileUpdatedSeconds for a non private conversation');
    }
    const profileUpdatedSeconds = this.get('profileUpdatedSeconds');
    if (
      !isNumber(profileUpdatedSeconds) ||
      !isFinite(profileUpdatedSeconds) ||
      profileUpdatedSeconds < 0
    ) {
      return 0;
    }

    return profileUpdatedSeconds;
  }

  /**
   * A private profile can have name and profileUpdatedSeconds unset,
   * but it must have both profilePicture and profileKey set for it to be returned
   */
  public getPrivateProfileDetails(): OutgoingUserProfile {
    if (!this.isPrivate()) {
      throw new Error('getPrivateProfileDetails can only be called on private conversations');
    }
    const avatarPointer = this.getAvatarPointer() ?? null;
    const displayName = this.getRealSessionUsername() ?? '';
    const profileKey = this.getProfileKey() ?? null;
    const updatedAtSeconds = this.getProfileUpdatedSeconds();

    return new OutgoingUserProfile({
      avatarPointer,
      displayName,
      profileKey,
      updatedAtSeconds,
    });
  }

  public setAvatarPointer(avatarPointer: string | undefined) {
    if (avatarPointer === this.getAvatarPointer()) {
      return;
    }
    this.set({ avatarPointer });
  }

  /**
   * @returns `getNickname` if a private convo and a nickname is set, or `getRealSessionUsername`
   */
  public getNicknameOrRealUsername(): string | undefined {
    return this.getNickname() || this.getRealSessionUsername();
  }

  public getNicknameOrRealUsernameOrPlaceholder(): string {
    const nickOrReal = this.getNickname() || this.getRealSessionUsername();

    if (nickOrReal) {
      return nickOrReal;
    }
    if (this.isPrivate()) {
      return PubKey.shorten(this.id);
    }
    if (this.isPublic()) {
      return tr('communityUnknown');
    }
    return tr('unknown');
  }

  public isAdmin(pubKey?: string) {
    if (!this.isPublic() && !this.isGroup()) {
      return false;
    }
    if (!pubKey) {
      throw new Error('isAdmin() pubKey is falsy');
    }
    const groupAdmins = this.getGroupAdmins();
    return Array.isArray(groupAdmins) && groupAdmins.includes(pubKey);
  }

  public weAreAdminUnblinded() {
    const us = UserUtils.getOurPubKeyStrFromCache();
    if (!us) {
      throw new PreConditionFailed('weAreAdminUnblinded: our pubkey is not set');
    }
    return this.isAdmin(us);
  }

  /**
   * Check if the provided pubkey is a moderator.
   * Being a moderator only makes sense for a sogs as closed groups have their admin under the groupAdmins property
   */
  public isModerator(pubKey?: string) {
    if (!pubKey) {
      throw new Error('isModerator() pubKey is falsy');
    }
    if (!this.isPublic()) {
      return false;
    }

    const groupModerators = getModeratorsOutsideRedux(this.id);
    return Array.isArray(groupModerators) && groupModerators.includes(pubKey);
  }

  /**
   * When receiving a shared config message, we need to apply the change after the merge happened to our database.
   * This is done with this function.
   * There are other actions to change the priority from the UI (or from )
   */
  public async setPriorityFromWrapper(
    priority: number,
    shouldCommit: boolean = true
  ): Promise<boolean> {
    if (priority !== this.getPriority()) {
      this.set({
        priority,
      });

      if (shouldCommit) {
        await this.commit();
      }
      return true;
    }
    return false;
  }

  /**
   * Toggle the pinned state of a conversation.
   * Any conversation can be pinned and the higher the priority, the higher it will be in the list.
   * Note: Currently, we do not have an order in the list of pinned conversation, but the libsession util wrapper can handle the order.
   */
  public async togglePinned(shouldCommit: boolean = true) {
    const pinnedBefore = this.isPinned();
    const newPriority = pinnedBefore
      ? CONVERSATION_PRIORITIES.default
      : CONVERSATION_PRIORITIES.pinned;
    this.set({
      priority: newPriority,
    });
    if (shouldCommit) {
      await this.commit();
    }
    const convoType = this.getConvoType();
    switch (convoType) {
      case ConvoTypeNarrow.blindedAcquaintance:
      case ConvoTypeNarrow.blindedContact:
      case ConvoTypeNarrow.privateAcquaintance:
      case ConvoTypeNarrow.community:
      case ConvoTypeNarrow.legacyGroup:
      case ConvoTypeNarrow.group:
        // all of the above do not support being hidden (only removed)
        break;
      case ConvoTypeNarrow.nts:
        await UserConfigWrapperActions.setPriority(newPriority);
        break;
      case ConvoTypeNarrow.contact:
        // TODO add cases here for contacts to handle the other cases
        break;
      default:
        assertUnreachable(convoType, `convoType ${convoType} is not supported`);
    }
    return true;
  }

  /**
   * Force the priority to be -1 (PRIORITY_DEFAULT_HIDDEN) so this conversation is hidden in the list. Currently only works for private chats.
   */
  public async setHidden(shouldCommit: boolean = true) {
    const convoType = this.getConvoType();
    switch (convoType) {
      case ConvoTypeNarrow.blindedAcquaintance:
      case ConvoTypeNarrow.blindedContact:
      case ConvoTypeNarrow.privateAcquaintance:
      case ConvoTypeNarrow.community:
      case ConvoTypeNarrow.legacyGroup:
      case ConvoTypeNarrow.group:
        // all of the above do not support being hidden (only removed)
        break;
      case ConvoTypeNarrow.nts:
        await UserConfigWrapperActions.setPriority(CONVERSATION_PRIORITIES.hidden);
        break;
      case ConvoTypeNarrow.contact:
        // TODO add cases here for contacts to handle the other cases
        break;
      default:
        assertUnreachable(convoType, `convoType ${convoType} is not supported`);
    }

    if (!this.isPrivate()) {
      return;
    }
    const priority = this.getPriority();
    if (priority >= CONVERSATION_PRIORITIES.default) {
      this.set({ priority: CONVERSATION_PRIORITIES.hidden });
      if (shouldCommit) {
        await this.commit();
      }
    }
  }

  public getLeft() {
    return this.get('left');
  }

  public setLeft(left: boolean) {
    if (left === this.getLeft()) {
      return;
    }
    this.set({ left });
  }

  /**
   * Reset the priority of this conversation to 0 if it was < 0, but keep anything > 0 as is.
   * So if the conversation was pinned, we keep it pinned with its current priority.
   * A pinned cannot be hidden, as the it is all based on the same priority values.
   */
  public async unhideIfNeeded(shouldCommit: boolean = true) {
    const priority = this.getPriority();
    if (isFinite(priority) && priority < CONVERSATION_PRIORITIES.default) {
      await this.setPriorityFromWrapper(CONVERSATION_PRIORITIES.default, shouldCommit);
    }
  }

  public async markAsUnread(forcedValue: boolean, shouldCommit: boolean = true) {
    if (!!forcedValue !== this.isMarkedUnread()) {
      this.set({
        markedAsUnread: !!forcedValue,
      });
      if (shouldCommit) {
        await this.commit();
      }
    }
  }

  public isMarkedUnread(): boolean {
    return !!this.get('markedAsUnread');
  }

  public async updateBlocksSogsMsgReqsTimestamp(
    blocksSogsMsgReqsTimestamp: number,
    shouldCommit: boolean = true
  ) {
    if (!PubKey.isBlinded(this.id)) {
      return; // this thing only applies to sogs blinded conversations
    }

    if (
      (isNil(this.get('blocksSogsMsgReqsTimestamp')) && !isNil(blocksSogsMsgReqsTimestamp)) ||
      (blocksSogsMsgReqsTimestamp === 0 && this.get('blocksSogsMsgReqsTimestamp') !== 0) ||
      blocksSogsMsgReqsTimestamp > this.get('blocksSogsMsgReqsTimestamp')
    ) {
      this.set({
        blocksSogsMsgReqsTimestamp,
      });
      if (shouldCommit) {
        await this.commit();
      }
    }
  }

  public blocksSogsMsgReqsTimestamp(): number {
    if (!PubKey.isBlinded(this.id)) {
      return 0; // this thing only applies to sogs blinded conversations
    }
    return this.get('blocksSogsMsgReqsTimestamp') || 0;
  }

  public setActiveAt(activeAt: number | undefined) {
    this.set({ active_at: activeAt });
  }

  /**
   * Mark a private conversation as approved to the specified value.
   * Does not do anything on non private chats.
   */
  public async setIsApproved(value: boolean, shouldCommit: boolean = true) {
    const valueForced = Boolean(value);

    if (!this.isPrivate() && !this.isClosedGroupV2()) {
      return;
    }

    if (valueForced !== Boolean(this.isApproved())) {
      window?.log?.debug(`Setting ${ed25519Str(this.id)} isApproved to: ${value}`);
      this.set({
        isApproved: valueForced,
      });

      if (shouldCommit) {
        await this.commit();
      }
    }
  }

  /**
   * Mark a private conversation as approved_me to the specified value
   * Does not do anything on non private chats.
   */
  public async setDidApproveMe(value: boolean, shouldCommit: boolean = true) {
    if (!this.isPrivate()) {
      return;
    }
    const valueForced = Boolean(value);
    if (valueForced !== Boolean(this.didApproveMe())) {
      window?.log?.debug(`Setting ${ed25519Str(this.id)} didApproveMe to: ${value}`);
      this.set({
        didApproveMe: valueForced,
      });

      if (shouldCommit) {
        await this.commit();
      }
    }
  }

  public async setOriginConversationID(conversationIdOrigin: string, shouldCommit: boolean) {
    if (conversationIdOrigin === this.getConversationIdOrigin()) {
      return;
    }
    // conversationIdOrigin can only be a 05 pubkey (invite to a 03 group from a 05 person, or a sogs url), or undefined
    if (
      conversationIdOrigin &&
      !PubKey.is05Pubkey(conversationIdOrigin) &&
      !OpenGroupUtils.isOpenGroupV2(conversationIdOrigin)
    ) {
      window.log.warn(
        'tried to setOriginConversationID with invalid parameter:',
        conversationIdOrigin
      );
      throw new Error('tried to setOriginConversationID with invalid parameter ');
    }
    this.set({
      conversationIdOrigin,
    });

    if (shouldCommit) {
      await this.commit();
    }
  }

  /**
   * Save the pollInfo to the Database or to the in memory redux slice depending on the data.
   * things stored to the redux slice of the sogs (ReduxSogsRoomInfos)  are:
   * - subscriberCount
   * - canWrite
   * - moderators
   *
   * things stored in the database are
   * - admins (as they are also stored for groups we just reuse the same field, saved in the DB for now)
   * - display name of that room
   *
   * This function also triggers the download of the new avatar if needed.
   *
   * Does not do anything for non public chats.
   */

  public async setPollInfo(infos?: {
    active_users: number;
    read: boolean;
    write: boolean;
    upload: boolean;
    details: {
      admins?: Array<string>;
      image_id?: number;
      name?: string;
      moderators?: Array<string>;
      hidden_admins?: Array<string>;
      hidden_moderators?: Array<string>;
      description?: string;
    };
  }) {
    if (!this.isPublic()) {
      return;
    }
    if (!infos || isEmpty(infos)) {
      return;
    }
    const { write, active_users, details } = infos;

    if (
      isFinite(infos.active_users) &&
      infos.active_users !== 0 &&
      getSubscriberCountOutsideRedux(this.id) !== active_users
    ) {
      ReduxSogsRoomInfos.setSubscriberCountOutsideRedux(this.id, active_users);
    }

    if (getCanWriteOutsideRedux(this.id) !== !!write) {
      ReduxSogsRoomInfos.setCanWriteOutsideRedux(this.id, !!write);
    }

    let hasChange = await this.handleSogsModsOrAdminsChanges({
      modsOrAdmins: details.admins,
      hiddenModsOrAdmins: details.hidden_admins,
      type: 'admins',
    });

    const modsChanged = await this.handleSogsModsOrAdminsChanges({
      modsOrAdmins: details.moderators,
      hiddenModsOrAdmins: details.hidden_moderators,
      type: 'mods',
    });
    hasChange = hasChange || modsChanged;

    if (details.name && details.name !== this.getRealSessionUsername()) {
      hasChange = hasChange || true;
      this.setNonPrivateNameNoCommit(details.name);
    }

    if (this.handleRoomDescriptionChange({ description: details.description || '' })) {
      hasChange = hasChange || true;
    }

    if (this.isPublic() && details.image_id && isNumber(details.image_id)) {
      const roomInfos = OpenGroupData.getV2OpenGroupRoom(this.id);
      if (roomInfos) {
        void sogsV3FetchPreviewAndSaveIt({
          ...roomInfos,
          imageFullUrl: fileDetailsToURL({
            fileId: details.image_id,
            roomId: roomInfos.roomId,
            serverUrl: roomInfos.serverUrl,
          }),
        });
      }
    }

    // only trigger a write to the db if a change is detected
    if (hasChange) {
      await this.commit();
    }
  }

  public hasMember(pubkey: string) {
    return includes(this.getGroupMembers(), pubkey);
  }

  public hasReactions() {
    // message requests should not have reactions
    if (this.isPrivate() && !this.isApproved()) {
      return false;
    }
    // older open group conversations won't have reaction support
    if (this.isOpenGroupV2()) {
      const openGroup = OpenGroupData.getV2OpenGroupRoom(this.id);
      return roomHasReactionsEnabled(openGroup);
    }
    return true;
  }

  public async removeMessage(messageId: string) {
    await Data.removeMessage(messageId);
    this.updateLastMessage();

    window.inboxStore?.dispatch(
      conversationActions.messagesDeleted([
        {
          conversationId: this.id,
          messageId,
        },
      ])
    );
  }

  public isPinned() {
    const priority = this.getPriority();

    return isFinite(priority) && priority > CONVERSATION_PRIORITIES.default;
  }

  public didApproveMe() {
    if (PubKey.is05Pubkey(this.id) && this.isPrivate()) {
      // if a private chat, trust the value from the Libsession wrapper cached first
      // TODO once we have a libsession state, we can make this used across the app without repeating as much
      return SessionUtilContact.getContactCached(this.id)?.approvedMe ?? !!this.get('didApproveMe');
    }
    return !!this.get('didApproveMe');
  }

  public isApproved() {
    if (PubKey.is05Pubkey(this.id) && this.isPrivate()) {
      // if a private chat, trust the value from the Libsession wrapper cached first
      return SessionUtilContact.getContactCached(this.id)?.approved ?? !!this.get('isApproved');
    }
    return !!this.get('isApproved');
  }

  /**
   * For a private convo, returns nickname || ('You' || userDisplayName) || shortened(pk)
   * Throws an error if called on a no-private convo.
   *
   */
  public getContactProfileNameOrShortenedPubKey() {
    if (!this.isPrivate()) {
      throw new Error(
        'getContactProfileNameOrShortenedPubKey() cannot be called with a non private convo.'
      );
    }

    const pubkey = this.id;
    if (UserUtils.isUsFromCache(pubkey)) {
      return tr('you');
    }

    const profileName = this.getRealSessionUsername();

    return profileName || PubKey.shorten(pubkey);
  }

  /**
   * Returns the path to the downloaded avatar of that user, or undefined.
   */
  public getAvatarInProfilePath() {
    const localAvatarPath = this.get('avatarInProfile');
    if (!isString(localAvatarPath) && !isNil(localAvatarPath)) {
      throw new Error('avatarInProfile must be a string or nil');
    }
    return localAvatarPath || undefined;
  }

  /**
   * Returns the path to the forced static downloaded avatar of that user, or undefined.
   */
  public getFallbackAvatarInProfilePath() {
    const fallbackAvatarPath = this.get('fallbackAvatarInProfile');
    if (!isString(fallbackAvatarPath) && !isNil(fallbackAvatarPath)) {
      throw new Error('fallbackAvatarPath must be a string or nil');
    }
    return fallbackAvatarPath || undefined;
  }

  /**
   * If the user is a pro user, return his real avatar path (i.e. animated if it was set animated by the user).
   * If the user is not a pro user, return the fallback avatar path (first or only frame extracted)
   */
  public getProOrNotAvatarPath() {
    const proAvailable = getFeatureFlag('proAvailable');
    return !proAvailable || this.isProUser()
      ? this.getAvatarInProfilePath()
      : this.getFallbackAvatarInProfilePath();
  }

  /**
   * @note we will use a default image when making the notification if the avatar cannot be found depending on the platform
   */
  public async getNotificationIcon(): Promise<string | undefined> {
    const proOrNotAvatarPath = this.getProOrNotAvatarPath();

    if (!proOrNotAvatarPath) {
      return undefined;
    }

    const decryptedAvatarUrl = await DecryptedAttachmentsManager.getDecryptedMediaUrl(
      proOrNotAvatarPath,
      IMAGE_JPEG,
      true
    );

    if (!decryptedAvatarUrl) {
      window.log.warn('Could not decrypt avatar stored locally for getNotificationIcon..');
      return undefined;
    }
    return decryptedAvatarUrl;
  }

  public async notify(message: MessageModel) {
    if (!message.isIncoming()) {
      return;
    }
    const conversationId = this.id;
    const isLegacyGroup = this.isClosedGroup() && PubKey.is05Pubkey(this.id);

    let friendRequestText;
    // NOTE: legacy groups are never approved, so we should not cancel notifications
    if (!this.isApproved() && !isLegacyGroup) {
      window?.log?.info('notification cancelled for unapproved convo', this.idForLogging());
      const hadNoRequestsPrior =
        ConvoHub.use()
          .getConversations()
          .filter(conversation => {
            return (
              !conversation.isApproved() &&
              !conversation.isBlocked() &&
              conversation.isPrivate() &&
              !conversation.isMe()
            );
          }).length === 1;
      const isFirstMessageOfConvo =
        (await Data.getMessagesByConversation(this.id, { messageId: null })).messages.length === 1;
      if (hadNoRequestsPrior && isFirstMessageOfConvo) {
        friendRequestText = tr('messageRequestsNew');
      } else {
        window?.log?.info(
          'notification cancelled for as pending requests already exist',
          this.idForLogging()
        );
        return;
      }
    }

    // make sure the notifications are not muted for this convo (and not the source convo)
    const notificationsFor = this.getNotificationsFor();
    if (notificationsFor === 'disabled') {
      window?.log?.info('notifications disabled for convo', this.idForLogging());
      return;
    }
    if (notificationsFor === 'mentions_only') {
      // check if the message has ourselves as mentions
      const regex = new RegExp(`@${PubKey.regexForPubkeys}`, 'g');
      const text = message.get('body');
      const mentions = text?.match(regex) || ([] as Array<string>);
      const mentionMe = mentions && mentions.some(m => isUsAnySogsFromCache(m.slice(1)));

      const quotedMessageAuthor = message.get('quote')?.author;

      const isReplyToOurMessage =
        quotedMessageAuthor && UserUtils.isUsFromCache(quotedMessageAuthor);
      if (!mentionMe && !isReplyToOurMessage) {
        window?.log?.info(
          'notifications disabled for non mentions or reply for convo',
          conversationId
        );

        return;
      }
    }

    const convo = await ConvoHub.use().getOrCreateAndWait(
      message.get('source'),
      ConversationTypeEnum.PRIVATE
    );

    const iconUrl = await this.getNotificationIcon();

    const messageAttrs = message.attributes;
    const messageId = message.id;
    const isExpiringMessage = this.isExpiringMessage(messageAttrs);

    Notifications.addNotification({
      conversationId,
      iconUrl,
      isExpiringMessage,
      message: friendRequestText || message.getNotificationText(),
      messageId,
      title: friendRequestText ? '' : convo.getNicknameOrRealUsernameOrPlaceholder(),
    });
  }

  public async notifyIncomingCall() {
    if (!this.isPrivate()) {
      window?.log?.info('notifyIncomingCall: not a private convo', this.idForLogging());
      return;
    }
    const conversationId = this.id;

    // make sure the notifications are not muted for this convo (and not the source convo)
    const notificationsFor = this.getNotificationsFor();
    if (notificationsFor === 'disabled') {
      window?.log?.info(
        'notifyIncomingCall: notifications disabled for convo',
        this.idForLogging()
      );
      return;
    }

    const iconUrl = await this.getNotificationIcon();

    Notifications.addNotification({
      conversationId,
      iconUrl,
      isExpiringMessage: false,
      message: tr('callsIncoming', {
        name: this.getNicknameOrRealUsername() || PubKey.shorten(conversationId),
      }),
      title: this.getNicknameOrRealUsernameOrPlaceholder(),
    });
  }

  public async notifyTypingNoCommit({ isTyping, sender }: { isTyping: boolean; sender: string }) {
    // We don't do anything with typing messages from our other devices
    if (UserUtils.isUsFromCache(sender)) {
      return;
    }

    // typing only works for private chats for now
    if (!this.isPrivate()) {
      return;
    }

    if (this.typingTimer) {
      global.clearTimeout(this.typingTimer);
      this.typingTimer = null;
    }

    // we do not trigger a state change here, instead we rely on the caller to do the commit once it is done with the queue of messages
    this.typingTimer = isTyping
      ? // eslint-disable-next-line @typescript-eslint/no-misused-promises
        global.setTimeout(this.clearContactTypingTimer.bind(this, sender), 15 * 1000)
      : null;
  }

  /**
   * This call is not debounced and can be quite heavy, so only call it when handling config messages updates
   */
  public async markReadFromConfigMessage(newestUnreadDate: number) {
    return this.markConversationReadBouncy({ newestUnreadDate, fromConfigMessage: true });
  }

  public getGroupAdmins(): Array<string> {
    if (this.isClosedGroupV2()) {
      return selectLibGroupAdminsOutsideRedux(this.id);
    }
    const groupAdmins = this.get('groupAdmins');

    return groupAdmins && groupAdmins.length > 0 ? groupAdmins : [];
  }

  public getMembers() {
    return this.get('members');
  }

  public setMembers(members: Array<string>) {
    if (isEqual(members, this.getMembers())) {
      return;
    }
    this.set({ members });
  }

  public isKickedFromGroup(): boolean {
    if (this.isClosedGroupV2()) {
      return getLibGroupKickedOutsideRedux(this.id) || false;
    }
    // legacy group are deprecated
    return false;
  }

  public getActiveAt(): number | undefined {
    return this.get('active_at');
  }

  public getLastJoinedTimestamp(): number {
    if (this.isClosedGroup()) {
      return this.get('lastJoinedTimestamp') || 0;
    }
    return 0;
  }

  public getGroupMembers(): Array<string> {
    if (this.isClosedGroup()) {
      if (this.isClosedGroupV2()) {
        return selectLibGroupMembersOutsideRedux(this.id);
      }
      const members = this.get('members');
      return members && members.length > 0 ? members : [];
    }
    return [];
  }

  private async sendMessageJob(message: MessageModel) {
    try {
      const { body, attachments, preview, quote, fileIdsToLink } = await message.uploadData();
      const { id } = message;
      const destination = this.id;

      const sentAt = message.get('sent_at'); // this is used to store the timestamp when we tried sending that message, it should be set by the caller
      if (!sentAt) {
        throw new Error('sendMessageJob() sent_at is not set.');
      }
      const networkTimestamp = NetworkTime.now();

      // we are trying to send a message to someone. Make sure this convo is not hidden
      await this.unhideIfNeeded(true);

      // TODO break down those functions  (sendMessage and retrySend into smaller functions and narrow the VisibleMessageParams to preview, etc. with checks of types)
      // an OpenGroupV2 message is just a visible message
      const chatMessageParams: VisibleMessageParams = {
        body,
        identifier: id,
        createAtNetworkTimestamp: networkTimestamp,
        attachments,
        expirationType: message.getExpirationType() ?? 'unknown', // Note we assume that the caller used a setting allowed for that conversation when building it. Here we just send it.
        expireTimer: message.getExpireTimerSeconds(),
        preview: preview ? [preview] : [],
        quote,
        userProfile: await UserUtils.getOurProfile(),
      };

      if (PubKey.isBlinded(this.id)) {
        window.log.info('Sending a blinded message to this user: ', this.id);
        await this.sendBlindedMessageRequest(chatMessageParams);
        return;
      }

      // handleAcceptConversationRequest will take care of sending response depending on the type of conversation
      await handleAcceptConversationRequest({
        convoId: this.id,
        approvalMessageTimestamp: NetworkTime.now() - 100,
      });

      if (this.isOpenGroupV2()) {
        const chatMessageOpenGroupV2 = new OpenGroupVisibleMessage(chatMessageParams);
        const roomInfos = this.toOpenGroupV2();
        if (!roomInfos) {
          throw new Error('Could not find this room in db');
        }
        const openGroup = OpenGroupData.getV2OpenGroupRoom(this.id);
        // send with blinding if we need to
        await MessageQueue.use().sendToOpenGroupV2({
          message: chatMessageOpenGroupV2,
          roomInfos,
          blinded: Boolean(roomHasBlindEnabled(openGroup)),
          filesToLink: fileIdsToLink,
        });
        return;
      }

      const destinationPubkey = new PubKey(destination);

      if (this.isPrivate()) {
        if (this.isMe()) {
          if (this.matchesDisappearingMode('deleteAfterRead')) {
            throw new Error('Note to Self disappearing messages must be deleteAfterSend');
          }
          chatMessageParams.syncTarget = this.id;
          const chatMessageMe = new VisibleMessage(chatMessageParams);

          await MessageQueue.use().sendSyncMessage({
            namespace: SnodeNamespaces.Default,
            message: chatMessageMe,
          });
          return;
        }

        const communityInvitation = message.getCommunityInvitation();

        if (communityInvitation && communityInvitation.url) {
          const communityInviteMessage = new CommunityInvitationMessage({
            identifier: id,
            createAtNetworkTimestamp: networkTimestamp,
            name: communityInvitation.name,
            url: communityInvitation.url,
            expirationType: chatMessageParams.expirationType,
            expireTimer: chatMessageParams.expireTimer,
          });
          // we need the return await so that errors are caught in the catch {}
          await MessageQueue.use().sendToPubKey(
            destinationPubkey,
            communityInviteMessage,
            SnodeNamespaces.Default
          );
          return;
        }
        const chatMessagePrivate = new VisibleMessage(chatMessageParams);
        await MessageQueue.use().sendToPubKey(
          destinationPubkey,
          chatMessagePrivate,
          SnodeNamespaces.Default
        );
        return;
      }

      if (this.isClosedGroupV2()) {
        // we need the return await so that errors are caught in the catch {}
        await this.sendMessageToGroupV2(chatMessageParams);
        return;
      }

      if (this.isClosedGroup()) {
        // legacy groups are readonly
        return;
      }

      throw new TypeError(`Invalid conversation type: '${this.get('type')}'`);
    } catch (e: unknown) {
      if (e instanceof Error) {
        await message.saveErrors(e);
      }
    }
  }

  private async sendMessageToGroupV2(chatMessageParams: VisibleMessageParams) {
    if (!PubKey.is03Pubkey(this.id)) {
      throw new Error('sendMessageToGroupV2 needs a 03 key');
    }
    const visibleMessage = new VisibleMessage(chatMessageParams);
    const groupVisibleMessage = new ClosedGroupV2VisibleMessage({
      chatMessage: visibleMessage,
      destination: this.id,
    });

    // we need the return await so that errors are caught in the catch {}
    await MessageQueue.use().sendToGroupV2({
      message: groupVisibleMessage,
    });
  }

  private async sendBlindedMessageRequest(messageParams: VisibleMessageParams) {
    const ourSignKeyBytes = await UserUtils.getUserED25519KeyPairBytes();
    const groupUrl = this.getConversationIdOrigin();

    if (!PubKey.isBlinded(this.id)) {
      window?.log?.warn('sendBlindedMessageRequest - convo is not a blinded one');
      return;
    }

    if (!messageParams.body) {
      window?.log?.warn('sendBlindedMessageRequest - needs a body');
      return;
    }

    // include our profile (displayName + avatar url + key for the recipient)
    // eslint-disable-next-line no-param-reassign
    messageParams.userProfile = await UserUtils.getOurProfile();

    if (!ourSignKeyBytes || !groupUrl) {
      window?.log?.error(
        'sendBlindedMessageRequest - Cannot get required information for encrypting blinded message.'
      );
      return;
    }

    const roomInfo = OpenGroupData.getV2OpenGroupRoom(groupUrl);

    if (!roomInfo || !roomInfo.serverPublicKey) {
      ToastUtils.pushToastError('no-sogs-matching', tStripped('communityJoinError'));
      window?.log?.error('Could not find room with matching server url', groupUrl);
      throw new Error(`Could not find room with matching server url: ${groupUrl}`);
    }

    const sogsVisibleMessage = new OpenGroupVisibleMessage(messageParams);
    const paddedBody = addMessagePadding(sogsVisibleMessage.plainTextBuffer());

    const serverPubKey = roomInfo.serverPublicKey;

    const encryptedMsg = await SogsBlinding.encryptBlindedMessage({
      rawData: paddedBody,
      senderSigningKey: ourSignKeyBytes,
      serverPubKey: from_hex(serverPubKey),
      recipientBlindedPublicKey: from_hex(this.id.slice(2)),
    });

    if (!encryptedMsg) {
      throw new Error('encryptBlindedMessage failed');
    }
    if (!messageParams.identifier) {
      throw new Error('encryptBlindedMessage messageParams needs an identifier');
    }

    this.setActiveAt(Date.now());
    await this.setIsApproved(true, true);

    // TODO we need to add support for sending blinded25 message request in addition to the legacy blinded15
    await MessageQueue.use().sendToOpenGroupV2BlindedRequest({
      encryptedContent: encryptedMsg,
      roomInfos: roomInfo,
      message: sogsVisibleMessage,
      recipientBlindedId: this.id,
    });
  }

  // tslint:disable-next-line cyclomatic-complexity
  private async bouncyUpdateLastMessage() {
    if (!this.id || !this.getActiveAt() || this.isHidden()) {
      return;
    }
    const messages = await Data.getLastMessagesByConversation(this.id, 1, true);
    const existingLastMessageAttribute = this.get('lastMessage');
    const existingLastMessageStatus = this.get('lastMessageStatus');
    if (!messages || !messages.length) {
      if (existingLastMessageAttribute || existingLastMessageStatus) {
        this.setLastMessage(null);
        this.setLastMessageStatus(undefined);
        await this.commit();
      }
      return;
    }
    const lastMessageModel = messages.at(0);
    if (!lastMessageModel) {
      if (
        this.get('lastMessage') ||
        this.get('lastMessageStatus') ||
        this.get('lastMessageInteractionType') ||
        this.get('lastMessageInteractionStatus')
      ) {
        this.set({
          lastMessage: '',
          lastMessageStatus: undefined,
          lastMessageInteractionType: undefined,
          lastMessageInteractionStatus: undefined,
        });
        await this.commit();
      }
      return;
    }
    const interactionNotification = lastMessageModel.getInteractionNotification();

    const lastMessageInteractionType = interactionNotification?.interactionType;
    const lastMessageInteractionStatus =
      lastMessageModel.getInteractionNotification()?.interactionStatus;
    const lastMessageStatus = lastMessageModel.getMessagePropStatus() || undefined;
    const lastMessageNotificationText = lastMessageModel.getNotificationText() || undefined;
    // we just want to set the `status` to `undefined` if there are no `lastMessageNotificationText`
    const lastMessageUpdate = !isEmpty(lastMessageNotificationText)
      ? {
          lastMessage: lastMessageNotificationText || '',
          lastMessageStatus,
          lastMessageInteractionType,
          lastMessageInteractionStatus,
        }
      : {
          lastMessage: '',
          lastMessageStatus: undefined,
          lastMessageInteractionType: undefined,
          lastMessageInteractionStatus: undefined,
        };
    const existingLastMessageInteractionType = this.get('lastMessageInteractionType');
    const existingLastMessageInteractionStatus = this.get('lastMessageInteractionStatus');

    if (
      lastMessageUpdate.lastMessage !== existingLastMessageAttribute ||
      lastMessageUpdate.lastMessageStatus !== existingLastMessageStatus ||
      lastMessageUpdate.lastMessageInteractionType !== existingLastMessageInteractionType ||
      lastMessageUpdate.lastMessageInteractionStatus !== existingLastMessageInteractionStatus
    ) {
      if (
        lastMessageUpdate.lastMessageStatus === existingLastMessageStatus &&
        lastMessageUpdate.lastMessageInteractionType === existingLastMessageInteractionType &&
        lastMessageUpdate.lastMessageInteractionStatus === existingLastMessageInteractionStatus &&
        lastMessageUpdate.lastMessage &&
        lastMessageUpdate.lastMessage.length > 40 &&
        existingLastMessageAttribute &&
        existingLastMessageAttribute.length > 40 &&
        lastMessageUpdate.lastMessage.startsWith(existingLastMessageAttribute)
      ) {
        // if status is the same, and text has a long length which starts with the db status, do not trigger an update.
        // we only store the first 60 chars in the db for the lastMessage attributes (see sql.ts)
        return;
      }
      this.set({
        ...lastMessageUpdate,
      });
      await this.commit();
    }
  }

  private async markConversationReadBouncy({
    newestUnreadDate,
    fromConfigMessage = false,
  }: {
    newestUnreadDate: number;
    fromConfigMessage?: boolean;
  }) {
    const readAt = Date.now();
    const conversationId = this.id;
    Notifications.clearByConversationID(conversationId);

    const oldUnreadNowRead = await this.getUnreadByConversation(newestUnreadDate);

    if (!oldUnreadNowRead.length) {
      // no new messages where read, no need to do anything
      return;
    }

    // Build the list of updated message models so we can mark them all as read on a single sqlite call
    const readDetails = [];
    const msgsIdsToUpdateExpireOnSwarm: Array<string> = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const nowRead of oldUnreadNowRead) {
      const shouldUpdateSwarmExpiry = nowRead.markMessageReadNoCommit(readAt);
      if (shouldUpdateSwarmExpiry) {
        msgsIdsToUpdateExpireOnSwarm.push(nowRead.id);
      }

      const sentAt = nowRead.get('sent_at') || nowRead.get('serverTimestamp');
      if (nowRead.get('source') && sentAt && isFinite(sentAt)) {
        readDetails.push({
          sender: nowRead.get('source'),
          timestamp: sentAt,
        });
      }
    }

    if (!isEmpty(msgsIdsToUpdateExpireOnSwarm)) {
      if (fromConfigMessage) {
        // when we mark a message as read through a convo volatile update,
        // it means those messages have already an up to date expiry on the server side
        // so we can just fetch those expiries for all the hashes we are marking as read, and trust it.
        await FetchMsgExpirySwarm.queueNewJobIfNeeded(msgsIdsToUpdateExpireOnSwarm);
      } else {
        await UpdateMsgExpirySwarm.queueNewJobIfNeeded(msgsIdsToUpdateExpireOnSwarm);
      }
    }
    // save all the attributes in a single call
    await Data.saveMessages(oldUnreadNowRead.map(m => m.cloneAttributes()));
    // trigger all the ui updates in a single call
    window.inboxStore?.dispatch(
      conversationActions.messagesChanged(oldUnreadNowRead.map(m => m.getMessageModelProps()))
    );

    await this.commit();

    if (readDetails.length) {
      const us = UserUtils.getOurPubKeyStrFromCache();
      const timestamps = readDetails.filter(m => m.sender !== us).map(m => m.timestamp);
      await this.sendReadReceiptsIfNeeded(timestamps);
    }
  }

  private async getUnreadByConversation(sentBeforeTs: number) {
    return Data.getUnreadByConversation(this.id, sentBeforeTs);
  }

  /**
   * @link ConversationAttributes#conversationIdOrigin
   */
  private getConversationIdOrigin() {
    if (!this.isClosedGroupV2() && !this.isPrivateAndBlinded()) {
      window.log.warn(
        'getConversationIdOrigin can only be set with 03-group or blinded conversation (15 prefix), got:',
        this.id
      );
      throw new Error(
        'getConversationIdOrigin can only be set with 03-group or blinded conversation (15 prefix)'
      );
    }
    return this.get('conversationIdOrigin');
  }

  private async addSingleMessage(messageAttributes: MessageAttributesOptionals) {
    // eslint-disable-next-line no-bitwise
    const model = new MessageModel(messageAttributes);

    const messageId = await model.commit(true);
    model.set({ id: messageId });

    await model.setToExpire();
    this.updateLastMessage();
    return model;
  }

  private async clearContactTypingTimer(_sender: string) {
    if (this.typingTimer) {
      global.clearTimeout(this.typingTimer);
      this.typingTimer = null;

      // User was previously typing, but timed out or we received message. State change!
      await this.commit();
    }
  }

  private isExpiringMessage(json: Readonly<MessageAttributes>) {
    if (json.type === 'incoming') {
      return false;
    }

    const { expireTimer } = json;

    return isFinite(expireTimer) && expireTimer > 0;
  }

  private shouldDoTyping() {
    // for typing to happen, this must be a private unblocked active convo, and the settings to be on
    if (
      !this.isActive() ||
      !Storage.get(SettingsKey.settingsTypingIndicator) ||
      this.isBlocked() ||
      !this.isPrivate()
    ) {
      return false;
    }
    return this.isApproved();
  }

  private async bumpTyping() {
    if (!this.shouldDoTyping()) {
      return;
    }

    if (!this.typingRefreshTimer) {
      const isTyping = true;
      this.setTypingRefreshTimer();
      this.sendTypingMessage(isTyping);
    }

    this.setTypingPauseTimer();
  }

  private setTypingRefreshTimer() {
    if (this.typingRefreshTimer) {
      global.clearTimeout(this.typingRefreshTimer);
    }
    this.typingRefreshTimer = global.setTimeout(this.onTypingRefreshTimeout.bind(this), 10 * 1000);
  }

  private onTypingRefreshTimeout() {
    const isTyping = true;
    this.sendTypingMessage(isTyping);

    // This timer will continue to reset itself until the pause timer stops it
    this.setTypingRefreshTimer();
  }

  private setTypingPauseTimer() {
    if (this.typingPauseTimer) {
      global.clearTimeout(this.typingPauseTimer);
    }
    this.typingPauseTimer = global.setTimeout(this.onTypingPauseTimeout.bind(this), 10 * 1000);
  }

  private onTypingPauseTimeout() {
    const isTyping = false;
    this.sendTypingMessage(isTyping);

    this.clearTypingTimers();
  }

  private clearTypingTimers() {
    if (this.typingPauseTimer) {
      global.clearTimeout(this.typingPauseTimer);
      this.typingPauseTimer = null;
    }
    if (this.typingRefreshTimer) {
      global.clearTimeout(this.typingRefreshTimer);
      this.typingRefreshTimer = null;
    }
  }

  private sendTypingMessage(isTyping: boolean) {
    // we can only send typing messages to approved contacts
    if (!this.isPrivate() || this.isMe() || !this.isApproved()) {
      return;
    }

    const recipientId = this.id;

    if (isEmpty(recipientId)) {
      throw new Error('Need to provide either recipientId');
    }

    const typingParams = {
      createAtNetworkTimestamp: NetworkTime.now(),
      isTyping,
      typingTimestamp: NetworkTime.now(),
    };
    const typingMessage = new TypingMessage(typingParams);

    const pubkey = new PubKey(recipientId);
    void MessageQueue.use()
      .sendTo1o1NonDurably({
        pubkey,
        message: typingMessage,
        namespace: SnodeNamespaces.Default,
      })
      .catch(window?.log?.error);
  }

  private async replaceWithOurRealSessionId(toReplace: Array<string>) {
    const roomInfos = OpenGroupData.getV2OpenGroupRoom(this.id);
    const sodium = await getSodiumRenderer();
    const ourBlindedPubkeyForThisSogs =
      roomInfos && roomHasBlindEnabled(roomInfos)
        ? await findCachedOurBlindedPubkeyOrLookItUp(roomInfos?.serverPublicKey, sodium)
        : UserUtils.getOurPubKeyStrFromCache();
    const replacedWithOurRealSessionId = toReplace.map(m =>
      m === ourBlindedPubkeyForThisSogs ? UserUtils.getOurPubKeyStrFromCache() : m
    );
    return replacedWithOurRealSessionId;
  }

  private async handleSogsModsOrAdminsChanges({
    modsOrAdmins,
    hiddenModsOrAdmins,
    type,
  }: {
    modsOrAdmins?: Array<string>;
    hiddenModsOrAdmins?: Array<string>;
    type: 'mods' | 'admins';
  }) {
    if (modsOrAdmins && isArray(modsOrAdmins)) {
      const localModsOrAdmins = [...modsOrAdmins];
      if (hiddenModsOrAdmins && isArray(hiddenModsOrAdmins)) {
        localModsOrAdmins.push(...hiddenModsOrAdmins);
      }

      const replacedWithOurRealSessionId = await this.replaceWithOurRealSessionId(
        uniq(localModsOrAdmins)
      );

      switch (type) {
        case 'admins':
          return this.updateGroupAdmins(replacedWithOurRealSessionId, true);
        case 'mods':
          ReduxSogsRoomInfos.setModeratorsOutsideRedux(this.id, replacedWithOurRealSessionId);
          return false;
        default:
          assertUnreachable(type, `handleSogsModsOrAdminsChanges: unhandled switch case: ${type}`);
      }
    }
    return false;
  }

  private handleRoomDescriptionChange({ description }: { description: string }) {
    if (getRoomDescriptionOutsideRedux(this.id) !== description) {
      ReduxSogsRoomInfos.setRoomDescriptionOutsideRedux(this.id, description);
      return true;
    }

    return false;
  }

  private async getQuoteAttachment(attachments: any, preview: any) {
    if (attachments?.length) {
      return Promise.all(
        attachments
          .filter(
            (attachment: any) =>
              attachment && attachment.contentType && !attachment.pending && !attachment.error
          )
          .slice(0, 1)
          .map(async (attachment: any) => {
            const { fileName, thumbnail, contentType } = attachment;

            return {
              contentType,
              // Our proto library complains about this field being undefined, so we
              //   force it to null
              fileName: fileName || null,
              thumbnail: attachment?.thumbnail?.path // loadAttachmentData throws if the thumbnail.path is not set
                ? {
                    ...(await loadAttachmentData(thumbnail)),
                    objectUrl: getAbsoluteAttachmentPath(thumbnail.path),
                  }
                : null,
            };
          })
      );
    }

    if (preview?.length) {
      return Promise.all(
        preview
          .filter((attachment: any) => attachment?.image?.path) // loadAttachmentData throws if the image.path is not set
          .slice(0, 1)
          .map(async (attachment: any) => {
            const { image } = attachment;
            const { contentType } = image;

            return {
              contentType,
              // Our proto library complains about this field being undefined, so we
              //   force it to null
              fileName: null,
              thumbnail: image
                ? {
                    ...(await loadAttachmentData(image)),
                    objectUrl: getAbsoluteAttachmentPath(image.path),
                  }
                : null,
            };
          })
      );
    }

    return [];
  }

  private matchesDisappearingMode(mode: DisappearingMessageConversationModeType) {
    const ours = this.getExpirationMode();
    // Note: couldn't this be ours === mode with a twist maybe?
    const success =
      mode === 'deleteAfterRead'
        ? ours === 'deleteAfterRead'
        : mode === 'deleteAfterSend'
          ? ours === 'deleteAfterSend'
          : mode === 'off'
            ? ours === 'off'
            : false;

    return success;
  }

  // #region Start of getters
  public getExpirationMode() {
    return this.get('expirationMode');
  }

  public getExpireTimer() {
    return this.get('expireTimer');
  }

  public getIsExpired03Group() {
    return PubKey.is03Pubkey(this.id) && !!this.get('isExpired03Group');
  }

  // #endregion
}

export const Convo = { commitConversationAndRefreshWrapper };

async function commitConversationAndRefreshWrapper(id: string) {
  const convo = ConvoHub.use().get(id);
  if (!convo) {
    return;
  }

  // write to db
  const savedDetails = await Data.saveConversation(convo.cloneAttributes());
  await convo.refreshInMemoryDetails(savedDetails);

  // Performance impact on this is probably to be pretty bad. We might want to push for that DB refactor to be done sooner so we do not need to fetch info from the DB anymore
  for (let index = 0; index < LibSessionUtil.requiredUserVariants.length; index++) {
    const variant = LibSessionUtil.requiredUserVariants[index];

    switch (variant) {
      case 'UserConfig':
        // Note: nothing to do here, the NTS changes in libsession are now done
        //  when done through the UI
        break;
      case 'ContactsConfig':
        if (SessionUtilContact.isContactToStoreInWrapper(convo)) {
          // eslint-disable-next-line no-await-in-loop
          await SessionUtilContact.insertContactFromDBIntoWrapperAndRefresh(convo.id);
        }
        break;
      case 'UserGroupsConfig':
        if (SessionUtilUserGroups.isUserGroupToStoreInWrapper(convo)) {
          // eslint-disable-next-line no-await-in-loop
          await SessionUtilUserGroups.insertGroupsFromDBIntoWrapperAndRefresh(convo.id);
        }
        break;
      case 'ConvoInfoVolatileConfig':
        if (SessionUtilConvoInfoVolatile.isConvoToStoreInWrapper(convo)) {
          // eslint-disable-next-line no-await-in-loop
          await SessionUtilConvoInfoVolatile.insertConvoFromDBIntoWrapperAndRefresh(convo.id);
        }
        break;
      default:
        assertUnreachable(
          variant,
          `commitConversationAndRefreshWrapper unhandled case "${variant}"`
        );
    }
  }

  convo.triggerUIRefresh();
}

const throttledAllConversationsDispatch = debounce(
  () => {
    if (updatesToDispatch.size === 0) {
      return;
    }
    window.inboxStore?.dispatch(conversationsChanged([...updatesToDispatch.values()]));

    updatesToDispatch.clear();
  },
  500,
  { trailing: true, leading: true, maxWait: 1000 }
);

const updatesToDispatch: Map<string, ReduxConversationType> = new Map();

export function hasValidOutgoingRequestValues({
  isMe,
  didApproveMe,
  isApproved,
  isBlocked,
  isPrivate,
  activeAt,
}: {
  isMe: boolean;
  isApproved: boolean;
  didApproveMe: boolean;
  isBlocked: boolean;
  isPrivate: boolean;
  activeAt: number;
}): boolean {
  const isActive = activeAt && isFinite(activeAt) && activeAt > 0;

  // Started a new message, but haven't sent a message yet
  const emptyConvo = !isMe && !isApproved && isPrivate && !isBlocked && !didApproveMe && !!isActive;

  // Started a new message, and sent a message
  const sentOutgoingRequest =
    !isMe && isApproved && isPrivate && !isBlocked && !didApproveMe && !!isActive;

  return emptyConvo || sentOutgoingRequest;
}

/**
 * Method to evaluate if a convo contains the right values
 * @param values Required properties to evaluate if this is a message request
 */
export function hasValidIncomingRequestValues({
  id,
  isMe,
  isApproved,
  isBlocked,
  isPrivate,
  activeAt,
  didApproveMe,
  invitePending,
  priority,
}: {
  id: string;
  isMe: boolean;
  isApproved: boolean;
  isBlocked: boolean;
  isPrivate: boolean;
  didApproveMe: boolean;
  invitePending: boolean;
  activeAt: number | undefined;
  priority: number | undefined;
}): boolean {
  // if a convo is not active, it means we didn't get any messages nor sent any.
  const isActive = activeAt && isFinite(activeAt) && activeAt > 0;
  const priorityWithDefault = priority ?? CONVERSATION_PRIORITIES.default;
  const isHidden = priorityWithDefault < 0;
  return Boolean(
    (isPrivate || (PubKey.is03Pubkey(id) && invitePending)) &&
      !isMe &&
      !isApproved &&
      !isBlocked &&
      isActive &&
      didApproveMe &&
      !isHidden
  );
}

async function cleanUpExpireHistoryFromConvo(conversationId: string, isPrivate: boolean) {
  const updateIdsRemoved = await Data.cleanUpExpirationTimerUpdateHistory(
    conversationId,
    isPrivate
  );

  window?.inboxStore?.dispatch(
    messagesDeleted(updateIdsRemoved.map(m => ({ conversationId, messageId: m })))
  );
}

export const Conversation = { cleanUpExpireHistoryFromConvo };
