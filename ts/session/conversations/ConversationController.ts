/* eslint-disable no-await-in-loop */
/* eslint-disable more/no-then */
import { GroupPubkeyType, PubkeyType, type ConvoVolatileType } from 'libsession_util_nodejs';
import { isEmpty, isNil } from 'lodash';

import AbortController from 'abort-controller';
import { Data } from '../../data/data';
import { OpenGroupData } from '../../data/opengroups';
import { ConversationModel } from '../../models/conversation';
import {
  actions as conversationActions,
  resetConversationExternal,
} from '../../state/ducks/conversations';
import { BlockedNumberController } from '../../util';
import { getOpenGroupManager } from '../apis/open_group_api/opengroupV2/OpenGroupManagerV2';
import { PubKey } from '../types';

import { ConfigDumpData } from '../../data/configDump/configDump';
import { deleteAllMessagesByConvoIdNoConfirmation } from '../../interactions/conversationInteractions';
import { groupInfoActions } from '../../state/ducks/metaGroups';
import { getCurrentlySelectedConversationOutsideRedux } from '../../state/selectors/conversations';
import { assertUnreachable, stringify } from '../../types/sqlSharedTypes';
import {
  MetaGroupWrapperActions,
  UserGroupsWrapperActions,
} from '../../webworker/workers/browser/libsession_worker_interface';
import { OpenGroupUtils } from '../apis/open_group_api/utils';
import { getSwarmPollingInstance } from '../apis/snode_api';
import { DeleteAllFromGroupMsgNodeSubRequest } from '../apis/snode_api/SnodeRequestTypes';
import { GroupUpdateMemberLeftMessage } from '../messages/outgoing/controlMessage/group_v2/to_group/GroupUpdateMemberLeftMessage';
import { GroupUpdateMemberLeftNotificationMessage } from '../messages/outgoing/controlMessage/group_v2/to_group/GroupUpdateMemberLeftNotificationMessage';
import { MessageSender } from '../sending';
import { UserUtils } from '../utils';
import { ed25519Str } from '../utils/String';
import { PreConditionFailed } from '../utils/errors';
import { RunJobResult } from '../utils/job_runners/PersistedJob';
import { GroupSync } from '../utils/job_runners/jobs/GroupSyncJob';
import { LibSessionUtil } from '../utils/libsession/libsession_utils';
import { SessionUtilContact } from '../utils/libsession/libsession_utils_contacts';
import { SessionUtilConvoInfoVolatile } from '../utils/libsession/libsession_utils_convo_info_volatile';
import { SessionUtilUserGroups } from '../utils/libsession/libsession_utils_user_groups';
import { DisappearingMessages } from '../disappearing_messages';
import { StoreGroupRequestFactory } from '../apis/snode_api/factories/StoreGroupRequestFactory';
import { CONVERSATION_PRIORITIES, ConversationTypeEnum } from '../../models/types';
import { NetworkTime } from '../../util/NetworkTime';
import { timeoutWithAbort } from '../utils/Promise';
import { DURATION } from '../constants';

let instance: ConvoController | null;

const getConvoHub = () => {
  if (instance) {
    return instance;
  }
  instance = new ConvoController();

  return instance;
};

type DeleteOptions = { fromSyncMessage: boolean };

class ConvoController {
  private conversations: Array<ConversationModel>;
  private _initialFetchComplete: boolean = false;
  private _convoHubInitialPromise?: Promise<any>;

  /**
   * Do not call this constructor. You get the ConvoHub through ConvoHub.use() only
   */
  constructor() {
    this.conversations = [];
  }

  // FIXME this could return | undefined
  public get(id: string): ConversationModel {
    if (!this._initialFetchComplete) {
      throw new Error('ConvoHub.use().get() needs complete initial fetch');
    }

    return this.conversations.find(m => m.id === id) as ConversationModel; // FIXME allow undefined here, and fix all the calls
  }

  public getOrThrow(id: string): ConversationModel {
    if (!this._initialFetchComplete) {
      throw new Error('ConvoHub.use().get() needs complete initial fetch');
    }

    const convo = this.getUnsafe(id);

    if (convo) {
      return convo;
    }
    throw new Error(`Conversation ${id} does not exist on ConvoHub.use().get()`);
  }

  // Needed for some model setup which happens during the initial fetch() call below
  public getUnsafe(id: string): ConversationModel | undefined {
    return this.get(id);
  }

  public getOrCreate(id: string, type: ConversationTypeEnum) {
    if (typeof id !== 'string') {
      throw new TypeError("'id' must be a string");
    }

    if (
      type !== ConversationTypeEnum.PRIVATE &&
      type !== ConversationTypeEnum.GROUP &&
      type !== ConversationTypeEnum.GROUPV2
    ) {
      throw new TypeError(`'type' must be 'private' or 'group' or 'groupv2' but got: '${type}'`);
    }

    if (type === ConversationTypeEnum.GROUPV2 && !PubKey.is03Pubkey(id)) {
      throw new Error(
        'required v3 closed group but the pubkey does not match the 03 prefix for them'
      );
    }

    if (!this._initialFetchComplete) {
      throw new Error('ConvoHub.use().get() needs complete initial fetch');
    }
    const existing = this.getUnsafe(id);
    if (existing) {
      return existing;
    }

    const conversation = new ConversationModel({
      id,
      type,
    } as any);
    this.conversations.push(conversation);

    const create = async () => {
      try {
        // this saves to DB and to the required wrapper
        await conversation.commit();
      } catch (error) {
        window?.log?.error(
          'Conversation save failed! ',
          id,
          type,
          'Error:',
          error && error.stack ? error.stack : error
        );
        throw error;
      }

      window?.inboxStore?.dispatch(
        conversationActions.conversationAdded({
          id: conversation.id,
          data: conversation.getConversationModelProps(),
        })
      );

      return conversation;
    };

    conversation.initialPromise = create();

    return conversation;
  }

  public getNicknameOrRealUsernameOrPlaceholder(pubKey: string): string {
    const conversation = ConvoHub.use().get(pubKey);
    if (!conversation) {
      return PubKey.shorten(pubKey);
    }
    return conversation.getNicknameOrRealUsernameOrPlaceholder();
  }

  public async getOrCreateAndWait(
    id: string | PubKey,
    type: ConversationTypeEnum
  ): Promise<ConversationModel> {
    const convoHubInitialPromise =
      this._convoHubInitialPromise !== undefined ? this._convoHubInitialPromise : Promise.resolve();
    await convoHubInitialPromise;

    if (!id) {
      throw new Error('getOrCreateAndWait: invalid id passed.');
    }
    const pubkey = id && (id as any).key ? (id as any).key : id;
    const conversation = this.getOrCreate(pubkey, type);

    if (conversation) {
      return conversation.initialPromise.then(() => conversation);
    }

    return Promise.reject(new Error('getOrCreateAndWait: did not get conversation'));
  }

  /**
   * Usually, we want to mark private contact deleted as inactive (active_at = undefined).
   * That way we can still have the username and avatar for them, but they won't appear in search results etc.
   * For the blinded contact deletion though, we want to delete it completely because we merged it to an unblinded convo.
   */
  public async deleteBlindedContact(blindedId: string) {
    if (!this._initialFetchComplete) {
      throw new Error('ConvoHub.use().deleteBlindedContact() needs complete initial fetch');
    }
    if (!PubKey.isBlinded(blindedId)) {
      throw new Error('deleteBlindedContact allow accepts blinded id');
    }
    window.log.info(`deleteBlindedContact with ${blindedId}`);
    const conversation = this.getUnsafe(blindedId);
    if (!conversation) {
      window.log.warn(`deleteBlindedContact no such convo ${blindedId}`);
      return;
    }

    // we remove the messages left in this convo. The caller has to merge them if needed
    await deleteAllMessagesByConvoIdNoConfirmation(conversation.id);

    await conversation.setHidden(false);
    await conversation.commit();
  }

  public async deleteLegacyGroup(
    groupPk: PubkeyType,
    { sendLeaveMessage, fromSyncMessage }: DeleteOptions & { sendLeaveMessage: boolean }
  ) {
    if (!PubKey.is05Pubkey(groupPk)) {
      throw new PreConditionFailed('deleteLegacyGroup excepts a 05 group');
    }

    window.log.info(
      `deleteLegacyGroup: ${ed25519Str(groupPk)}, sendLeaveMessage:${sendLeaveMessage}, fromSyncMessage:${fromSyncMessage}`
    );

    // this deletes all messages in the conversation
    const conversation = await this.deleteConvoInitialChecks(groupPk, 'LegacyGroup', false);
    if (!conversation || !conversation.isClosedGroup()) {
      return;
    }
    // we don't need to keep polling anymore.
    getSwarmPollingInstance().removePubkey(groupPk, 'deleteLegacyGroup');

    await removeLegacyGroupFromWrappers(groupPk);

    // we never keep a left legacy group. Only fully remove it.
    await this.removeGroupOrCommunityFromDBAndRedux(groupPk);
  }

  public async deleteGroup(
    groupPk: GroupPubkeyType,
    {
      sendLeaveMessage,
      fromSyncMessage,
      deletionType,
      deleteAllMessagesOnSwarm,
      forceDestroyForAllMembers,
      clearFetchedHashes,
    }: DeleteOptions & {
      sendLeaveMessage: boolean;
      deletionType: 'doNotKeep' | 'keepAsKicked' | 'keepAsDestroyed';
      deleteAllMessagesOnSwarm: boolean;
      forceDestroyForAllMembers: boolean;
      clearFetchedHashes: boolean;
    }
  ) {
    if (!PubKey.is03Pubkey(groupPk)) {
      throw new PreConditionFailed('deleteGroup excepts a 03-group');
    }

    window.log.info(
      `deleteGroup: ${ed25519Str(groupPk)}, sendLeaveMessage:${sendLeaveMessage}, fromSyncMessage:${fromSyncMessage}, deletionType:${deletionType}, deleteAllMessagesOnSwarm:${deleteAllMessagesOnSwarm}, forceDestroyForAllMembers:${forceDestroyForAllMembers}, clearFetchedHashes:${clearFetchedHashes}`
    );

    // Keep the messages until we have effectively left the group (and managed to send our leave message)
    // because we have the "Leaving..." state (left pane) linked to the last message in conversation.
    const conversation = await this.deleteConvoInitialChecks(groupPk, 'Group', true);
    if (!conversation || !conversation.isClosedGroup()) {
      return;
    }
    // we don't need to keep polling anymore.
    getSwarmPollingInstance().removePubkey(groupPk, 'deleteGroup');

    const groupInUserGroup = await UserGroupsWrapperActions.getGroup(groupPk);

    // Let's check if we still have a MetaGroupWrapper for this group. If we don't we won't be able to do anything..
    let metaGroupWrapperExists = false;
    try {
      await MetaGroupWrapperActions.infoGet(groupPk);
      metaGroupWrapperExists = true;
    } catch {
      window.log.warn(`deleteGroup: MetaGroupWrapperActions for ${groupPk} does not exist.`);
    }

    // send the leave message before we delete everything for this group (including the key!)
    if (sendLeaveMessage && metaGroupWrapperExists) {
      const failedToSendLeaveMessage = await leaveClosedGroup(groupPk, fromSyncMessage);
      if (PubKey.is03Pubkey(groupPk) && failedToSendLeaveMessage) {
        // this is caught and is adding an interaction notification message
        throw new Error('Failed to send our leaving message to 03 group');
      }
    }

    // a group 03 can be removed fully or kept empty as kicked.
    // when it was pendingInvite, we delete it fully,
    // when it was not, we empty the group but keep it with the "you have been kicked" message
    // Note: the pendingInvite=true case cannot really happen as we wouldn't be polling from that group (and so, not get the message kicking us)
    if (deletionType === 'keepAsKicked' || deletionType === 'keepAsDestroyed') {
      // now that we know we've sent the leave message, delete any remaining messages
      await this.deleteConvoInitialChecks(groupPk, 'Group', false);

      // delete the secretKey/authData if we had it. If we need it for something, it has to be done before this call.
      if (groupInUserGroup) {
        groupInUserGroup.authData = null;
        groupInUserGroup.secretKey = null;
        groupInUserGroup.disappearingTimerSeconds = undefined;

        // we want to update the groupName in user group with whatever is in the groupInfo,
        // so even if the group is not polled anymore, we have an up to date name on restore.
        let nameInMetaGroup: string | undefined;
        try {
          const metaGroup = await MetaGroupWrapperActions.infoGet(groupPk);
          if (metaGroup && metaGroup.name && !isEmpty(metaGroup.name)) {
            nameInMetaGroup = metaGroup.name;
          }
        } catch (e) {
          // nothing to do
        }
        if (groupInUserGroup && nameInMetaGroup) {
          groupInUserGroup.name = nameInMetaGroup;
        }
        await UserGroupsWrapperActions.setGroup(groupInUserGroup);
        if (deletionType === 'keepAsKicked') {
          await UserGroupsWrapperActions.markGroupKicked(groupPk);
        } else {
          await UserGroupsWrapperActions.markGroupDestroyed(groupPk);
        }
      }
    } else {
      if (metaGroupWrapperExists) {
        let secretKey: Uint8Array | null = null;
        let weAreLastAdmin = false;
        // this is pretty ugly. We need to **try to check** if we are the last admin before we destroy.
        // That **try** is because we might not have the data we need to check that.
        // If we do manage to check it AND we are the last admin,
        // we mark the group as destroyed before destroying it locally.
        try {
          const us = UserUtils.getOurPubKeyStrFromCache();
          const allMembers = await MetaGroupWrapperActions.memberGetAll(groupPk);
          const otherAdminsCount = allMembers
            .filter(m => m.nominatedAdmin)
            .filter(m => m.pubkeyHex !== us).length;
          // check if we are the last admin
          weAreLastAdmin = otherAdminsCount === 0;
          const infos = await MetaGroupWrapperActions.infoGet(groupPk);
          const fromUserGroup = await UserGroupsWrapperActions.getGroup(groupPk);
          if (!infos || !fromUserGroup || isEmpty(infos) || isEmpty(fromUserGroup)) {
            window.log.debug(
              `deleteGroup: some required data not present for ${ed25519Str(groupPk)}: infos:${stringify(infos)} fromUserGroup:${stringify(fromUserGroup)}`
            );
            throw new Error('deleteGroup: some required data not present');
          }
          secretKey = fromUserGroup.secretKey;
        } catch (e) {
          window.log.info(
            `deleteGroup: initial checks failed with: ${e.message}. Considering this error as not important and deleting the group anyway.`
          );
        }
        try {
          if (secretKey && !isEmpty(secretKey) && (weAreLastAdmin || forceDestroyForAllMembers)) {
            const deleteAllMessagesSubRequest = deleteAllMessagesOnSwarm
              ? new DeleteAllFromGroupMsgNodeSubRequest({
                  groupPk,
                  secretKey,
                })
              : undefined;

            // this marks the group info as deleted. We need to push those details
            await MetaGroupWrapperActions.infoDestroy(groupPk);
            const lastPushResult = await GroupSync.pushChangesToGroupSwarmIfNeeded({
              groupPk,
              deleteAllMessagesSubRequest,
              extraStoreRequests: [],
              allow401s: false,
            });
            await LibSessionUtil.saveDumpsToDb(groupPk);

            if (lastPushResult !== RunJobResult.Success) {
              throw new Error(`Failed to destroyGroupDetails for pk ${ed25519Str(groupPk)}`);
            }
          }
        } catch (e) {
          // if that group was already freed this will happen.
          window.log.warn(
            `deleteGroup: MetaGroupWrapperActions failed with: ${e.message}... Keeping it as this should be a retryable error (we are admin case)`
          );
          throw e;
        }
      }
      // now that we know we've pushed the group as destroyed, destroy the group's messages locally
      await this.deleteConvoInitialChecks(groupPk, 'Group', false);

      // this deletes the secretKey if we had it. If we need it for something, it has to be done before this call.
      await UserGroupsWrapperActions.eraseGroup(groupPk);

      // we are on the emptyGroupButKeepAsKicked=false case, so we remove it all
      await this.removeGroupOrCommunityFromDBAndRedux(groupPk);
    }

    // We want to clear the lastHash and the seenHashes of the corresponding group.
    // We do this so that if we get reinvited to the group, we will
    //  fetch and display all the messages from the group's swarm again.
    if (clearFetchedHashes) {
      await this.resetLastHashesForConversation(groupPk);
    }

    await LibSessionUtil.saveDumpsToDb(UserUtils.getOurPubKeyStrFromCache());

    await SessionUtilConvoInfoVolatile.removeGroupFromWrapper(groupPk);
    // release the memory (and the current meta-dumps in memory for that group)
    window.log.info(`freeing meta group wrapper: ${ed25519Str(groupPk)}`);
    await MetaGroupWrapperActions.free(groupPk);
    // delete the dumps from the meta group state only, not the details in the UserGroups wrapper itself.
    await ConfigDumpData.deleteDumpFor(groupPk);
    getSwarmPollingInstance().removePubkey(groupPk, 'deleteGroup');

    window.inboxStore?.dispatch(groupInfoActions.removeGroupDetailsFromSlice({ groupPk }));
  }

  async resetLastHashesForConversation(groupPk: GroupPubkeyType) {
    window.log.info(`resetLastHashesForConversation for ${ed25519Str(groupPk)}`);
    await getSwarmPollingInstance().resetLastHashesForConversation(groupPk);
    await Data.emptySeenMessageHashesForConversation(groupPk);
  }

  public async deleteCommunity(convoId: string) {
    const conversation = await this.deleteConvoInitialChecks(convoId, 'Community', false);
    if (!conversation || !conversation.isPublic()) {
      return;
    }

    window?.log?.info('leaving community: ', conversation.id);
    const roomInfos = OpenGroupData.getV2OpenGroupRoom(conversation.id);
    if (roomInfos) {
      getOpenGroupManager().removeRoomFromPolledRooms(roomInfos);
    }
    await removeCommunityFromWrappers(conversation.id); // this call needs to fetch the pubkey
    await this.removeGroupOrCommunityFromDBAndRedux(conversation.id);
  }

  public async delete1o1(
    id: string,
    options: DeleteOptions & { justHidePrivate?: boolean; keepMessages: boolean }
  ) {
    const conversation = await this.deleteConvoInitialChecks(id, '1o1', options.keepMessages);

    if (!conversation || !conversation.isPrivate()) {
      return;
    }

    if (options.justHidePrivate || isNil(options.justHidePrivate) || conversation.isMe()) {
      // we just set the hidden field to true
      // so the conversation still exists (needed for that user's profile in groups) but is not shown on the list of conversation.
      // We also keep the messages for now, as turning a contact as hidden might just be a temporary thing
      window.log.info(`deleteContact isPrivate, marking as hidden: ${id}`);
      conversation.set({
        priority: CONVERSATION_PRIORITIES.hidden,
      });
      // We don't remove entries from the contacts wrapper, so better keep corresponding convo volatile info for now (it will be pruned if needed)
      await conversation.commit(); // this updates the wrappers content to reflect the hidden state
    } else {
      window.log.info(`deleteContact isPrivate, reset fields and removing from wrapper: ${id}`);

      await conversation.setHidden(false);
      await conversation.setIsApproved(false, false);
      await conversation.setDidApproveMe(false, false);
      await conversation.setNickname(null, false);

      conversation.setKey('active_at', 0);
      await BlockedNumberController.unblockAll([conversation.id]);
      await conversation.commit(); // first commit to DB so the DB knows about the changes
      if (SessionUtilContact.isContactToStoreInWrapper(conversation)) {
        window.log.warn('isContactToStoreInWrapper still true for ', conversation.attributes);
      }
      if (conversation.id.startsWith('05')) {
        // make sure to filter blinded contacts as it will throw otherwise
        await SessionUtilContact.removeContactFromWrapper(conversation.id); // then remove the entry altogether from the wrapper
        await SessionUtilConvoInfoVolatile.removeContactFromWrapper(conversation.id);
      }
      if (getCurrentlySelectedConversationOutsideRedux() === conversation.id) {
        window.inboxStore?.dispatch(resetConversationExternal());
      }
    }
  }

  /**
   *
   * @returns the reference of the list of conversations stored.
   * Warning: You should not edit things directly from that list. This must only be used for reading things.
   * If you need to make a change, do the usual ConvoHub.use().get('the id you want to edit')
   */
  public getConversations(): Array<ConversationModel> {
    return this.conversations;
  }

  public async load() {
    if (this.conversations.length) {
      throw new Error('ConversationController: Already loaded!');
    }

    const load = async () => {
      try {
        const startLoad = Date.now();

        const convoModels = await Data.getAllConversations();
        this.conversations.push(...convoModels);

        const start = Date.now();
        const numberOfVariants = LibSessionUtil.requiredUserVariants.length;
        for (let index = 0; index < convoModels.length; index++) {
          const convo = convoModels[index];
          for (let wrapperIndex = 0; wrapperIndex < numberOfVariants; wrapperIndex++) {
            const variant = LibSessionUtil.requiredUserVariants[wrapperIndex];

            switch (variant) {
              case 'UserConfig':
              case 'UserGroupsConfig':
                break;
              case 'ContactsConfig':
                if (SessionUtilContact.isContactToStoreInWrapper(convo)) {
                  await SessionUtilContact.refreshMappedValue(convo.id, true);
                }
                break;
              case 'ConvoInfoVolatileConfig':
                if (SessionUtilConvoInfoVolatile.isConvoToStoreInWrapper(convo)) {
                  await SessionUtilConvoInfoVolatile.refreshConvoVolatileCached(
                    convo.id,
                    Boolean(convo.isClosedGroup() && convo.id.startsWith('05')),
                    true
                  );

                  await convo.refreshInMemoryDetails();
                }
                break;

              default:
                assertUnreachable(
                  variant,
                  `ConversationController: load() unhandled case "${variant}"`
                );
            }
          }
        }
        window.log.info(`refreshAllWrappersMappedValues took ${Date.now() - start}ms`);

        this._initialFetchComplete = true;
        window?.log?.info(
          `ConversationController: done with initial fetch in ${Date.now() - startLoad}ms.`
        );
      } catch (error) {
        window?.log?.error(
          'ConversationController: initial fetch failed',
          error && error.stack ? error.stack : error
        );
        throw error;
      }
    };

    this._convoHubInitialPromise = load();

    return this._convoHubInitialPromise;
  }

  public loadPromise() {
    return this._convoHubInitialPromise;
  }

  public reset() {
    this._convoHubInitialPromise = Promise.resolve();
    this._initialFetchComplete = false;
    if (window?.inboxStore) {
      window.inboxStore?.dispatch(conversationActions.removeAllConversations());
    }
    this.conversations = [];
  }

  private async deleteConvoInitialChecks(
    convoId: string,
    deleteType: ConvoVolatileType,
    keepMessages: boolean
  ) {
    if (!this._initialFetchComplete) {
      throw new Error(`ConvoHub.${deleteType}  needs complete initial fetch`);
    }

    window.log.info(`deleteConvoInitialChecks: type ${deleteType} with ${ed25519Str(convoId)}`);

    const conversation = this.getUnsafe(convoId);
    if (!conversation) {
      window.log.warn(`${deleteType} no such convo ${ed25519Str(convoId)}`);
      return null;
    }

    // Note in some cases (hiding a conversation) we don't want to delete the messages
    if (!keepMessages) {
      // those are the stuff to do for all conversation types
      window.log.info(`${deleteType} destroyingMessages: ${ed25519Str(convoId)}`);
      await deleteAllMessagesByConvoIdNoConfirmation(convoId);
      window.log.info(`${deleteType} messages destroyed: ${ed25519Str(convoId)}`);
    }

    return conversation;
  }

  private async removeGroupOrCommunityFromDBAndRedux(convoId: string) {
    window.log.info(`cleanUpGroupConversation, removing convo from DB: ${ed25519Str(convoId)}`);
    // not a private conversation, so not a contact for the ContactWrapper
    await Data.removeConversation(convoId);

    // remove the data from the opengroup rooms table too if needed
    if (convoId && OpenGroupUtils.isOpenGroupV2(convoId)) {
      // remove the roomInfos locally for this open group room including the pubkey
      try {
        await OpenGroupData.removeV2OpenGroupRoom(convoId);
      } catch (e) {
        window?.log?.info('removeV2OpenGroupRoom failed:', e);
      }
    }

    window.log.info(`cleanUpGroupConversation, convo removed from DB: ${ed25519Str(convoId)}`);
    const conversation = this.getUnsafe(convoId);

    if (conversation) {
      const foundAt = this.conversations.findIndex(m => m.id === conversation.id);
      if (foundAt >= 0) {
        this.conversations.splice(foundAt, 1);
      }

      window?.inboxStore?.dispatch(
        conversationActions.conversationsChanged([conversation.getConversationModelProps()])
      );
    }
    window.inboxStore?.dispatch(conversationActions.conversationRemoved(convoId));

    window.log.info(`cleanUpGroupConversation, convo removed from store: ${ed25519Str(convoId)}`);
  }
}

/**
 * You most likely don't want to call this function directly, but instead use the deleteLegacyGroup()
 * from the ConversationController as it will take care of more cleaning up.
 * This throws if a leaveMessage needs to be sent, but fails to be sent.
 *
 * Note: `fromSyncMessage` is used to know if we need to send a leave group message to the group first.
 * So if the user made the action on this device, fromSyncMessage should be false, but if it happened from a linked device polled update, set this to true.
 *
 * @returns true if the message failed to be sent.
 */
async function leaveClosedGroup(groupPk: GroupPubkeyType, fromSyncMessage: boolean) {
  const convo = ConvoHub.use().get(groupPk);

  if (!convo || !convo.isClosedGroup()) {
    window?.log?.error('Cannot leave non-existing group');
    return false;
  }

  const ourNumber = UserUtils.getOurPubKeyStrFromCache();
  const isCurrentUserAdmin = convo.weAreAdminUnblinded();

  let members: Array<string> = [];
  let admins: Array<string> = [];

  // if we are the admin, the group must be destroyed for every members
  if (isCurrentUserAdmin) {
    window?.log?.info('Admin left a closed group. We need to destroy it');
    convo.set({ left: true });
    members = [];
    admins = [];
  } else {
    // otherwise, just the exclude ourself from the members and trigger an update with this
    convo.set({ left: true });
    members = (convo.getGroupMembers() || []).filter((m: string) => m !== ourNumber);
    admins = convo.getGroupAdmins();
  }
  convo.set({ members });
  await convo.updateGroupAdmins(admins, false);
  await convo.commit();

  getSwarmPollingInstance().removePubkey(groupPk, 'leaveClosedGroup');

  if (fromSyncMessage) {
    // no need to send our leave message as our other device should already have sent it.
    return false;
  }

  if (!PubKey.is03Pubkey(groupPk)) {
    window.log.warn('Legacy groups support has been dropped');
    return null;
  }

  const group = await UserGroupsWrapperActions.getGroup(groupPk);
  if (!group || (!group.secretKey && !group.authData)) {
    throw new Error('leaveClosedGroup: group from UserGroupsWrapperActions is null ');
  }
  const createAtNetworkTimestamp = NetworkTime.now();
  // Send the update to the 03 group
  const ourLeavingMessage = new GroupUpdateMemberLeftMessage({
    createAtNetworkTimestamp: createAtNetworkTimestamp + 1, // we just need it to be different than the one of ourLeavingNotificationMessage
    groupPk,
    expirationType: 'unknown', // we keep that one **not** expiring
    expireTimer: 0,
  });

  const ourLeavingNotificationMessage = new GroupUpdateMemberLeftNotificationMessage({
    createAtNetworkTimestamp,
    groupPk,
    ...DisappearingMessages.getExpireDetailsForOutgoingMessage(convo, createAtNetworkTimestamp), // this one should be expiring with the convo expiring details
  });

  window?.log?.info(
    `We are leaving the group ${ed25519Str(groupPk)}. Sending our leaving messages.`
  );
  let failedToSent03LeaveMessage = true;
  // We might not be able to send our leaving messages (no encryption key pair, we were already removed, no network, etc).
  // If that happens, we should just remove everything from our current user.
  try {
    const storeRequests = await StoreGroupRequestFactory.makeGroupMessageSubRequest(
      [ourLeavingNotificationMessage, ourLeavingMessage],
      {
        authData: group.authData,
        secretKey: group.secretKey,
      }
    );
    const controller = new AbortController();
    const results = await timeoutWithAbort(
      MessageSender.sendEncryptedDataToSnode({
        destination: groupPk,
        sortedSubRequests: storeRequests,
        method: 'sequence',
        abortSignal: controller.signal,
        allow401s: true, // we want "allow" 401s so we don't throw
      }),
      30 * DURATION.SECONDS,
      controller
    );

    if (results?.[0].code === 401) {
      window.log.info(
        `leaveClosedGroup for ${ed25519Str(groupPk)} failed with 401. Assuming we've been revoked.`
      );
    } else if (results?.[0].code !== 200) {
      throw new Error(
        `Even with the retries, leaving message for group ${ed25519Str(
          groupPk
        )} failed to be sent...`
      );
    }
    failedToSent03LeaveMessage = false;
  } catch (e) {
    window?.log?.warn(
      `failed to send our leaving messages for ${ed25519Str(groupPk)}:${e.message}`
    );
  }

  // the rest of the cleaning of that conversation is done in the `deleteClosedGroup()`

  return failedToSent03LeaveMessage;
}

async function removeLegacyGroupFromWrappers(groupId: string) {
  getSwarmPollingInstance().removePubkey(groupId, 'removeLegacyGroupFromWrappers');

  await UserGroupsWrapperActions.eraseLegacyGroup(groupId);
  await SessionUtilConvoInfoVolatile.removeLegacyGroupFromWrapper(groupId);
}

async function removeCommunityFromWrappers(conversationId: string) {
  if (!conversationId || !OpenGroupUtils.isOpenGroupV2(conversationId)) {
    return;
  }
  try {
    const fromWrapper = await UserGroupsWrapperActions.getCommunityByFullUrl(conversationId);
    if (fromWrapper?.fullUrlWithPubkey) {
      await SessionUtilConvoInfoVolatile.removeCommunityFromWrapper(
        conversationId,
        fromWrapper.fullUrlWithPubkey
      );
    }
  } catch (e) {
    window?.log?.info('SessionUtilConvoInfoVolatile.removeCommunityFromWrapper failed:', e.message);
  }

  // remove from the wrapper the entries before we remove the roomInfos, as we won't have the required community pubkey afterwards
  try {
    await SessionUtilUserGroups.removeCommunityFromWrapper(conversationId, conversationId);
  } catch (e) {
    window?.log?.info('SessionUtilUserGroups.removeCommunityFromWrapper failed:', e.message);
  }
}

export const ConvoHub = { use: getConvoHub };
