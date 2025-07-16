/* eslint-disable no-await-in-loop */
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  GroupInfoGet,
  GroupPubkeyType,
  PubkeyType,
  UserGroupsGet,
  WithGroupPubkey,
} from 'libsession_util_nodejs';
import { concat, intersection, isEmpty, isNil, uniq } from 'lodash';
import { from_hex } from 'libsodium-wrappers-sumo';
import { ConfigDumpData } from '../../data/configDump/configDump';
import { HexString } from '../../node/hexStrings';
import { SignalService } from '../../protobuf';
import { getSwarmPollingInstance } from '../../session/apis/snode_api';
import { StoreGroupRequestFactory } from '../../session/apis/snode_api/factories/StoreGroupRequestFactory';
import { ConvoHub } from '../../session/conversations';
import { getSodiumRenderer } from '../../session/crypto';
import { DisappearingMessages } from '../../session/disappearing_messages';
import { ClosedGroup } from '../../session/group/closed-group';
import { GroupUpdateInfoChangeMessage } from '../../session/messages/outgoing/controlMessage/group_v2/to_group/GroupUpdateInfoChangeMessage';
import { GroupUpdateMemberChangeMessage } from '../../session/messages/outgoing/controlMessage/group_v2/to_group/GroupUpdateMemberChangeMessage';
import { PubKey } from '../../session/types';
import { ToastUtils, UserUtils } from '../../session/utils';
import { PreConditionFailed } from '../../session/utils/errors';
import { GroupInvite } from '../../session/utils/job_runners/jobs/GroupInviteJob';
import { GroupPendingRemovals } from '../../session/utils/job_runners/jobs/GroupPendingRemovalsJob';
import { GroupSync } from '../../session/utils/job_runners/jobs/GroupSyncJob';
import { RunJobResult } from '../../session/utils/job_runners/PersistedJob';
import { LibSessionUtil } from '../../session/utils/libsession/libsession_utils';
import { ed25519Str } from '../../session/utils/String';
import { getUserED25519KeyPairBytes } from '../../session/utils/User';
import { stringify, toFixedUint8ArrayOfLength } from '../../types/sqlSharedTypes';
import {
  getGroupPubkeyFromWrapperType,
  isMetaGroupWrapperType,
} from '../../webworker/workers/browser/libsession_worker_functions';
import {
  MetaGroupWrapperActions,
  UserGroupsWrapperActions,
} from '../../webworker/workers/browser/libsession_worker_interface';
import { StateType } from '../reducer';
import { openConversationWithMessages } from './conversations';
import { ConversationTypeEnum } from '../../models/types';
import { NetworkTime } from '../../util/NetworkTime';
import { GroupUpdateMessageFactory } from '../../session/messages/message_factory/group/groupUpdateMessageFactory';
import {
  WithAddWithHistoryMembers,
  WithAddWithoutHistoryMembers,
  WithFromMemberLeftMessage,
  WithRemoveMembers,
} from '../../session/types/with';
import { updateEditProfilePictureModal, updateGroupNameModal } from './modalDialog';
import { localize } from '../../localization/localeTools';
import { type GroupMemberGetRedux, makeGroupMemberGetRedux } from './types/groupReduxTypes';
import { uploadFileToFsWithOnionV4 } from '../../session/apis/file_server_api/FileServerApi';
import { urlToBlob } from '../../types/attachments/VisualAttachment';
import { encryptProfile } from '../../util/crypto/profileEncrypter';
import { processNewAttachment } from '../../types/MessageAttachment';
import { MIME } from '../../types';
import type { StoreGroupMessageSubRequest } from '../../session/apis/snode_api/SnodeRequestTypes';
import { sectionActions } from './section';

export type GroupState = {
  infos: Record<GroupPubkeyType, GroupInfoGet>;
  members: Record<GroupPubkeyType, Array<GroupMemberGetRedux>>;
  memberChangesFromUIPending: boolean;
  nameChangesFromUIPending: boolean;
  avatarChangeFromUIPending: boolean;

  // those are group creation-related fields
  creationFromUIPending: boolean;
  creationMembersSelected: Array<PubkeyType>;
  creationGroupName: string;
};

export const initialGroupState: GroupState = {
  infos: {},
  members: {},
  creationFromUIPending: false,
  memberChangesFromUIPending: false,
  nameChangesFromUIPending: false,
  avatarChangeFromUIPending: false,
  creationMembersSelected: [],
  creationGroupName: '',
};

type GroupDetailsUpdate = {
  groupPk: GroupPubkeyType;
  infos: GroupInfoGet;
  members: Array<GroupMemberGetRedux>;
};

async function checkWeAreAdmin(groupPk: GroupPubkeyType) {
  const us = UserUtils.getOurPubKeyStrFromCache();
  const usInGroup = await MetaGroupWrapperActions.memberGet(groupPk, us);
  const inUserGroup = UserGroupsWrapperActions.getCachedGroup(groupPk);
  // if the secretKey is not empty AND we are a member of the group, we are a current admin
  return Boolean(!isEmpty(inUserGroup?.secretKey) && usInGroup?.nominatedAdmin);
}

async function checkWeAreAdminOrThrow(groupPk: GroupPubkeyType, context: string) {
  const areWeAdmin = await checkWeAreAdmin(groupPk);
  if (!areWeAdmin) {
    throw new Error(`checkWeAreAdminOrThrow failed with ctx: ${context}`);
  }
}

/**
 * Create a brand new group with a 03 prefix.
 * To be called only when our current logged in user, through the UI, creates a brand new closed group given a name and a list of members.
 *
 */
const initNewGroupInWrapper = createAsyncThunk(
  'group/initNewGroupInWrapper',
  async (
    {
      groupName,
      members,
      us,
      inviteAsAdmin,
    }: {
      groupName: string;
      members: Array<string>;
      us: string;
      inviteAsAdmin: boolean;
    },
    { dispatch }
  ): Promise<GroupDetailsUpdate> => {
    if (!members.includes(us)) {
      throw new PreConditionFailed('initNewGroupInWrapper needs us to be a member');
    }
    if (members.some(k => !PubKey.is05Pubkey(k))) {
      throw new PreConditionFailed('initNewGroupInWrapper only works with members being pubkeys');
    }
    const uniqMembers = uniq(members) as Array<PubkeyType>; // the if just above ensures that this is fine
    const newGroup = await UserGroupsWrapperActions.createGroup();
    const groupPk = newGroup.pubkeyHex;

    try {
      const groupSecretKey = newGroup.secretKey;
      if (!groupSecretKey) {
        throw new Error('groupSecretKey was empty just after creation.');
      }
      newGroup.name = groupName; // this will be used by the linked devices until they fetch the info from the groups swarm
      newGroup.joinedAtSeconds = Math.floor(Date.now() / 1000);
      // the `GroupSync` below will need the secretKey of the group to be saved in the wrapper. So save it!
      await UserGroupsWrapperActions.setGroup(newGroup);
      const ourEd25519KeyPairBytes = await UserUtils.getUserED25519KeyPairBytes();
      if (!ourEd25519KeyPairBytes) {
        throw new Error('Current user has no priv ed25519 key?');
      }
      const userEd25519SecretKey = ourEd25519KeyPairBytes.privKeyBytes;
      const groupEd2519Pk = HexString.fromHexString(groupPk).slice(1); // remove the 03 prefix (single byte once in hex form)

      // dump is always empty when creating a new groupInfo
      await MetaGroupWrapperActions.init(groupPk, {
        metaDumped: null,
        userEd25519Secretkey: toFixedUint8ArrayOfLength(userEd25519SecretKey, 64).buffer,
        groupEd25519Secretkey: newGroup.secretKey,
        groupEd25519Pubkey: toFixedUint8ArrayOfLength(groupEd2519Pk, 32).buffer,
      });

      const infos = await MetaGroupWrapperActions.infoGet(groupPk);
      if (!infos) {
        throw new Error(`getInfos of ${groupPk} returned empty result even if it was just init.`);
      }
      // if the name exceeds libsession-util max length for group name, the name will be saved truncated
      infos.name = groupName;
      await MetaGroupWrapperActions.infoSet(groupPk, infos);

      for (let index = 0; index < uniqMembers.length; index++) {
        const member = uniqMembers[index];
        const convoMember = ConvoHub.use().get(member);
        const displayName = convoMember?.getRealSessionUsername() || null;
        const profileKeyHex = convoMember?.getProfileKey() || null;
        const avatarUrl = convoMember?.getAvatarPointer() || null;

        // we just create the members in the state. Their invite state defaults to NOT_SENT,
        // which will make our logic kick in to send them an invite in the `GroupInviteJob`
        await LibSessionUtil.createMemberAndSetDetails({
          avatarUrl,
          displayName,
          groupPk,
          memberPubkey: member,
          profileKeyHex,
        });

        if (member === us) {
          // we need to explicitly mark us as having accepted the promotion
          await MetaGroupWrapperActions.memberSetPromotionAccepted(groupPk, member);
        }
      }

      const membersFromWrapper = await MetaGroupWrapperActions.memberGetAll(groupPk);
      if (!membersFromWrapper || isEmpty(membersFromWrapper)) {
        throw new Error(
          `memberGetAll of ${groupPk} returned empty result even if it was just init.`
        );
      }
      // now that we've added members to the group, make sure to make a full key rotation
      // to include them and marks the corresponding wrappers as dirty
      await MetaGroupWrapperActions.keyRekey(groupPk);

      const convo = await ConvoHub.use().getOrCreateAndWait(groupPk, ConversationTypeEnum.GROUPV2);
      await convo.setIsApproved(true, false);
      await convo.commit(); // commit here too, as the poll needs it to be approved
      let groupMemberChange: GroupUpdateMemberChangeMessage | null = null;
      // push one group change message where initial members are added to the group
      if (membersFromWrapper.length) {
        const membersHex = uniq(membersFromWrapper.map(m => m.pubkeyHex));

        const membersHexWithoutUs = membersHex.filter(m => m !== us);
        const sentAt = NetworkTime.now();
        const msgModel = await ClosedGroup.addUpdateMessage({
          diff: { type: 'add', added: membersHexWithoutUs, withHistory: false },
          expireUpdate: null,
          sender: us,
          sentAt,
          convo,
          markAlreadySent: false, // the store below will mark the message as sent with dbMsgIdentifier
          messageHash: null,
        });
        groupMemberChange = await GroupUpdateMessageFactory.getWithoutHistoryControlMessage({
          adminSecretKey: groupSecretKey,
          convo,
          groupPk,
          withoutHistory: membersHexWithoutUs,
          createAtNetworkTimestamp: sentAt,
          dbMsgIdentifier: msgModel.id,
        });
      }

      const extraStoreRequests = await StoreGroupRequestFactory.makeGroupMessageSubRequest(
        [groupMemberChange],
        { authData: null, secretKey: newGroup.secretKey }
      );

      const result = await GroupSync.pushChangesToGroupSwarmIfNeeded({
        groupPk,
        extraStoreRequests,
        allow401s: false,
      });
      if (result !== RunJobResult.Success) {
        window.log.warn('GroupSync.pushChangesToGroupSwarmIfNeeded during create failed');
        throw new Error('failed to pushChangesToGroupSwarmIfNeeded');
      }

      await convo.commit();

      getSwarmPollingInstance().addGroupId(new PubKey(groupPk));

      await convo.unhideIfNeeded();
      convo.set({ active_at: Date.now() });
      await convo.commit();
      convo.updateLastMessage();
      dispatch(sectionActions.resetLeftOverlayMode());

      // Everything is setup for this group, we now need to send the invites to each members,
      // privately and asynchronously, and gracefully handle errors with toasts.
      // Let's do all of this part of a job to handle app crashes and make sure we
      //  can update the group wrapper with a failed state if a message fails to be sent.
      await scheduleGroupInviteJobs(
        groupPk,
        membersFromWrapper.map(m => m.pubkeyHex),
        [],
        inviteAsAdmin
      );

      await openConversationWithMessages({ conversationKey: groupPk, messageId: null });

      return { groupPk: newGroup.pubkeyHex, infos, members: membersFromWrapper };
    } catch (e) {
      window.log.warn('group creation failed. Deleting already saved data: ', e.message);
      await UserGroupsWrapperActions.eraseGroup(groupPk);
      await MetaGroupWrapperActions.infoDestroy(groupPk);
      const foundConvo = ConvoHub.use().get(groupPk);
      if (foundConvo) {
        await ConvoHub.use().deleteGroup(groupPk, {
          fromSyncMessage: false,
          sendLeaveMessage: false,
          deletionType: 'doNotKeep',
          deleteAllMessagesOnSwarm: false,
          forceDestroyForAllMembers: false,
          clearFetchedHashes: true,
        });
      }
      ToastUtils.pushToastError('groupCreateFailed', localize('groupErrorCreate').toString());
      throw e;
    }
  }
);

/**
 * Create a brand new group with a 03 prefix.
 * To be called only when our current logged in user, through the UI, creates a brand new closed group given a name and a list of members.
 *
 */
const handleUserGroupUpdate = createAsyncThunk(
  'group/handleUserGroupUpdate',
  async (userGroup: UserGroupsGet, payloadCreator): Promise<GroupDetailsUpdate> => {
    // if we already have a state for that group here, it means that group was already init, and the data should come from the groupInfos after.
    const state = payloadCreator.getState() as StateType;
    const groupPk = userGroup.pubkeyHex;
    if (state.groups.infos[groupPk] && state.groups.members[groupPk]) {
      const infos = await MetaGroupWrapperActions.infoGet(groupPk);
      const members = await MetaGroupWrapperActions.memberGetAll(groupPk);
      window.log.info(
        `handleUserGroupUpdate group ${ed25519Str(groupPk)} already present in redux slice`,
        infos,
        members
      );
      return {
        groupPk,
        infos,
        members,
      };
    }

    const ourEd25519KeyPairBytes = await UserUtils.getUserED25519KeyPairBytes();
    if (!ourEd25519KeyPairBytes) {
      throw new Error('Current user has no priv ed25519 key?');
    }
    const userEd25519SecretKey = ourEd25519KeyPairBytes.privKeyBytes;
    const groupEd2519Pk = HexString.fromHexString(groupPk).slice(1); // remove the 03 prefix (single byte once in hex form)

    // dump is always empty when creating a new groupInfo
    try {
      await MetaGroupWrapperActions.init(groupPk, {
        metaDumped: null,
        userEd25519Secretkey: toFixedUint8ArrayOfLength(userEd25519SecretKey, 64).buffer,
        groupEd25519Secretkey: userGroup.secretKey,
        groupEd25519Pubkey: toFixedUint8ArrayOfLength(groupEd2519Pk, 32).buffer,
      });
    } catch (e) {
      window.log.warn(`failed to init meta wrapper ${groupPk}`);
    }

    const convo = await ConvoHub.use().getOrCreateAndWait(groupPk, ConversationTypeEnum.GROUPV2);

    // a group is approved when its invitePending is false, and false otherwise
    await convo.setIsApproved(!userGroup.invitePending, false);

    await convo.setPriorityFromWrapper(userGroup.priority, false);

    if (!convo.isActive()) {
      convo.set({
        active_at: Date.now(),
      });
    }

    convo.set({
      displayNameInProfile: userGroup.name || undefined,
    });

    await convo.commit();

    return {
      groupPk,
      infos: await MetaGroupWrapperActions.infoGet(groupPk),
      members: await MetaGroupWrapperActions.memberGetAll(groupPk),
    };
  }
);

/**
 * Called only when the app just loaded the SessionInbox (i.e. user logged in and fully loaded).
 * This function populates the slice with any meta-dumps we have in the DB, if they also are part of what is the user group wrapper tracking.
 *
 */
const loadMetaDumpsFromDB = createAsyncThunk(
  'group/loadMetaDumpsFromDB',
  async (): Promise<Array<GroupDetailsUpdate>> => {
    const ed25519KeyPairBytes = await getUserED25519KeyPairBytes();
    if (!ed25519KeyPairBytes?.privKeyBytes) {
      throw new Error('user has no ed25519KeyPairBytes.');
    }

    const variantsWithData = await ConfigDumpData.getAllDumpsWithData();
    const allUserGroups = await UserGroupsWrapperActions.getAllGroups();
    const toReturn: Array<GroupDetailsUpdate> = [];
    for (let index = 0; index < variantsWithData.length; index++) {
      const { variant, data } = variantsWithData[index];
      if (!isMetaGroupWrapperType(variant)) {
        continue;
      }
      const groupPk = getGroupPubkeyFromWrapperType(variant);
      const groupEd25519Pubkey = HexString.fromHexString(groupPk.substring(2));
      const foundInUserWrapper = allUserGroups.find(m => m.pubkeyHex === groupPk);
      if (!foundInUserWrapper) {
        try {
          window.log.info(
            'metaGroup not found in userGroups. Deleting the corresponding dumps:',
            groupPk
          );

          await ConfigDumpData.deleteDumpFor(groupPk);
        } catch (e) {
          window.log.warn(`ConfigDumpData.deleteDumpFor for ${groupPk} failed with `, e.message);
        }
        continue;
      }

      try {
        window.log.debug('loadMetaDumpsFromDB init from meta group dump', variant);

        await MetaGroupWrapperActions.init(groupPk, {
          groupEd25519Pubkey: toFixedUint8ArrayOfLength(groupEd25519Pubkey, 32).buffer,
          groupEd25519Secretkey: foundInUserWrapper?.secretKey || null,
          userEd25519Secretkey: toFixedUint8ArrayOfLength(ed25519KeyPairBytes.privKeyBytes, 64)
            .buffer,
          metaDumped: data,
        });

        // If we were sending to that member an invite/promote, we won't auto retry.
        // We need to reset the sending state (on load from disk) so that the user can resend manually if needed
        await MetaGroupWrapperActions.memberResetAllSendingState(groupPk);

        const infos = await MetaGroupWrapperActions.infoGet(groupPk);
        const members = (await MetaGroupWrapperActions.memberGetAll(groupPk)).map(
          makeGroupMemberGetRedux
        );

        toReturn.push({ groupPk, infos, members });
      } catch (e) {
        // Note: Don't rethrow here, we want to load everything we can
        window.log.error(
          `initGroup of Group wrapper of variant ${variant} failed with ${e.message} `
        );
      }
    }

    return toReturn;
  }
);

/**
 * This action is to be called when we get a merge event from the network.
 * It refreshes the state of that particular group (info & members) with the state from the wrapper after the merge is done.
 */
const refreshGroupDetailsFromWrapper = createAsyncThunk(
  'group/refreshGroupDetailsFromWrapper',
  async ({
    groupPk,
  }: {
    groupPk: GroupPubkeyType;
  }): Promise<
    GroupDetailsUpdate | ({ groupPk: GroupPubkeyType } & Partial<GroupDetailsUpdate>)
  > => {
    try {
      const infos = await MetaGroupWrapperActions.infoGet(groupPk);
      const members = await MetaGroupWrapperActions.memberGetAll(groupPk);

      if (window.sessionFeatureFlags.debug.debugLibsessionDumps) {
        window.log.info(
          `groupInfo of ${ed25519Str(groupPk)} after refreshGroupDetailsFromWrapper: ${stringify(infos)}`
        );
        window.log.info(
          `groupMembers of ${ed25519Str(groupPk)} after refreshGroupDetailsFromWrapper: ${stringify(members)}`
        );
      }
      return { groupPk, infos, members };
    } catch (e) {
      window.log.warn('refreshGroupDetailsFromWrapper failed with ', e.message);
      return { groupPk };
    }
  }
);

function validateMemberAddChange({
  groupPk,
  withHistory: addMembersWithHistory,
  withoutHistory: addMembersWithoutHistory,
}: WithGroupPubkey & WithAddWithoutHistoryMembers & WithAddWithHistoryMembers) {
  const us = UserUtils.getOurPubKeyStrFromCache();
  if (addMembersWithHistory.includes(us) || addMembersWithoutHistory.includes(us)) {
    throw new PreConditionFailed(
      'currentDeviceGroupMembersChange cannot be used for changes of our own state in the group'
    );
  }

  const withHistory = uniq(addMembersWithHistory);
  const withoutHistory = uniq(addMembersWithoutHistory);
  const convo = ConvoHub.use().get(groupPk);
  if (!convo) {
    throw new PreConditionFailed('currentDeviceGroupMembersChange convo not present in convo hub');
  }
  if (intersection(withHistory, withoutHistory).length) {
    throw new Error(
      'withHistory and withoutHistory can only have values which are not in the other'
    );
  }

  return { withoutHistory, withHistory, us, convo };
}

function validateMemberRemoveChange({
  groupPk,
  removed: removeMembers,
}: WithGroupPubkey & WithRemoveMembers) {
  const us = UserUtils.getOurPubKeyStrFromCache();
  if (removeMembers.includes(us)) {
    throw new PreConditionFailed(
      'currentDeviceGroupMembersChange cannot be used for changes of our own state in the group'
    );
  }

  const removed = uniq(removeMembers);
  const convo = ConvoHub.use().get(groupPk);
  if (!convo) {
    throw new PreConditionFailed('currentDeviceGroupMembersChange convo not present in convo hub');
  }

  return { removed, us, convo };
}

function validateNameChange({
  groupPk,
  newName,
  currentName,
  currentDescription,
  newDescription,
}: WithGroupPubkey & {
  newName: string;
  currentName: string;
  currentDescription: string;
  newDescription: string;
}) {
  const us = UserUtils.getOurPubKeyStrFromCache();
  if (!newName || isEmpty(newName)) {
    throw new PreConditionFailed('validateNameChange needs a non empty name');
  }

  const convo = ConvoHub.use().get(groupPk);
  if (!convo) {
    throw new PreConditionFailed('validateNameChange convo not present in convo hub');
  }
  if (newName === currentName && newDescription === currentDescription) {
    throw new PreConditionFailed('validateNameChange no name/description change detected');
  }

  return { newName, newDescription, us, convo };
}

/**
 * Update the GROUP_MEMBER wrapper state to have those members.
 * @returns the supplementalKeys to be pushed
 */
async function handleWithHistoryMembers({
  groupPk,
  withHistory,
}: WithGroupPubkey & {
  withHistory: Array<PubkeyType>;
}) {
  for (let index = 0; index < withHistory.length; index++) {
    const member = withHistory[index];

    const convoMember = ConvoHub.use().get(member);
    const displayName = convoMember?.getRealSessionUsername() || null;
    const profileKeyHex = convoMember?.getProfileKey() || null;
    const avatarUrl = convoMember?.getAvatarPointer() || null;

    await LibSessionUtil.createMemberAndSetDetails({
      avatarUrl,
      displayName,
      groupPk,
      memberPubkey: member,
      profileKeyHex,
    });
    // a group invite job will be added to the queue
    await MetaGroupWrapperActions.memberSetInviteNotSent(groupPk, member);
    await MetaGroupWrapperActions.memberSetSupplement(groupPk, member);
    // update the in-memory failed state, so that if we fail again to send that invite, the toast is shown again
    GroupInvite.debounceFailedStateForMember(groupPk, member, false);
  }
  const encryptedSupplementKeys = withHistory.length
    ? await MetaGroupWrapperActions.generateSupplementKeys(groupPk, withHistory)
    : null;

  return encryptedSupplementKeys;
}

/**
 * Update the GROUP_MEMBER wrapper state to have those members.
 * Does not call `rekey()` so you need to call it from the caller.
 */
async function handleWithoutHistoryMembers({
  groupPk,
  withoutHistory,
}: WithGroupPubkey & WithAddWithoutHistoryMembers) {
  for (let index = 0; index < withoutHistory.length; index++) {
    const member = withoutHistory[index];
    const convoMember = ConvoHub.use().get(member);
    const displayName = convoMember?.getRealSessionUsername() || null;
    const profileKeyHex = convoMember?.getProfileKey() || null;
    const avatarUrl = convoMember?.getAvatarPointer() || null;

    await LibSessionUtil.createMemberAndSetDetails({
      groupPk,
      memberPubkey: member,
      avatarUrl,
      displayName,
      profileKeyHex,
    });
    // a group invite job will be added to the queue
    await MetaGroupWrapperActions.memberSetInviteNotSent(groupPk, member);
  }
}

async function handleMemberAddedFromUI({
  addMembersWithHistory,
  addMembersWithoutHistory,
  groupPk,
}: WithGroupPubkey & {
  addMembersWithHistory: Array<PubkeyType>;
  addMembersWithoutHistory: Array<PubkeyType>;
}) {
  const group = await UserGroupsWrapperActions.getGroup(groupPk);
  if (!group || !group.secretKey || isEmpty(group.secretKey)) {
    throw new Error('tried to make change to group but we do not have the admin secret key');
  }

  await checkWeAreAdminOrThrow(groupPk, 'handleMemberAddedFromUI');

  const { withHistory, withoutHistory, convo, us } = validateMemberAddChange({
    withHistory: addMembersWithHistory,
    withoutHistory: addMembersWithoutHistory,
    groupPk,
  });
  // first, get the unrevoke requests for people who are added
  const { revokeSubRequest, unrevokeSubRequest } =
    await GroupPendingRemovals.getPendingRevokeParams({
      groupPk,
      withHistory,
      withoutHistory,
      removed: [],
      secretKey: group.secretKey,
    });

  // then, handle the addition with history of messages by generating supplement keys.
  // this adds them to the members wrapper etc
  const encryptedSupplementKeys = await handleWithHistoryMembers({ groupPk, withHistory });

  const supplementalKeysSubRequest = StoreGroupRequestFactory.makeStoreGroupKeysSubRequest({
    group,
    encryptedSupplementKeys,
  });

  // then handle the addition without history of messages (full rotation of keys).
  // this adds them to the members wrapper etc
  await handleWithoutHistoryMembers({ groupPk, withoutHistory });

  if (withHistory.length || withoutHistory.length) {
    // We now always want to call rekey(), even if only a supplemental key was needed.
    // This is to take care of an edge case where a user is reinvited but considers himself kicked.
    // See SES3299
    await MetaGroupWrapperActions.keyRekey(groupPk);
  }
  const createAtNetworkTimestamp = NetworkTime.now();

  await LibSessionUtil.saveDumpsToDb(groupPk);

  const expireDetails = DisappearingMessages.getExpireDetailsForOutgoingMessage(
    convo,
    createAtNetworkTimestamp
  );
  const shared = {
    convo,
    sender: us,
    sentAt: createAtNetworkTimestamp,
    expireUpdate: expireDetails,
    markAlreadySent: false, // the store below will mark the message as sent with dbMsgIdentifier
    messageHash: null,
  };
  const updateMessagesToPush: Array<GroupUpdateMemberChangeMessage> = [];
  if (withHistory.length) {
    const msgModel = await ClosedGroup.addUpdateMessage({
      diff: { type: 'add', added: withHistory, withHistory: true },
      ...shared,
    });
    const groupChange = await GroupUpdateMessageFactory.getWithHistoryControlMessage({
      adminSecretKey: group.secretKey,
      convo,
      groupPk,
      withHistory,
      createAtNetworkTimestamp,
      dbMsgIdentifier: msgModel.id,
    });
    if (groupChange) {
      updateMessagesToPush.push(groupChange);
    }
  }
  if (withoutHistory.length) {
    const msgModel = await ClosedGroup.addUpdateMessage({
      diff: { type: 'add', added: withoutHistory, withHistory: false },
      ...shared,
    });
    const groupChange = await GroupUpdateMessageFactory.getWithoutHistoryControlMessage({
      adminSecretKey: group.secretKey,
      convo,
      groupPk,
      withoutHistory,
      createAtNetworkTimestamp,
      dbMsgIdentifier: msgModel.id,
    });
    if (groupChange) {
      updateMessagesToPush.push(groupChange);
    }
  }
  await LibSessionUtil.saveDumpsToDb(groupPk);
  refreshConvosModelProps([groupPk]);
  window.inboxStore?.dispatch(refreshGroupDetailsFromWrapper({ groupPk }) as any);

  const extraStoreRequests = await StoreGroupRequestFactory.makeGroupMessageSubRequest(
    updateMessagesToPush,
    group
  );

  try {
    // push new members & key supplement in a single batch call
    const sequenceResult = await GroupSync.pushChangesToGroupSwarmIfNeeded({
      groupPk,
      supplementalKeysSubRequest,
      revokeSubRequest,
      unrevokeSubRequest,
      extraStoreRequests,
      allow401s: false,
    });
    if (sequenceResult !== RunJobResult.Success) {
      await LibSessionUtil.saveDumpsToDb(groupPk);
      window.log.warn(
        `handleMemberAddedFromUI: pushChangesToGroupSwarmIfNeeded for ${ed25519Str(groupPk)} did not return success`
      );
      // throwing so we handle the reset state in the catch below
      throw new Error(
        `handleMemberAddedFromUI: pushChangesToGroupSwarmIfNeeded for ${ed25519Str(groupPk)} did not return success`
      );
    }
  } catch (e) {
    window.log.warn(
      'handleMemberAddedFromUI: pushChangesToGroupSwarmIfNeeded failed with:',
      e.message
    );

    try {
      const merged = withHistory.concat(withoutHistory);
      for (let index = 0; index < merged.length; index++) {
        await MetaGroupWrapperActions.memberSetInviteFailed(groupPk, merged[index]);
        // this gets reset once we do send an invite to that user
        GroupInvite.debounceFailedStateForMember(groupPk, merged[index], true);
      }
    } catch (e2) {
      window.log.warn(
        'handleMemberAddedFromUI: marking members invite failed, failed with:',
        e2.message
      );
    }
    return false;
  }

  // schedule send invite details, auth signature, etc. to the new users
  await scheduleGroupInviteJobs(groupPk, withHistory, withoutHistory, false);
  await LibSessionUtil.saveDumpsToDb(groupPk);

  convo.set({
    active_at: createAtNetworkTimestamp,
  });

  await convo.commit();
  return true;
}

/**
 * This function is called in two cases:
 * - to update the state when kicking a member from the group from the UI
 * - to update the state when handling a MEMBER_LEFT message
 */
async function handleMemberRemovedFromUI({
  groupPk,
  removeMembers,
  fromMemberLeftMessage,
  alsoRemoveMessages,
}: WithFromMemberLeftMessage &
  WithGroupPubkey & {
    removeMembers: Array<PubkeyType>;
    alsoRemoveMessages: boolean;
  }) {
  const group = await UserGroupsWrapperActions.getGroup(groupPk);
  if (!group || !group.secretKey || isEmpty(group.secretKey)) {
    throw new Error('tried to make change to group but we do not have the admin secret key');
  }

  await checkWeAreAdminOrThrow(groupPk, 'handleMemberRemovedFromUI');

  if (removeMembers.length === 0) {
    window.log.debug('handleMemberRemovedFromUI: removeMembers is empty');

    return;
  }

  const { removed, convo, us } = validateMemberRemoveChange({
    groupPk,
    removed: removeMembers,
  });

  if (removed.length === 0) {
    window.log.debug('handleMemberRemovedFromUI: removeMembers after validation is empty');

    return;
  }

  // We need to mark the member as "pending removal" so any admins (including us) can deal with it as soon as possible
  await MetaGroupWrapperActions.membersMarkPendingRemoval(groupPk, removed, alsoRemoveMessages);
  await LibSessionUtil.saveDumpsToDb(groupPk);

  // We don't revoke the member's token right away. Instead we schedule a `GroupPendingRemovals`
  // which will deal with the revokes of all of them together.
  await GroupPendingRemovals.addJob({ groupPk });
  window.inboxStore?.dispatch(refreshGroupDetailsFromWrapper({ groupPk }) as any);

  // Build a GroupUpdateMessage to be sent if that member was kicked by us.
  const createAtNetworkTimestamp = NetworkTime.now();
  const expiringDetails = DisappearingMessages.getExpireDetailsForOutgoingMessage(
    convo,
    createAtNetworkTimestamp
  );
  let removedControlMessage: GroupUpdateMemberChangeMessage | null = null;

  // We only add/send a message if that user didn't leave but was explicitly kicked.
  // When we leaves by himself, he sends a GroupUpdateMessage.
  if (!fromMemberLeftMessage) {
    const msgModel = await ClosedGroup.addUpdateMessage({
      diff: { type: 'kicked', kicked: removed },
      convo,
      sender: us,
      sentAt: createAtNetworkTimestamp,
      expireUpdate: {
        expirationTimer: expiringDetails.expireTimer,
        expirationType: expiringDetails.expirationType,
        messageExpirationFromRetrieve:
          expiringDetails.expireTimer > 0
            ? createAtNetworkTimestamp + expiringDetails.expireTimer
            : null,
      },
      markAlreadySent: false, // the store below will mark the message as sent using dbMsgIdentifier
      messageHash: null,
    });
    removedControlMessage = await GroupUpdateMessageFactory.getRemovedControlMessage({
      adminSecretKey: group.secretKey,
      convo,
      groupPk,
      removed,
      createAtNetworkTimestamp,
      fromMemberLeftMessage,
      dbMsgIdentifier: msgModel.id,
    });
  }

  // build the request for that GroupUpdateMessage if needed
  const extraStoreRequests = await StoreGroupRequestFactory.makeGroupMessageSubRequest(
    [removedControlMessage],
    group
  );
  try {
    // Send the updated config (with changes to pending_removal) and that GroupUpdateMessage request (if any) as a sequence.
    const sequenceResult = await GroupSync.pushChangesToGroupSwarmIfNeeded({
      groupPk,
      extraStoreRequests,
      allow401s: false,
    });
    if (sequenceResult !== RunJobResult.Success) {
      throw new Error(
        'currentDeviceGroupMembersChange: pushChangesToGroupSwarmIfNeeded did not return success'
      );
    }
  } catch (e) {
    window.log.warn(
      'currentDeviceGroupMembersChange: pushChangesToGroupSwarmIfNeeded failed with:',
      e.message
    );
  }

  await LibSessionUtil.saveDumpsToDb(groupPk);

  convo.set({
    active_at: createAtNetworkTimestamp,
  });
  await convo.commit();
}

async function handleNameChangeFromUI({
  groupPk,
  newName: uncheckedName,
  newDescription: uncheckedDescription,
}: WithGroupPubkey & {
  newName: string;
  newDescription: string;
}) {
  const group = await UserGroupsWrapperActions.getGroup(groupPk);
  if (!group || !group.secretKey || isEmpty(group.secretKey)) {
    throw new Error('tried to make change to group but we do not have the admin secret key');
  }
  const infos = await MetaGroupWrapperActions.infoGet(groupPk);
  if (!infos) {
    throw new PreConditionFailed('nameChange infoGet is empty');
  }

  await checkWeAreAdminOrThrow(groupPk, 'handleNameChangeFromUIOrNot');

  // this throws if the name is the same, or empty
  const { newName, newDescription, convo, us } = validateNameChange({
    newName: uncheckedName,
    currentName: group.name || '',
    groupPk,
    currentDescription: infos.description || '',
    newDescription: uncheckedDescription,
  });

  const nameChanged = newName !== group.name;

  group.name = newName;
  infos.name = newName;
  infos.description = newDescription;
  await UserGroupsWrapperActions.setGroup(group);
  await MetaGroupWrapperActions.infoSet(groupPk, infos);
  let extraStoreRequests: Array<StoreGroupMessageSubRequest> = [];
  const createAtNetworkTimestamp = NetworkTime.now();

  // we only send a name changed message if the name actually changed. We don't care about
  if (nameChanged) {
    // we want to add an update message even if the change was done remotely
    const msg = await ClosedGroup.addUpdateMessage({
      convo,
      diff: { type: 'name', newName },
      sender: us,
      sentAt: createAtNetworkTimestamp,
      expireUpdate: DisappearingMessages.getExpireDetailsForOutgoingMessage(
        convo,
        createAtNetworkTimestamp
      ),
      markAlreadySent: false, // the store below will mark the message as sent with dbMsgIdentifier
      messageHash: null,
    });

    // we want to send an update only if the change was made locally.
    const nameChangeMsg = new GroupUpdateInfoChangeMessage({
      groupPk,
      typeOfChange: SignalService.GroupUpdateInfoChangeMessage.Type.NAME,
      updatedName: newName,
      identifier: msg.id,
      createAtNetworkTimestamp,
      secretKey: group.secretKey,
      sodium: await getSodiumRenderer(),
      ...DisappearingMessages.getExpireDetailsForOutgoingMessage(convo, createAtNetworkTimestamp),
    });
    extraStoreRequests = await StoreGroupRequestFactory.makeGroupMessageSubRequest(
      [nameChangeMsg],
      group
    );
  }

  try {
    const batchResult = await GroupSync.pushChangesToGroupSwarmIfNeeded({
      groupPk,
      extraStoreRequests,
      allow401s: false,
    });

    if (batchResult !== RunJobResult.Success) {
      await LibSessionUtil.saveDumpsToDb(groupPk);

      throw new Error(
        'handleNameChangeFromUIOrNot: pushChangesToGroupSwarmIfNeeded did not return success'
      );
    }
  } catch (e) {
    window.log.warn(
      'handleNameChangeFromUIOrNot: pushChangesToGroupSwarmIfNeeded failed with:',
      e.message
    );
  }

  convo.set({
    active_at: createAtNetworkTimestamp,
  });
  await convo.commit();
}

async function handleAvatarChangeFromUI({
  groupPk,
  objectUrl,
}: WithGroupPubkey & {
  objectUrl: string;
}) {
  const convo = ConvoHub.use().get(groupPk);
  const us = UserUtils.getOurPubKeyStrFromCache();
  if (!convo) {
    throw new PreConditionFailed('handleAvatarChangeFromUI: convo not present');
  }
  const group = await UserGroupsWrapperActions.getGroup(groupPk);
  if (!group || !group.secretKey || isEmpty(group.secretKey)) {
    throw new Error('tried to make change to group but we do not have the admin secret key');
  }
  const infos = await MetaGroupWrapperActions.infoGet(groupPk);
  if (!infos) {
    throw new PreConditionFailed('avatarChange infoGet is empty');
  }

  await checkWeAreAdminOrThrow(groupPk, 'handleAvatarChangeFromUI');

  const blobAvatarAlreadyScaled = await urlToBlob(objectUrl);

  const dataResizedUnencrypted = await blobAvatarAlreadyScaled.arrayBuffer();
  // generate a new profile key for this group
  const profileKey = (await getSodiumRenderer()).randombytes_buf(32);
  // encrypt the avatar data with the profile key
  const encryptedData = await encryptProfile(dataResizedUnencrypted, profileKey);

  const uploadedFileDetails = await uploadFileToFsWithOnionV4(encryptedData);
  if (!uploadedFileDetails || !uploadedFileDetails.fileUrl) {
    window?.log?.warn('File upload for groupv2 to file server failed');
    throw new Error('File upload for groupv2 to file server failed');
  }
  const { fileUrl, fileId } = uploadedFileDetails;

  const upgraded = await processNewAttachment({
    data: dataResizedUnencrypted,
    isRaw: true,
    contentType: MIME.IMAGE_UNKNOWN, // contentType is mostly used to generate previews and screenshot. We do not care for those in this case.
  });
  await convo.setSessionProfile({
    displayName: null, // null so we don't overwrite it
    avatarPath: upgraded.path,
    avatarImageId: fileId,
  });
  infos.profilePicture = { url: fileUrl, key: profileKey };
  await MetaGroupWrapperActions.infoSet(groupPk, infos);
  const createAtNetworkTimestamp = NetworkTime.now();

  // we want to add an update message even if the change was done remotely
  const msg = await ClosedGroup.addUpdateMessage({
    convo,
    diff: { type: 'avatarChange' },
    sender: us,
    sentAt: createAtNetworkTimestamp,
    expireUpdate: DisappearingMessages.getExpireDetailsForOutgoingMessage(
      convo,
      createAtNetworkTimestamp
    ),
    markAlreadySent: false, // the store below will mark the message as sent with dbMsgIdentifier
    messageHash: null,
  });

  // we want to send an update only if the change was made locally.
  const avatarChangeMsg = new GroupUpdateInfoChangeMessage({
    groupPk,
    typeOfChange: SignalService.GroupUpdateInfoChangeMessage.Type.AVATAR,
    identifier: msg.id,
    createAtNetworkTimestamp,
    secretKey: group.secretKey,
    sodium: await getSodiumRenderer(),
    ...DisappearingMessages.getExpireDetailsForOutgoingMessage(convo, createAtNetworkTimestamp),
  });

  const extraStoreRequests = await StoreGroupRequestFactory.makeGroupMessageSubRequest(
    [avatarChangeMsg],
    group
  );

  try {
    const batchResult = await GroupSync.pushChangesToGroupSwarmIfNeeded({
      groupPk,
      extraStoreRequests,
      allow401s: false,
    });

    if (batchResult !== RunJobResult.Success) {
      await LibSessionUtil.saveDumpsToDb(groupPk);

      throw new Error(
        'handleAvatarChangeFromUI: pushChangesToGroupSwarmIfNeeded did not return success'
      );
    }
  } catch (e) {
    window.log.warn(
      'handleAvatarChangeFromUI: pushChangesToGroupSwarmIfNeeded failed with:',
      e.message
    );
  }

  convo.set({
    active_at: createAtNetworkTimestamp,
  });
  await convo.commit();
}

async function handleClearAvatarFromUI({ groupPk }: WithGroupPubkey) {
  const convo = ConvoHub.use().get(groupPk);
  if (!convo) {
    window.log.warn(
      `handleClearAvatarFromUI: convo ${ed25519Str(groupPk)} not found... This is not a valid case`
    );
    return;
  }

  // return early if no change are needed at all
  if (
    isNil(convo.get('avatarPointer')) &&
    isNil(convo.get('avatarInProfile')) &&
    isNil(convo.get('profileKey'))
  ) {
    return;
  }

  // if we are a 03-group, we need to remove the avatar from the group config, and push a sync
  const infos = await MetaGroupWrapperActions.infoGet(groupPk);
  if (!infos) {
    throw new PreConditionFailed('handleClearAvatarFromUI infoGet is empty');
  }
  if (infos.profilePicture?.url || infos.profilePicture?.key) {
    await MetaGroupWrapperActions.infoSet(groupPk, {
      ...infos,
      profilePicture: null,
    });
    await GroupSync.queueNewJobIfNeeded(groupPk);
  }

  const group = await UserGroupsWrapperActions.getGroup(groupPk);
  if (!group || !group.secretKey || isEmpty(group.secretKey)) {
    throw new Error('tried to make change to group but we do not have the admin secret key');
  }

  await checkWeAreAdminOrThrow(groupPk, 'handleAvatarChangeFromUI');
  convo.setKey('avatarPointer', undefined);
  convo.setKey('avatarInProfile', undefined);
  convo.setKey('profileKey', undefined);

  const createAtNetworkTimestamp = NetworkTime.now();
  // we want to add an update message even if the change was done remotely
  const msg = await ClosedGroup.addUpdateMessage({
    convo,
    diff: { type: 'avatarChange' },
    sender: UserUtils.getOurPubKeyStrFromCache(),
    sentAt: createAtNetworkTimestamp,
    expireUpdate: DisappearingMessages.getExpireDetailsForOutgoingMessage(
      convo,
      createAtNetworkTimestamp
    ),
    markAlreadySent: false, // the store below will mark the message as sent with dbMsgIdentifier
    messageHash: null,
  });

  // we want to send an update only if the change was made locally.
  const avatarChangeMsg = new GroupUpdateInfoChangeMessage({
    groupPk,
    typeOfChange: SignalService.GroupUpdateInfoChangeMessage.Type.AVATAR,
    identifier: msg.id,
    createAtNetworkTimestamp,
    secretKey: group.secretKey,
    sodium: await getSodiumRenderer(),
    ...DisappearingMessages.getExpireDetailsForOutgoingMessage(convo, createAtNetworkTimestamp),
  });

  const extraStoreRequests = await StoreGroupRequestFactory.makeGroupMessageSubRequest(
    [avatarChangeMsg],
    group
  );

  try {
    const batchResult = await GroupSync.pushChangesToGroupSwarmIfNeeded({
      groupPk,
      extraStoreRequests,
      allow401s: false,
    });

    if (batchResult !== RunJobResult.Success) {
      await LibSessionUtil.saveDumpsToDb(groupPk);

      throw new Error(
        'handleClearAvatarFromUI: pushChangesToGroupSwarmIfNeeded did not return success'
      );
    }
  } catch (e) {
    window.log.warn(
      'handleClearAvatarFromUI: pushChangesToGroupSwarmIfNeeded failed with:',
      e.message
    );
  }

  convo.set({
    active_at: createAtNetworkTimestamp,
  });
  await convo.commit();
}

/**
 * This action is used to trigger a change when the local user does a change to a group v2 members list.
 * GroupV2 added members can be added two ways: with and without the history of messages.
 * GroupV2 removed members have their sub account token revoked on the server side so they cannot poll anymore from the group's swarm.
 */
const currentDeviceGroupMembersChange = createAsyncThunk(
  'group/currentDeviceGroupMembersChange',
  async (
    {
      groupPk,
      ...args
    }: {
      groupPk: GroupPubkeyType;
      addMembersWithHistory: Array<PubkeyType>;
      addMembersWithoutHistory: Array<PubkeyType>;
      removeMembers: Array<PubkeyType>;
      alsoRemoveMessages: boolean;
    },
    payloadCreator
  ): Promise<GroupDetailsUpdate> => {
    const state = payloadCreator.getState() as StateType;
    if (!state.groups.infos[groupPk] || !state.groups.members[groupPk]) {
      throw new PreConditionFailed(
        'currentDeviceGroupMembersChange group not present in redux slice'
      );
    }

    await handleMemberRemovedFromUI({
      groupPk,
      removeMembers: args.removeMembers,
      fromMemberLeftMessage: false,
      alsoRemoveMessages: args.alsoRemoveMessages,
    });

    await handleMemberAddedFromUI({
      groupPk,
      addMembersWithHistory: args.addMembersWithHistory,
      addMembersWithoutHistory: args.addMembersWithoutHistory,
    });

    return {
      groupPk,
      infos: await MetaGroupWrapperActions.infoGet(groupPk),
      members: await MetaGroupWrapperActions.memberGetAll(groupPk),
    };
  }
);

const triggerDeleteMsgBeforeNow = createAsyncThunk(
  'group/triggerDeleteMsgBeforeNow',
  async (
    {
      groupPk,
      messagesWithAttachmentsOnly,
      onDeleted,
      onDeletionFailed,
    }: {
      groupPk: GroupPubkeyType;
      messagesWithAttachmentsOnly: boolean;
      onDeleted: () => void;
      onDeletionFailed: (error: string) => void;
    },
    payloadCreator
  ): Promise<void> => {
    const state = payloadCreator.getState() as StateType;
    if (!state.groups.infos[groupPk]) {
      throw new PreConditionFailed('triggerDeleteMsgBeforeNow group not present in redux slice');
    }
    const convo = ConvoHub.use().get(groupPk);
    const group = await UserGroupsWrapperActions.getGroup(groupPk);
    if (!convo || !group || !group.secretKey || isEmpty(group.secretKey)) {
      throw new Error(
        'triggerDeleteMsgBeforeNow: tried to make change to group but we do not have the admin secret key'
      );
    }

    const nowSeconds = NetworkTime.getNowWithNetworkOffsetSeconds();
    const infoGet = await MetaGroupWrapperActions.infoGet(groupPk);
    if (messagesWithAttachmentsOnly) {
      infoGet.deleteAttachBeforeSeconds = nowSeconds;
    } else {
      infoGet.deleteBeforeSeconds = nowSeconds;
    }

    await MetaGroupWrapperActions.infoSet(groupPk, infoGet);

    const extraStoreRequests = await StoreGroupRequestFactory.makeGroupMessageSubRequest([], group);
    try {
      const batchResult = await GroupSync.pushChangesToGroupSwarmIfNeeded({
        groupPk,
        extraStoreRequests,
        allow401s: false,
      });
      if (!batchResult) {
        window.log.warn(
          `failed to send deleteBeforeSeconds/deleteAttachBeforeSeconds message for group ${ed25519Str(groupPk)}`
        );
        throw new Error('failed to send deleteBeforeSeconds/deleteAttachBeforeSeconds message');
      }
      onDeleted();
    } catch (e) {
      window.log.warn(
        'currentDeviceGroupMembersChange: pushChangesToGroupSwarmIfNeeded failed with:',
        e.message
      );
      onDeletionFailed(e.message);
    }
  }
);

/**
 * This action is used to trigger a change when the local user does a change to a group v2 members list.
 * GroupV2 added members can be added two ways: with and without the history of messages.
 * GroupV2 removed members have their sub account token revoked on the server side so they cannot poll anymore from the group's swarm.
 */
const handleMemberLeftMessage = createAsyncThunk(
  'group/handleMemberLeftMessage',
  async (
    {
      groupPk,
      memberLeft,
    }: {
      groupPk: GroupPubkeyType;
      memberLeft: PubkeyType;
    },
    payloadCreator
  ): Promise<GroupDetailsUpdate> => {
    const state = payloadCreator.getState() as StateType;
    if (!state.groups.infos[groupPk] || !state.groups.members[groupPk]) {
      throw new PreConditionFailed(
        'currentDeviceGroupMembersChange group not present in redux slice'
      );
    }

    if (await checkWeAreAdmin(groupPk)) {
      await handleMemberRemovedFromUI({
        groupPk,
        removeMembers: [memberLeft],
        fromMemberLeftMessage: true,
        alsoRemoveMessages: false,
      });
    }

    return {
      groupPk,
      infos: await MetaGroupWrapperActions.infoGet(groupPk),
      members: await MetaGroupWrapperActions.memberGetAll(groupPk),
    };
  }
);

const inviteResponseReceived = createAsyncThunk(
  'group/inviteResponseReceived',
  async (
    {
      groupPk,
      member,
    }: {
      groupPk: GroupPubkeyType;
      member: PubkeyType;
    },
    payloadCreator
  ): Promise<GroupDetailsUpdate> => {
    const state = payloadCreator.getState() as StateType;
    if (!state.groups.infos[groupPk] || !state.groups.members[groupPk]) {
      throw new PreConditionFailed('inviteResponseReceived group but not present in redux slice');
    }
    try {
      await checkWeAreAdminOrThrow(groupPk, 'inviteResponseReceived');

      await MetaGroupWrapperActions.memberSetInviteAccepted(groupPk, member);
      try {
        const memberConvo = ConvoHub.use().get(member);
        if (memberConvo) {
          const memberName = memberConvo.getRealSessionUsername();
          if (memberName) {
            await MetaGroupWrapperActions.memberSetNameTruncated(groupPk, member, memberName);
          }
          const profilePicUrl = memberConvo.getAvatarPointer();
          const profilePicKey = memberConvo.getProfileKey();
          if (profilePicUrl && profilePicKey) {
            await MetaGroupWrapperActions.memberSetProfilePicture(groupPk, member, {
              key: from_hex(profilePicKey),
              url: profilePicUrl,
            });
          }
        }
      } catch (eMemberUpdate) {
        window.log.warn(
          `failed to update member details on inviteResponse received in group:${ed25519Str(groupPk)}, member:${ed25519Str(member)}, error:${eMemberUpdate.message}`
        );
      }
      await GroupSync.queueNewJobIfNeeded(groupPk);
      await LibSessionUtil.saveDumpsToDb(groupPk);
    } catch (e) {
      window.log.info('inviteResponseReceived failed with', e.message);
      // only admins can do the steps above, but we don't want to throw if we are not an admin
    }

    return {
      groupPk,
      infos: await MetaGroupWrapperActions.infoGet(groupPk),
      members: await MetaGroupWrapperActions.memberGetAll(groupPk),
    };
  }
);

const currentDeviceGroupNameChange = createAsyncThunk(
  'group/currentDeviceGroupNameChange',
  async (
    {
      groupPk,
      ...args
    }: {
      groupPk: GroupPubkeyType;
      newName: string;
      newDescription: string;
    },
    payloadCreator
  ): Promise<GroupDetailsUpdate> => {
    const state = payloadCreator.getState() as StateType;
    if (!state.groups.infos[groupPk] || !state.groups.members[groupPk]) {
      throw new PreConditionFailed('currentDeviceGroupNameChange group not present in redux slice');
    }
    await checkWeAreAdminOrThrow(groupPk, 'currentDeviceGroupNameChange');

    await handleNameChangeFromUI({ groupPk, ...args });
    window.inboxStore?.dispatch(updateGroupNameModal(null));

    return {
      groupPk,
      infos: await MetaGroupWrapperActions.infoGet(groupPk),
      members: await MetaGroupWrapperActions.memberGetAll(groupPk),
    };
  }
);

const currentDeviceGroupAvatarChange = createAsyncThunk(
  'group/currentDeviceGroupAvatarChange',
  async (
    {
      groupPk,
      ...args
    }: {
      groupPk: GroupPubkeyType;
      objectUrl: string;
    },
    payloadCreator
  ): Promise<GroupDetailsUpdate> => {
    const state = payloadCreator.getState() as StateType;
    if (!state.groups.infos[groupPk] || !state.groups.members[groupPk]) {
      throw new PreConditionFailed(
        'currentDeviceGroupAvatarChange group not present in redux slice'
      );
    }
    await checkWeAreAdminOrThrow(groupPk, 'currentDeviceGroupAvatarChange');

    await handleAvatarChangeFromUI({ groupPk, ...args });
    window.inboxStore?.dispatch(updateEditProfilePictureModal(null));

    return {
      groupPk,
      infos: await MetaGroupWrapperActions.infoGet(groupPk),
      members: await MetaGroupWrapperActions.memberGetAll(groupPk),
    };
  }
);

const currentDeviceGroupAvatarRemoval = createAsyncThunk(
  'group/currentDeviceGroupAvatarRemoval',
  async ({ groupPk }: WithGroupPubkey, payloadCreator): Promise<GroupDetailsUpdate> => {
    const state = payloadCreator.getState() as StateType;
    if (!state.groups.infos[groupPk] || !state.groups.members[groupPk]) {
      throw new PreConditionFailed(
        'currentDeviceGroupAvatarRemoval group not present in redux slice'
      );
    }
    await checkWeAreAdminOrThrow(groupPk, 'currentDeviceGroupAvatarRemoval');

    await handleClearAvatarFromUI({ groupPk });
    window.inboxStore?.dispatch(updateEditProfilePictureModal(null));

    return {
      groupPk,
      infos: await MetaGroupWrapperActions.infoGet(groupPk),
      members: await MetaGroupWrapperActions.memberGetAll(groupPk),
    };
  }
);

function deleteGroupPkEntriesFromState(state: GroupState, groupPk: GroupPubkeyType) {
  delete state.infos[groupPk];
  delete state.members[groupPk];
}

function refreshConvosModelProps(convoIds: Array<string>) {
  /**
   *
   * This is not ideal, but some fields stored in this slice are ALSO stored in the conversation slice. Things like admins,members, groupName, kicked, etc...
   * So, anytime a change is made in this metaGroup slice, we need to make sure the conversation slice is updated too.
   * The way to update the conversation slice is to call `triggerUIRefresh` on the corresponding conversation object.
   * Eventually, we will have a centralized state with libsession used across the app, and those slices will only expose data from the libsession state.
   *
   */
  setTimeout(() => {
    convoIds.map(id => ConvoHub.use().get(id)).map(c => c?.triggerUIRefresh());
  }, 1000);
}

/**
 * This slice is representing the cached state of all our current 03-groups.
 */
const metaGroupSlice = createSlice({
  name: 'metaGroup',
  initialState: initialGroupState,
  reducers: {
    removeGroupDetailsFromSlice(
      state: GroupState,
      { payload }: PayloadAction<{ groupPk: GroupPubkeyType }>
    ) {
      delete state.infos[payload.groupPk];
      delete state.members[payload.groupPk];
    },
    addSelectedGroupMember(
      state: GroupState,
      { payload }: PayloadAction<{ memberToAdd: PubkeyType }>
    ) {
      if (!state.creationMembersSelected?.length) {
        state.creationMembersSelected = [payload.memberToAdd];
        return state;
      }
      if (state.creationMembersSelected.includes(payload.memberToAdd)) {
        return state;
      }
      state.creationMembersSelected.push(payload.memberToAdd);
      return state;
    },

    setSelectedGroupMembers(
      state: GroupState,
      { payload }: PayloadAction<{ membersToSet: Array<PubkeyType> }>
    ) {
      state.creationMembersSelected = uniq(payload.membersToSet);
      return state;
    },
    removeSelectedGroupMember(
      state: GroupState,
      { payload }: PayloadAction<{ memberToRemove: PubkeyType }>
    ) {
      const foundAt = state.creationMembersSelected?.indexOf(payload.memberToRemove);
      if (state.creationMembersSelected && !isNil(foundAt) && foundAt >= 0) {
        state.creationMembersSelected.splice(foundAt, 1);
      }
      return state;
    },

    updateGroupCreationName(state: GroupState, { payload }: PayloadAction<{ name: string }>) {
      state.creationGroupName = payload.name;
      return state;
    },
  },
  extraReducers: builder => {
    builder.addCase(initNewGroupInWrapper.fulfilled, (state, action) => {
      const { groupPk, infos, members } = action.payload;
      state.infos[groupPk] = infos;
      state.members[groupPk] = members;
      state.creationFromUIPending = false;
      refreshConvosModelProps([groupPk]);
      return state;
    });
    builder.addCase(initNewGroupInWrapper.rejected, (state, action) => {
      window.log.error('a initNewGroupInWrapper was rejected', action.error);
      state.creationFromUIPending = false;
      return state;
      // FIXME delete the wrapper completely & corresponding dumps, and user groups entry?
    });
    builder.addCase(initNewGroupInWrapper.pending, (state, _action) => {
      state.creationFromUIPending = true;

      window.log.debug('a initNewGroupInWrapper is pending');
      return state;
    });
    builder.addCase(loadMetaDumpsFromDB.fulfilled, (state, action) => {
      const loaded = action.payload;
      loaded.forEach(element => {
        state.infos[element.groupPk] = element.infos;
        state.members[element.groupPk] = element.members;
      });
      refreshConvosModelProps(loaded.map(m => m.groupPk));
      return state;
    });
    builder.addCase(loadMetaDumpsFromDB.rejected, (state, action) => {
      window.log.error('a loadMetaDumpsFromDB was rejected', action.error);
      return state;
    });
    builder.addCase(refreshGroupDetailsFromWrapper.fulfilled, (state, action) => {
      const { infos, members, groupPk } = action.payload;
      if (infos && members) {
        state.infos[groupPk] = infos;
        state.members[groupPk] = members;
        if (window.sessionFeatureFlags.debug.debugLibsessionDumps) {
          window.log.info(`groupInfo of ${ed25519Str(groupPk)} after merge: ${stringify(infos)}`);
          window.log.info(
            `groupMembers of ${ed25519Str(groupPk)} after merge: ${stringify(members)}`
          );
        }
        refreshConvosModelProps([groupPk]);
      } else {
        window.log.debug(
          `refreshGroupDetailsFromWrapper no details found, removing from slice: ${groupPk}}`
        );

        deleteGroupPkEntriesFromState(state, groupPk);
      }
      return state;
    });
    builder.addCase(refreshGroupDetailsFromWrapper.rejected, (_state, action) => {
      window.log.error('a refreshGroupDetailsFromWrapper was rejected', action.error);
    });

    builder.addCase(handleUserGroupUpdate.fulfilled, (state, action) => {
      const { infos, members, groupPk } = action.payload;
      if (infos && members) {
        state.infos[groupPk] = infos;
        state.members[groupPk] = members;
        refreshConvosModelProps([groupPk]);
        if (window.sessionFeatureFlags.debug.debugLibsessionDumps) {
          window.log.info(
            `groupInfo of ${ed25519Str(groupPk)} after handleUserGroupUpdate: ${stringify(infos)}`
          );
          window.log.info(
            `groupMembers of ${ed25519Str(groupPk)} after handleUserGroupUpdate: ${stringify(members)}`
          );
        }
      } else {
        window.log.debug(
          `handleUserGroupUpdate no details found, removing from slice: ${groupPk}}`
        );

        deleteGroupPkEntriesFromState(state, groupPk);
      }
    });
    builder.addCase(handleUserGroupUpdate.rejected, (_state, action) => {
      window.log.error('a handleUserGroupUpdate was rejected', action.error);
    });
    builder.addCase(currentDeviceGroupMembersChange.fulfilled, (state, action) => {
      state.memberChangesFromUIPending = false;

      const { infos, members, groupPk } = action.payload;
      state.infos[groupPk] = infos;
      state.members[groupPk] = members;
      refreshConvosModelProps([groupPk]);
      if (window.sessionFeatureFlags.debug.debugLibsessionDumps) {
        window.log.info(
          `groupInfo of ${ed25519Str(groupPk)} after currentDeviceGroupMembersChange: ${stringify(infos)}`
        );
        window.log.info(
          `groupMembers of ${ed25519Str(groupPk)} after currentDeviceGroupMembersChange: ${stringify(members)}`
        );
      }
    });
    builder.addCase(currentDeviceGroupMembersChange.rejected, (state, action) => {
      window.log.error('a currentDeviceGroupMembersChange was rejected', action.error);
      state.memberChangesFromUIPending = false;
    });
    builder.addCase(currentDeviceGroupMembersChange.pending, state => {
      state.memberChangesFromUIPending = true;
    });

    /** currentDeviceGroupNameChange */
    builder.addCase(currentDeviceGroupNameChange.fulfilled, (state, action) => {
      state.nameChangesFromUIPending = false;

      const { infos, members, groupPk } = action.payload;
      state.infos[groupPk] = infos;
      state.members[groupPk] = members;
      refreshConvosModelProps([groupPk]);
      if (window.sessionFeatureFlags.debug.debugLibsessionDumps) {
        window.log.info(
          `groupInfo of ${ed25519Str(groupPk)} after currentDeviceGroupNameChange: ${stringify(infos)}`
        );
        window.log.info(
          `groupMembers of ${ed25519Str(groupPk)} after currentDeviceGroupNameChange: ${stringify(members)}`
        );
      }
    });
    builder.addCase(currentDeviceGroupNameChange.rejected, (state, action) => {
      window.log.error(`a ${currentDeviceGroupNameChange.name} was rejected`, action.error);
      state.nameChangesFromUIPending = false;
    });
    builder.addCase(currentDeviceGroupNameChange.pending, state => {
      state.nameChangesFromUIPending = true;
    });

    /** currentDeviceGroupAvatarChange */
    builder.addCase(currentDeviceGroupAvatarChange.fulfilled, (state, action) => {
      state.avatarChangeFromUIPending = false;

      const { infos, members, groupPk } = action.payload;
      state.infos[groupPk] = infos;
      state.members[groupPk] = members;
      refreshConvosModelProps([groupPk]);
      if (window.sessionFeatureFlags.debug.debugLibsessionDumps) {
        window.log.info(
          `groupInfo of ${ed25519Str(groupPk)} after currentDeviceGroupAvatarChange: ${stringify(infos)}`
        );
        window.log.info(
          `groupMembers of ${ed25519Str(groupPk)} after currentDeviceGroupAvatarChange: ${stringify(members)}`
        );
      }
    });
    builder.addCase(currentDeviceGroupAvatarChange.rejected, (state, action) => {
      window.log.error(`a ${currentDeviceGroupAvatarChange.name} was rejected`, action.error);
      state.avatarChangeFromUIPending = false;
    });
    builder.addCase(currentDeviceGroupAvatarChange.pending, state => {
      state.avatarChangeFromUIPending = true;
    });

    /** currentDeviceGroupAvatarRemoval */
    builder.addCase(currentDeviceGroupAvatarRemoval.fulfilled, (state, action) => {
      state.avatarChangeFromUIPending = false;

      const { infos, members, groupPk } = action.payload;
      state.infos[groupPk] = infos;
      state.members[groupPk] = members;
      refreshConvosModelProps([groupPk]);
      if (window.sessionFeatureFlags.debug.debugLibsessionDumps) {
        window.log.info(
          `groupInfo of ${ed25519Str(groupPk)} after currentDeviceGroupAvatarRemoval: ${stringify(infos)}`
        );
        window.log.info(
          `groupMembers of ${ed25519Str(groupPk)} after currentDeviceGroupAvatarRemoval: ${stringify(members)}`
        );
      }
    });
    builder.addCase(currentDeviceGroupAvatarRemoval.rejected, (state, action) => {
      window.log.error(`a ${currentDeviceGroupAvatarRemoval.name} was rejected`, action.error);
      state.avatarChangeFromUIPending = false;
    });
    builder.addCase(currentDeviceGroupAvatarRemoval.pending, state => {
      state.avatarChangeFromUIPending = true;
    });

    /** handleMemberLeftMessage */
    builder.addCase(handleMemberLeftMessage.fulfilled, (state, action) => {
      const { infos, members, groupPk } = action.payload;
      state.infos[groupPk] = infos;
      state.members[groupPk] = members;
      refreshConvosModelProps([groupPk]);
      if (window.sessionFeatureFlags.debug.debugLibsessionDumps) {
        window.log.info(
          `groupInfo of ${ed25519Str(groupPk)} after handleMemberLeftMessage: ${stringify(infos)}`
        );
        window.log.info(
          `groupMembers of ${ed25519Str(groupPk)} after handleMemberLeftMessage: ${stringify(members)}`
        );
      }
    });
    builder.addCase(handleMemberLeftMessage.rejected, (_state, action) => {
      window.log.error('a handleMemberLeftMessage was rejected', action.error);
    });

    builder.addCase(inviteResponseReceived.fulfilled, (state, action) => {
      const { infos, members, groupPk } = action.payload;
      state.infos[groupPk] = infos;
      state.members[groupPk] = members;
      refreshConvosModelProps([groupPk]);
      if (window.sessionFeatureFlags.debug.debugLibsessionDumps) {
        window.log.info(
          `groupInfo of ${ed25519Str(groupPk)} after inviteResponseReceived: ${stringify(infos)}`
        );
        window.log.info(
          `groupMembers of ${ed25519Str(groupPk)} after inviteResponseReceived: ${stringify(members)}`
        );
      }
    });
    builder.addCase(inviteResponseReceived.rejected, (_state, action) => {
      window.log.error('a inviteResponseReceived was rejected', action.error);
    });
  },
});

export const groupInfoActions = {
  initNewGroupInWrapper,
  loadMetaDumpsFromDB,
  refreshGroupDetailsFromWrapper,
  handleUserGroupUpdate,
  currentDeviceGroupMembersChange,
  inviteResponseReceived,
  handleMemberLeftMessage,
  currentDeviceGroupNameChange,
  currentDeviceGroupAvatarChange,
  currentDeviceGroupAvatarRemoval,
  triggerDeleteMsgBeforeNow,
  ...metaGroupSlice.actions,
};
export const groupReducer = metaGroupSlice.reducer;

async function scheduleGroupInviteJobs(
  groupPk: GroupPubkeyType,
  withHistory: Array<PubkeyType>,
  withoutHistory: Array<PubkeyType>,
  inviteAsAdmin: boolean
) {
  const merged = uniq(concat(withHistory, withoutHistory));
  for (let index = 0; index < merged.length; index++) {
    const member = merged[index];
    await GroupInvite.addJob({ groupPk, member, inviteAsAdmin });
  }
}
