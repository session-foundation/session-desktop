/* eslint-disable no-await-in-loop */
import { ContactInfo, GroupPubkeyType, UserGroupsGet } from 'libsession_util_nodejs';
import { compact, difference, isEmpty, isNil, isNumber } from 'lodash';
import { ConfigDumpData } from '../data/configDump/configDump';
import { SettingsKey } from '../data/settings-key';
import { deleteAllMessagesByConvoIdNoConfirmation } from '../interactions/conversationInteractions';
import { getOpenGroupManager } from '../session/apis/open_group_api/opengroupV2/OpenGroupManagerV2';
import { OpenGroupUtils } from '../session/apis/open_group_api/utils';
import { getOpenGroupV2ConversationId } from '../session/apis/open_group_api/utils/OpenGroupUtils';
import { getSwarmPollingInstance } from '../session/apis/snode_api';
import { ConvoHub } from '../session/conversations';
import { ProfileManager } from '../session/profile_manager/ProfileManager';
import { PubKey } from '../session/types';
import { StringUtils, UserUtils } from '../session/utils';
import { FetchMsgExpirySwarm } from '../session/utils/job_runners/jobs/FetchMsgExpirySwarmJob';
import { LibSessionUtil } from '../session/utils/libsession/libsession_utils';
import { SessionUtilContact } from '../session/utils/libsession/libsession_utils_contacts';
import { SessionUtilConvoInfoVolatile } from '../session/utils/libsession/libsession_utils_convo_info_volatile';
import { SessionUtilUserGroups } from '../session/utils/libsession/libsession_utils_user_groups';
import { configurationMessageReceived } from '../shims/events';
import { getCurrentlySelectedConversationOutsideRedux } from '../state/selectors/conversations';
import { assertUnreachable, stringify, toFixedUint8ArrayOfLength } from '../types/sqlSharedTypes';
import { BlockedNumberController } from '../util';
import { Storage } from '../util/storage';
// eslint-disable-next-line import/no-unresolved, import/extensions
import { HexString } from '../node/hexStrings';
import {
  SnodeNamespace,
  SnodeNamespaces,
  SnodeNamespacesUserConfig,
} from '../session/apis/snode_api/namespaces';
import { RetrieveMessageItemWithNamespace } from '../session/apis/snode_api/types';
import { groupInfoActions } from '../state/ducks/metaGroups';
import {
  ConfigWrapperObjectTypesMeta,
  ConfigWrapperUser,
  getGroupPubkeyFromWrapperType,
  isStaticSessionWrapper,
  isUserConfigWrapperType,
} from '../webworker/workers/browser/libsession_worker_functions';
// eslint-disable-next-line import/no-unresolved, import/extensions
import { Data } from '../data/data';

// eslint-disable-next-line import/no-unresolved
import {
  ContactsWrapperActions,
  ConvoInfoVolatileWrapperActions,
  UserGenericWrapperActions,
  MetaGroupWrapperActions,
  UserConfigWrapperActions,
  UserGroupsWrapperActions,
} from '../webworker/workers/browser/libsession_worker_interface';
import { CONVERSATION } from '../session/constants';
import { CONVERSATION_PRIORITIES, ConversationTypeEnum } from '../models/types';

type IncomingUserResult = {
  needsPush: boolean;
  needsDump: boolean;
  publicKey: string;
  latestEnvelopeTimestamp: number;
  namespace: SnodeNamespacesUserConfig;
};

function byUserNamespace(incomingConfigs: Array<RetrieveMessageItemWithNamespace>) {
  const groupedByVariant: Map<
    SnodeNamespacesUserConfig,
    Array<RetrieveMessageItemWithNamespace>
  > = new Map();

  incomingConfigs.forEach(incomingConfig => {
    const { namespace } = incomingConfig;
    if (!SnodeNamespace.isUserConfigNamespace(namespace)) {
      throw new Error(`Invalid namespace on byUserNamespace: ${namespace}`);
    }

    if (!groupedByVariant.has(namespace)) {
      groupedByVariant.set(namespace, []);
    }

    groupedByVariant.get(namespace)?.push(incomingConfig);
  });
  return groupedByVariant;
}

async function printDumpForDebug(prefix: string, variant: ConfigWrapperObjectTypesMeta) {
  if (isStaticSessionWrapper(variant)) {
    return; // nothing to print for those static wrappers
  }

  if (isUserConfigWrapperType(variant)) {
    window.log.info(prefix, StringUtils.toHex(await UserGenericWrapperActions.makeDump(variant)));
    return;
  }

  const metaGroupDumps = await MetaGroupWrapperActions.metaMakeDump(
    getGroupPubkeyFromWrapperType(variant)
  );
  window.log.info(prefix, StringUtils.toHex(metaGroupDumps));
}

async function mergeUserConfigsWithIncomingUpdates(
  incomingConfigs: Array<RetrieveMessageItemWithNamespace>
): Promise<Map<ConfigWrapperUser, IncomingUserResult>> {
  // first, group by namespaces so we do a single merge call
  // Note: this call throws if given a non user kind as this function should only handle user variants/kinds
  const groupedByNamespaces = byUserNamespace(incomingConfigs);

  const groupedResults: Map<ConfigWrapperUser, IncomingUserResult> = new Map();

  const us = UserUtils.getOurPubKeyStrFromCache();

  try {
    for (let index = 0; index < groupedByNamespaces.size; index++) {
      const namespace = [...groupedByNamespaces.keys()][index];
      const sameVariant = groupedByNamespaces.get(namespace);
      if (!sameVariant?.length) {
        continue;
      }
      const toMerge = sameVariant.map(msg => ({
        data: StringUtils.fromBase64ToArray(msg.data),
        hash: msg.hash,
      }));

      const variant = LibSessionUtil.userNamespaceToVariant(namespace);

      if (window.sessionFeatureFlags.debug.debugLibsessionDumps) {
        await printDumpForDebug(
          `printDumpsForDebugging: before merge of ${toMerge.length}, ${variant}:`,
          variant
        );
      }
      const hashesMerged = await UserGenericWrapperActions.merge(variant, toMerge);

      const needsDump = await UserGenericWrapperActions.needsDump(variant);
      const needsPush = await UserGenericWrapperActions.needsPush(variant);
      const mergedTimestamps = sameVariant
        .filter(m => hashesMerged.includes(m.hash))
        .map(m => m.storedAt);
      const latestEnvelopeTimestamp = Math.max(...mergedTimestamps);

      window.log.debug(
        `${variant}: needsPush:${needsPush} needsDump:${needsDump}; mergedCount:${hashesMerged.length} `
      );

      if (window.sessionFeatureFlags.debug.debugLibsessionDumps) {
        await printDumpForDebug(`printDumpsForDebugging: after merge of ${variant}:`, variant);
      }
      const incomingConfResult: IncomingUserResult = {
        needsDump,
        needsPush,
        publicKey: us,
        namespace,
        latestEnvelopeTimestamp: latestEnvelopeTimestamp || Date.now(),
      };
      groupedResults.set(variant, incomingConfResult);
    }

    return groupedResults;
  } catch (e) {
    window.log.error('mergeConfigsWithIncomingUpdates failed with', e);
    throw e;
  }
}

export function getSettingsKeyFromLibsessionWrapper(
  wrapperType: ConfigWrapperObjectTypesMeta
): string | null {
  if (!isUserConfigWrapperType(wrapperType)) {
    throw new Error(
      `getSettingsKeyFromLibsessionWrapper only cares about user variants but got ${wrapperType}`
    );
  }
  switch (wrapperType) {
    case 'UserConfig':
      return SettingsKey.latestUserProfileEnvelopeTimestamp;
    case 'ContactsConfig':
      return SettingsKey.latestUserContactsEnvelopeTimestamp;
    case 'UserGroupsConfig':
      return SettingsKey.latestUserGroupEnvelopeTimestamp;
    case 'ConvoInfoVolatileConfig':
      return null; // we don't really care about the convo info volatile one
    default:
      try {
        assertUnreachable(
          wrapperType,
          `getSettingsKeyFromLibsessionWrapper unknown type: ${wrapperType}`
        );
      } catch (e) {
        window.log.warn('assertUnreachable:', e.message);
      }
      return null;
  }
}

async function updateLibsessionLatestProcessedUserTimestamp(
  wrapperType: ConfigWrapperUser,
  latestEnvelopeTimestamp: number
) {
  const settingsKey = getSettingsKeyFromLibsessionWrapper(wrapperType);
  if (!settingsKey) {
    return;
  }
  const currentLatestEnvelopeProcessed = Storage.get(settingsKey) || 0;

  const newLatestProcessed = Math.max(
    latestEnvelopeTimestamp,
    isNumber(currentLatestEnvelopeProcessed) ? currentLatestEnvelopeProcessed : 0
  );
  if (newLatestProcessed !== currentLatestEnvelopeProcessed || currentLatestEnvelopeProcessed) {
    await Storage.put(settingsKey, newLatestProcessed);
  }
}

/**
 * NOTE When adding new properties to the wrapper, don't update the conversation model here because the merge has not been done yet.
 * Instead you will need to updateOurProfileLegacyOrViaLibSession() to support them
 */
async function handleUserProfileUpdate(result: IncomingUserResult): Promise<void> {
  const profilePic = await UserConfigWrapperActions.getProfilePic();
  const displayName = await UserConfigWrapperActions.getName();
  const priority = await UserConfigWrapperActions.getPriority();
  if (!profilePic || isEmpty(profilePic)) {
    return;
  }

  const currentBlindedMsgRequest = Storage.get(SettingsKey.hasBlindedMsgRequestsEnabled);
  const newBlindedMsgRequest = await UserConfigWrapperActions.getEnableBlindedMsgRequest();
  if (!isNil(newBlindedMsgRequest) && newBlindedMsgRequest !== currentBlindedMsgRequest) {
    await window.setSettingValue(SettingsKey.hasBlindedMsgRequestsEnabled, newBlindedMsgRequest); // this does the dispatch to redux
  }

  const picUpdate =
    profilePic.key &&
    !isEmpty(profilePic.key) &&
    !isEmpty(profilePic.url) &&
    profilePic.key.length === 32;

  // NOTE: if you do any changes to the user's settings which are synced, it should be done above the `updateOurProfileViaLibSession` call
  await updateOurProfileViaLibSession({
    displayName: displayName || '',
    profileUrl: picUpdate ? profilePic.url : null,
    profileKey: picUpdate ? profilePic.key : null,
    priority,
  });

  // NOTE: If we want to update the conversation in memory with changes from the updated user profile we need to wait until the profile has been updated to prevent multiple merge conflicts
  const ourConvo = ConvoHub.use().get(UserUtils.getOurPubKeyStrFromCache());

  if (ourConvo) {
    let changes = false;

    const expireTimer = ourConvo.getExpireTimer();

    const wrapperNoteToSelfExpirySeconds = await UserConfigWrapperActions.getNoteToSelfExpiry();

    if (wrapperNoteToSelfExpirySeconds !== expireTimer) {
      const success = await ourConvo.updateExpireTimer({
        providedDisappearingMode:
          wrapperNoteToSelfExpirySeconds && wrapperNoteToSelfExpirySeconds > 0
            ? 'deleteAfterSend'
            : 'off',
        providedExpireTimer: wrapperNoteToSelfExpirySeconds,
        providedSource: ourConvo.id,
        sentAt: result.latestEnvelopeTimestamp,
        fromSync: true,
        shouldCommitConvo: false,
        fromCurrentDevice: false,
        fromConfigMessage: true,
        messageHash: null,
      });
      changes = success;
    }

    // make sure to write the changes to the database now as the `AvatarDownloadJob` triggered by updateOurProfileLegacyOrViaLibSession might take some time before getting run
    if (changes) {
      await ourConvo.commit();
    }
  }

  const settingsKey = SettingsKey.latestUserProfileEnvelopeTimestamp;
  const currentLatestEnvelopeProcessed = Storage.get(settingsKey) || 0;

  const newLatestProcessed = Math.max(
    result.latestEnvelopeTimestamp,
    isNumber(currentLatestEnvelopeProcessed) ? currentLatestEnvelopeProcessed : 0
  );
  if (newLatestProcessed !== currentLatestEnvelopeProcessed) {
    await Storage.put(settingsKey, newLatestProcessed);
  }
}

function getContactsToRemoveFromDB(contactsInWrapper: Array<ContactInfo>) {
  const allContactsInDBWhichShouldBeInWrapperIds = ConvoHub.use()
    .getConversations()
    .filter(SessionUtilContact.isContactToStoreInWrapper)
    .map(m => m.id);

  const currentlySelectedConversationId = getCurrentlySelectedConversationOutsideRedux();
  const currentlySelectedConvo = currentlySelectedConversationId
    ? ConvoHub.use().get(currentlySelectedConversationId)
    : undefined;

  // we might have some contacts not in the wrapper anymore, so let's clean things up.

  const convoIdsInDbButNotWrapper = difference(
    allContactsInDBWhichShouldBeInWrapperIds,
    contactsInWrapper.map(m => m.id)
  );

  // When starting a conversation with a new user, it is not in the wrapper yet, only when we send the first message.
  // We do not want to forcefully remove that contact as the user might be typing a message to him.
  // So let's check if that currently selected conversation should be forcefully closed or not
  if (
    currentlySelectedConversationId &&
    currentlySelectedConvo &&
    convoIdsInDbButNotWrapper.includes(currentlySelectedConversationId)
  ) {
    if (
      currentlySelectedConvo.isPrivate() &&
      !currentlySelectedConvo.isApproved() &&
      !currentlySelectedConvo.didApproveMe()
    ) {
      const foundIndex = convoIdsInDbButNotWrapper.findIndex(
        m => m === currentlySelectedConversationId
      );
      if (foundIndex !== -1) {
        convoIdsInDbButNotWrapper.splice(foundIndex, 1);
      }
    }
  }
  return convoIdsInDbButNotWrapper;
}

async function deleteContactsFromDB(contactsToRemove: Array<string>) {
  window.log.debug('contacts to fully remove after wrapper merge', contactsToRemove);
  for (let index = 0; index < contactsToRemove.length; index++) {
    const contactToRemove = contactsToRemove[index];
    try {
      await ConvoHub.use().delete1o1(contactToRemove, {
        fromSyncMessage: true,
        justHidePrivate: false,
        keepMessages: false,
      });
    } catch (e) {
      window.log.warn(
        `after merge: deleteContactsFromDB ${contactToRemove} failed with `,
        e.message
      );
    }
  }
}

async function handleContactsUpdate(result: IncomingUserResult) {
  const us = UserUtils.getOurPubKeyStrFromCache();

  const allContactsInWrapper = await ContactsWrapperActions.getAll();
  const contactsToRemoveFromDB = getContactsToRemoveFromDB(allContactsInWrapper);
  await deleteContactsFromDB(contactsToRemoveFromDB);

  // create new contact conversation here, and update their state with what is part of the wrapper
  for (let index = 0; index < allContactsInWrapper.length; index++) {
    const wrapperConvo = allContactsInWrapper[index];

    if (wrapperConvo.id === us) {
      // our profile update comes from our userProfile, not from the contacts wrapper.
      continue;
    }
    const contactConvo = await ConvoHub.use().getOrCreateAndWait(
      wrapperConvo.id,
      ConversationTypeEnum.PRIVATE
    );
    if (wrapperConvo.id && contactConvo) {
      let changes = false;

      // the display name set is handled in `updateProfileOfContact`
      if (wrapperConvo.nickname !== contactConvo.getNickname()) {
        await contactConvo.setNickname(wrapperConvo.nickname || null, false);
        changes = true;
      }

      const currentPriority = contactConvo.getPriority();
      if (wrapperConvo.priority !== currentPriority) {
        if (wrapperConvo.priority === CONVERSATION_PRIORITIES.hidden) {
          window.log.info(
            'contact marked as hidden and was not before. Deleting all messages from that user'
          );
          await deleteAllMessagesByConvoIdNoConfirmation(wrapperConvo.id);
        }
        await contactConvo.setPriorityFromWrapper(wrapperConvo.priority);
        changes = true;
      }

      if (Boolean(wrapperConvo.approved) !== contactConvo.isApproved()) {
        await contactConvo.setIsApproved(Boolean(wrapperConvo.approved), false);
        changes = true;
      }

      if (Boolean(wrapperConvo.approvedMe) !== contactConvo.didApproveMe()) {
        await contactConvo.setDidApproveMe(Boolean(wrapperConvo.approvedMe), false);
        changes = true;
      }

      if (
        wrapperConvo.expirationTimerSeconds !== contactConvo.getExpireTimer() ||
        wrapperConvo.expirationMode !== contactConvo.getExpirationMode()
      ) {
        const success = await contactConvo.updateExpireTimer({
          providedDisappearingMode: wrapperConvo.expirationMode,
          providedExpireTimer: wrapperConvo.expirationTimerSeconds,
          providedSource: wrapperConvo.id,
          sentAt: result.latestEnvelopeTimestamp, // this is most likely incorrect, but that's all we have
          fromSync: true,
          fromCurrentDevice: false,
          shouldCommitConvo: false,
          fromConfigMessage: true,
          messageHash: null,
        });
        changes = changes || success;
      }

      // we want to set the active_at to the created_at timestamp if active_at is unset, so that it shows up in our list.
      if (!contactConvo.getActiveAt() && wrapperConvo.createdAtSeconds) {
        contactConvo.set({ active_at: wrapperConvo.createdAtSeconds * 1000 });
        changes = true;
      }

      const convoBlocked = wrapperConvo.blocked || false;
      await BlockedNumberController.setBlocked(wrapperConvo.id, convoBlocked);

      // make sure to write the changes to the database now as the `AvatarDownloadJob` below might take some time before getting run
      if (changes) {
        await contactConvo.commit();
      }

      // we still need to handle the `name` (synchronous) and the `profilePicture` (asynchronous)
      await ProfileManager.updateProfileOfContact(
        contactConvo.id,
        wrapperConvo.name,
        wrapperConvo.profilePicture?.url || null,
        wrapperConvo.profilePicture?.key || null
      );
    }
  }
}

async function handleCommunitiesUpdate() {
  // first let's check which communities needs to be joined or left by doing a diff of what is in the wrapper and what is in the DB

  const allCommunitiesInWrapper = await UserGroupsWrapperActions.getAllCommunities();
  window.log.debug(
    'allCommunitiesInWrapper',
    allCommunitiesInWrapper.map(m => m.fullUrlWithPubkey)
  );
  const allCommunitiesConversation = ConvoHub.use()
    .getConversations()
    .filter(SessionUtilUserGroups.isCommunityToStoreInWrapper);

  const allCommunitiesIdsInDB = allCommunitiesConversation.map(m => m.id);
  window.log.debug('allCommunitiesIdsInDB', allCommunitiesIdsInDB);

  const communitiesIdsInWrapper = compact(
    allCommunitiesInWrapper.map(m => {
      try {
        const builtConvoId = OpenGroupUtils.getOpenGroupV2ConversationId(
          m.baseUrl,
          m.roomCasePreserved
        );
        return builtConvoId;
      } catch (e) {
        return null;
      }
    })
  );

  const communitiesToJoinInDB = compact(
    allCommunitiesInWrapper.map(m => {
      try {
        const builtConvoId = OpenGroupUtils.getOpenGroupV2ConversationId(
          m.baseUrl,
          m.roomCasePreserved
        );
        return allCommunitiesIdsInDB.includes(builtConvoId) ? null : m;
      } catch (e) {
        return null;
      }
    })
  );

  const communitiesToLeaveInDB = compact(
    allCommunitiesConversation.map(m => {
      return communitiesIdsInWrapper.includes(m.id) ? null : m;
    })
  );

  for (let index = 0; index < communitiesToLeaveInDB.length; index++) {
    const toLeave = communitiesToLeaveInDB[index];
    window.log.info('leaving community with convoId ', toLeave.id);
    await ConvoHub.use().deleteCommunity(toLeave.id);
  }

  // this call can take quite a long time but must be awaited (as it is async and create the entry in the DB, used as a diff)
  try {
    await Promise.all(
      communitiesToJoinInDB.map(async toJoin => {
        window.log.info('joining community with convoId ', toJoin.fullUrlWithPubkey);
        return getOpenGroupManager().attemptConnectionV2OneAtATime(
          toJoin.baseUrl,
          toJoin.roomCasePreserved,
          toJoin.pubkeyHex
        );
      })
    );
  } catch (e) {
    window.log.warn(
      `joining community with failed with one of ${communitiesToJoinInDB}`,
      e.message
    );
  }

  // if the convos already exists, make sure to update the fields if needed
  for (let index = 0; index < allCommunitiesInWrapper.length; index++) {
    const fromWrapper = allCommunitiesInWrapper[index];
    const convoId = OpenGroupUtils.getOpenGroupV2ConversationId(
      fromWrapper.baseUrl,
      fromWrapper.roomCasePreserved
    );

    const communityConvo = ConvoHub.use().get(convoId);
    if (fromWrapper && communityConvo) {
      let changes = false;

      changes =
        (await communityConvo.setPriorityFromWrapper(fromWrapper.priority, false)) || changes;

      // make sure to write the changes to the database now as the `AvatarDownloadJob` below might take some time before getting run
      if (changes) {
        await communityConvo.commit();
      }
    }
  }
}

async function handleLegacyGroupUpdate() {
  // first let's check which legacy groups needs left by doing a diff of what is in the wrapper and what is in the DB
  const allLegacyGroupsInWrapper = await UserGroupsWrapperActions.getAllLegacyGroups();
  const allLegacyGroupsInDb = ConvoHub.use()
    .getConversations()
    .filter(SessionUtilUserGroups.isLegacyGroupToRemoveFromDBIfNotInWrapper);

  const allLegacyGroupsIdsInDB = allLegacyGroupsInDb.map(m => m.id);
  const allLegacyGroupsIdsInWrapper = allLegacyGroupsInWrapper.map(m => m.pubkeyHex);

  window.log.debug(`allLegacyGroupsInWrapper: ${allLegacyGroupsInWrapper.map(m => m.pubkeyHex)} `);
  window.log.debug(`allLegacyGroupsIdsInDB: ${allLegacyGroupsIdsInDB} `);

  const legacyGroupsToLeaveInDB = allLegacyGroupsInDb.filter(m => {
    return !allLegacyGroupsIdsInWrapper.includes(m.id);
  });

  window.log.info(
    `we have to leave ${legacyGroupsToLeaveInDB.length} legacy groups in DB compared to what is in the wrapper`
  );

  for (let index = 0; index < legacyGroupsToLeaveInDB.length; index++) {
    const toLeave = legacyGroupsToLeaveInDB[index];
    window.log.info(
      'leaving legacy group from configuration sync message with convoId ',
      toLeave.id
    );
    const toLeaveFromDb = ConvoHub.use().get(toLeave.id);
    if (PubKey.is05Pubkey(toLeaveFromDb.id)) {
      // the wrapper told us that this group is not tracked, so even if we left/got kicked from it, remove it from the DB completely
      await ConvoHub.use().deleteLegacyGroup(toLeaveFromDb.id, {
        fromSyncMessage: true,
        sendLeaveMessage: false, // this comes from the wrapper, so we must have left/got kicked from that group already and our device already handled it.
      });
    }
  }

  for (let index = 0; index < allLegacyGroupsInWrapper.length; index++) {
    const fromWrapper = allLegacyGroupsInWrapper[index];

    const legacyGroupConvo = ConvoHub.use().get(fromWrapper.pubkeyHex);
    if (!legacyGroupConvo) {
      // this should not happen as we made sure to create them before
      window.log.warn(
        'could not find legacy group which should already be there:',
        fromWrapper.pubkeyHex
      );
      continue;
    }

    // legacy groups can only be unpinned or deleted now that they are readonly.
    const changes = await legacyGroupConvo.setPriorityFromWrapper(fromWrapper.priority, false);

    if (changes) {
      // this commit will grab the latest encryption key pair and add it to the user group wrapper if needed
      await legacyGroupConvo.commit();
    }
  }
}

async function handleSingleGroupUpdate({
  groupInWrapper,
  userEdKeypair,
}: {
  groupInWrapper: UserGroupsGet;
  userEdKeypair: UserUtils.ByteKeyPair;
}) {
  const groupPk = groupInWrapper.pubkeyHex;
  try {
    // dump is always empty when creating a new groupInfo
    await MetaGroupWrapperActions.init(groupPk, {
      metaDumped: null,
      userEd25519Secretkey: toFixedUint8ArrayOfLength(userEdKeypair.privKeyBytes, 64).buffer,
      groupEd25519Secretkey: groupInWrapper.secretKey,
      groupEd25519Pubkey: toFixedUint8ArrayOfLength(HexString.fromHexString(groupPk.slice(2)), 32)
        .buffer,
    });
  } catch (e) {
    window.log.warn(
      `handleSingleGroupUpdate meta wrapper init of "${groupPk}" failed with`,
      e.message
    );
  }

  const convoExisting = ConvoHub.use().get(groupPk);
  if (!convoExisting) {
    const created = await ConvoHub.use().getOrCreateAndWait(groupPk, ConversationTypeEnum.GROUPV2);
    const joinedAt =
      groupInWrapper.joinedAtSeconds * 1000 || CONVERSATION.LAST_JOINED_FALLBACK_TIMESTAMP;
    const expireTimer =
      groupInWrapper.disappearingTimerSeconds && groupInWrapper.disappearingTimerSeconds > 0
        ? groupInWrapper.disappearingTimerSeconds
        : undefined;
    created.set({
      active_at: joinedAt,
      displayNameInProfile: groupInWrapper.name || undefined,
      priority: groupInWrapper.priority,
      lastJoinedTimestamp: joinedAt,
      expireTimer,
      expirationMode: expireTimer ? 'deleteAfterSend' : 'off',
      didApproveMe: groupInWrapper.invitePending,
    });
    await created.commit();
    getSwarmPollingInstance().addGroupId(PubKey.cast(groupPk));
  } else {
    // Note: the priority is the only **field** we want to sync from our user group wrapper for 03-groups
    const changes = await convoExisting.setPriorityFromWrapper(groupInWrapper.priority, false);
    if (changes) {
      await convoExisting.commit();
    }
  }
}

async function handleSingleGroupUpdateToLeave(toLeave: GroupPubkeyType) {
  // that group is not in the wrapper but in our local DB. it must be removed and cleaned
  try {
    window.log.debug(
      `About to deleteGroup ${toLeave} via handleSingleGroupUpdateToLeave as in DB but not in wrapper`
    );

    await ConvoHub.use().deleteGroup(toLeave, {
      fromSyncMessage: true,
      sendLeaveMessage: false,
      deletionType: 'doNotKeep',
      deleteAllMessagesOnSwarm: false,
      forceDestroyForAllMembers: false,
      clearFetchedHashes: true,
    });
  } catch (e) {
    window.log.info('Failed to deleteClosedGroup with: ', e.message);
  }
}

/**
 * Called when we just got a userGroups merge from the network. We need to apply the changes to our local state. (i.e. DB and redux slice of 03 groups)
 */
async function handleGroupUpdate(_latestEnvelopeTimestamp: number) {
  // first let's check which groups needs to be joined or left by doing a diff of what is in the wrapper and what is in the DB
  const allGroupsInWrapper = await UserGroupsWrapperActions.getAllGroups();
  const allGroupsIdsInDb = ConvoHub.use()
    .getConversations()
    .map(m => m.id)
    .filter(PubKey.is03Pubkey);

  const allGroupsIdsInWrapper = allGroupsInWrapper.map(m => m.pubkeyHex);
  window.log.debug('allGroupsIdsInWrapper', stringify(allGroupsIdsInWrapper));
  window.log.debug('allGroupsIdsInDb', stringify(allGroupsIdsInDb));

  const userEdKeypair = await UserUtils.getUserED25519KeyPairBytes();
  if (!userEdKeypair) {
    throw new Error('userEdKeypair is not set');
  }

  for (let index = 0; index < allGroupsInWrapper.length; index++) {
    const groupInWrapper = allGroupsInWrapper[index];
    window.inboxStore?.dispatch(groupInfoActions.handleUserGroupUpdate(groupInWrapper) as any);
    await handleSingleGroupUpdate({ groupInWrapper, userEdKeypair });
  }

  const groupsInDbButNotInWrapper = difference(allGroupsIdsInDb, allGroupsIdsInWrapper);
  window.log.info(
    `we have to leave ${groupsInDbButNotInWrapper.length} 03 groups in DB compared to what is in the wrapper`,
    groupsInDbButNotInWrapper
  );

  for (let index = 0; index < groupsInDbButNotInWrapper.length; index++) {
    const toRemove = groupsInDbButNotInWrapper[index];
    await handleSingleGroupUpdateToLeave(toRemove);
  }
}

async function handleUserGroupsUpdate(result: IncomingUserResult) {
  const toHandle = SessionUtilUserGroups.getUserGroupTypes();
  for (let index = 0; index < toHandle.length; index++) {
    const typeToHandle = toHandle[index];
    switch (typeToHandle) {
      case 'Community':
        await handleCommunitiesUpdate();
        break;
      case 'LegacyGroup':
        await handleLegacyGroupUpdate();
        break;
      case 'Group':
        await handleGroupUpdate(result.latestEnvelopeTimestamp);
        break;

      default:
        assertUnreachable(typeToHandle, `handleUserGroupsUpdate unhandled type "${typeToHandle}"`);
    }
  }
}

async function applyConvoVolatileUpdateFromWrapper(
  convoId: string,
  forcedUnread: boolean,
  lastReadMessageTimestamp: number
) {
  const foundConvo = ConvoHub.use().get(convoId);
  if (!foundConvo) {
    return;
  }

  try {
    if (foundConvo.isPrivate() && !foundConvo.isMe() && foundConvo.getExpireTimer() > 0) {
      const messagesExpiring = await Data.getUnreadDisappearingByConversation(
        convoId,
        lastReadMessageTimestamp
      );

      const messagesExpiringAfterRead = messagesExpiring.filter(
        m => m.getExpirationType() === 'deleteAfterRead' && m.getExpireTimerSeconds() > 0
      );

      const messageIdsToFetchExpiriesFor = compact(messagesExpiringAfterRead.map(m => m.id));

      if (messageIdsToFetchExpiriesFor.length) {
        await FetchMsgExpirySwarm.queueNewJobIfNeeded(messageIdsToFetchExpiriesFor);
      }
    }

    // this mark all the messages sent before fromWrapper.lastRead as read and update the unreadCount
    await foundConvo.markReadFromConfigMessage(lastReadMessageTimestamp);
    // this commits to the DB, if needed
    await foundConvo.markAsUnread(forcedUnread, true);

    if (SessionUtilConvoInfoVolatile.isConvoToStoreInWrapper(foundConvo)) {
      await SessionUtilConvoInfoVolatile.refreshConvoVolatileCached(
        foundConvo.id,
        foundConvo.isClosedGroup(),
        false
      );

      await foundConvo.refreshInMemoryDetails();
    }
  } catch (e) {
    window.log.warn(
      `applyConvoVolatileUpdateFromWrapper of "${convoId}" failed with error ${e.message}`
    );
  }
}

async function handleConvoInfoVolatileUpdate() {
  const types = SessionUtilConvoInfoVolatile.getConvoInfoVolatileTypes();
  for (let typeIndex = 0; typeIndex < types.length; typeIndex++) {
    const type = types[typeIndex];
    switch (type) {
      case '1o1':
        try {
          // Note: "Note to Self" comes here too
          const wrapper1o1s = await ConvoInfoVolatileWrapperActions.getAll1o1();
          for (let index = 0; index < wrapper1o1s.length; index++) {
            const fromWrapper = wrapper1o1s[index];

            await applyConvoVolatileUpdateFromWrapper(
              fromWrapper.pubkeyHex,
              fromWrapper.unread,
              fromWrapper.lastRead
            );
          }
        } catch (e) {
          window.log.warn('handleConvoInfoVolatileUpdate of "1o1" failed with error: ', e.message);
        }

        break;
      case 'Community':
        try {
          const wrapperCommunities = await ConvoInfoVolatileWrapperActions.getAllCommunities();
          for (let index = 0; index < wrapperCommunities.length; index++) {
            const fromWrapper = wrapperCommunities[index];

            const convoId = getOpenGroupV2ConversationId(
              fromWrapper.baseUrl,
              fromWrapper.roomCasePreserved
            );

            await applyConvoVolatileUpdateFromWrapper(
              convoId,
              fromWrapper.unread,
              fromWrapper.lastRead
            );
          }
        } catch (e) {
          window.log.warn(
            'handleConvoInfoVolatileUpdate of "Community" failed with error: ',
            e.message
          );
        }
        break;

      case 'LegacyGroup':
        try {
          const legacyGroups = await ConvoInfoVolatileWrapperActions.getAllLegacyGroups();
          for (let index = 0; index < legacyGroups.length; index++) {
            const fromWrapper = legacyGroups[index];

            await applyConvoVolatileUpdateFromWrapper(
              fromWrapper.pubkeyHex,
              fromWrapper.unread,
              fromWrapper.lastRead
            );
          }
        } catch (e) {
          window.log.warn(
            'handleConvoInfoVolatileUpdate of "LegacyGroup" failed with error: ',
            e.message
          );
        }
        break;

      case 'Group':
        try {
          const groupsV2 = await ConvoInfoVolatileWrapperActions.getAllGroups();
          for (let index = 0; index < groupsV2.length; index++) {
            const fromWrapper = groupsV2[index];

            try {
              await applyConvoVolatileUpdateFromWrapper(
                fromWrapper.pubkeyHex,
                fromWrapper.unread,
                fromWrapper.lastRead
              );
            } catch (e) {
              window.log.warn(
                'handleConvoInfoVolatileUpdate of "Group" failed with error: ',
                e.message
              );
            }
          }
        } catch (e) {
          window.log.warn('getAllGroups of "Group" failed with error: ', e.message);
        }
        break;

      default:
        assertUnreachable(type, `handleConvoInfoVolatileUpdate: unhandled switch case: ${type}`);
    }
  }
}

async function processUserMergingResults(results: Map<ConfigWrapperUser, IncomingUserResult>) {
  if (!results || !results.size) {
    return;
  }

  const keys = [...results.keys()];
  for (let index = 0; index < keys.length; index++) {
    const wrapperType = keys[index];
    const incomingResult = results.get(wrapperType);
    if (!incomingResult) {
      continue;
    }

    try {
      const { namespace } = incomingResult;
      switch (namespace) {
        case SnodeNamespaces.UserProfile:
          await handleUserProfileUpdate(incomingResult);
          break;
        case SnodeNamespaces.UserContacts:
          await handleContactsUpdate(incomingResult);
          break;
        case SnodeNamespaces.UserGroups:
          await handleUserGroupsUpdate(incomingResult);
          break;
        case SnodeNamespaces.ConvoInfoVolatile:
          await handleConvoInfoVolatileUpdate();
          break;
        default:
          try {
            // we catch errors here because an old client knowing about a new type of config coming from the network should not just crash
            assertUnreachable(
              namespace,
              `processUserMergingResults unsupported namespace: "${namespace}"`
            );
          } catch (e) {
            window.log.warn('assertUnreachable failed', e.message);
          }
      }
      const variant = LibSessionUtil.userNamespaceToVariant(namespace);
      try {
        await updateLibsessionLatestProcessedUserTimestamp(
          variant,
          incomingResult.latestEnvelopeTimestamp
        );
      } catch (e) {
        window.log.error(`updateLibsessionLatestProcessedUserTimestamp failed with "${e.message}"`);
      }

      if (incomingResult.needsDump) {
        // The config data had changes so regenerate the dump and save it
        const dump = await UserGenericWrapperActions.dump(variant);
        await ConfigDumpData.saveConfigDump({
          data: dump,
          publicKey: incomingResult.publicKey,
          variant,
        });
      }
    } catch (e) {
      window.log.error(`processMergingResults failed with ${e.message}`);
      return;
    }
  }
}

async function handleUserConfigMessagesViaLibSession(
  configMessages: Array<RetrieveMessageItemWithNamespace>
) {
  if (isEmpty(configMessages)) {
    return;
  }

  window?.log?.debug(
    `Handling our sharedConfig message via libsession_util ${JSON.stringify(
      configMessages.map(m => ({
        hash: m.hash,
        namespace: m.namespace,
      }))
    )}`
  );

  const incomingMergeResult = await mergeUserConfigsWithIncomingUpdates(configMessages);
  await processUserMergingResults(incomingMergeResult);
}

async function updateOurProfileViaLibSession(
  {
    displayName,
    priority,
    profileKey,
    profileUrl,
  }: {
    displayName: string;
    profileUrl: string | null;
    profileKey: Uint8Array | null;
    priority: number | null;
  } // passing null means to not update the priority at all (used for legacy config message for now)
) {
  await ProfileManager.updateOurProfileSync({ displayName, profileUrl, profileKey, priority });

  // do not trigger a sign in by linking if the display name is empty
  if (!isEmpty(displayName)) {
    window.Whisper.events.trigger(configurationMessageReceived, displayName);
  } else {
    window?.log?.warn('Got a configuration message but the display name is empty');
  }
}

export const ConfigMessageHandler = {
  handleUserConfigMessagesViaLibSession,
};
