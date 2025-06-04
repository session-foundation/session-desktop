import { GroupPubkeyType } from 'libsession_util_nodejs';
import { isEmpty, isFinite, isNumber } from 'lodash';
import { to_hex } from 'libsodium-wrappers-sumo';
import { Data } from '../../../../data/data';
import { messagesExpired } from '../../../../state/ducks/conversations';
import { groupInfoActions } from '../../../../state/ducks/metaGroups';
import {
  MetaGroupWrapperActions,
  UserGroupsWrapperActions,
} from '../../../../webworker/workers/browser/libsession_worker_interface';
import { ed25519Str, fromBase64ToArray, toHex } from '../../../utils/String';
import { GroupPendingRemovals } from '../../../utils/job_runners/jobs/GroupPendingRemovalsJob';
import { LibSessionUtil } from '../../../utils/libsession/libsession_utils';
import { SnodeNamespaces } from '../namespaces';
import { RetrieveMessageItemWithNamespace } from '../types';
import { ConvoHub } from '../../../conversations';
import { ProfileManager } from '../../../profile_manager/ProfileManager';
import { UserUtils } from '../../../utils';
import { GroupSync } from '../../../utils/job_runners/jobs/GroupSyncJob';
import { destroyMessagesAndUpdateRedux } from '../../../disappearing_messages';
import { ConversationTypeEnum } from '../../../../models/types';
import { AvatarDownload } from '../../../utils/job_runners/jobs/AvatarDownloadJob';

/**
 * This is a basic optimization to avoid running the logic when the `deleteBeforeSeconds`
 *  and the `deleteAttachBeforeSeconds` does not change between each polls.
 * Essentially, when the `deleteBeforeSeconds` is set in the group info config,
 *   - on start that map will be empty so we will run the logic to delete any messages sent before that.
 *   - after each poll, we will only rerun the logic if the new `deleteBeforeSeconds` is higher than the current setting.
 *
 */
const lastAppliedRemoveMsgSentBeforeSeconds = new Map<GroupPubkeyType, number>();
const lastAppliedRemoveAttachmentSentBeforeSeconds = new Map<GroupPubkeyType, number>();

async function handleMetaMergeResults(groupPk: GroupPubkeyType) {
  const infos = await MetaGroupWrapperActions.infoGet(groupPk);
  if (window.sessionFeatureFlags.debug.debugLibsessionDumps) {
    const dumps = await MetaGroupWrapperActions.metaMakeDump(groupPk);
    window.log.info(
      `pushChangesToGroupSwarmIfNeeded: current meta dump: ${ed25519Str(groupPk)}:`,
      to_hex(dumps)
    );
  }
  if (infos.isDestroyed) {
    window.log.info(`${ed25519Str(groupPk)} is marked as destroyed after merge. Removing it.`);
    await ConvoHub.use().deleteGroup(groupPk, {
      sendLeaveMessage: false,
      fromSyncMessage: false,
      deletionType: 'keepAsDestroyed', // we just got something from the group's swarm, so it is not pendingInvite
      deleteAllMessagesOnSwarm: false,
      forceDestroyForAllMembers: false,
      clearFetchedHashes: true,
    });
  } else {
    if (
      isNumber(infos.deleteBeforeSeconds) &&
      isFinite(infos.deleteBeforeSeconds) &&
      infos.deleteBeforeSeconds > 0 &&
      (lastAppliedRemoveMsgSentBeforeSeconds.get(groupPk) || 0) < infos.deleteBeforeSeconds
    ) {
      // delete any messages in this conversation sent before that timestamp (in seconds)
      const deletedMsgIds = await Data.removeAllMessagesInConversationSentBefore({
        deleteBeforeSeconds: infos.deleteBeforeSeconds,
        conversationId: groupPk,
      });
      window.log.info(
        `removeAllMessagesInConversationSentBefore of ${ed25519Str(groupPk)} before ${infos.deleteBeforeSeconds}: `,
        deletedMsgIds
      );
      window.inboxStore?.dispatch(
        messagesExpired(deletedMsgIds.map(messageId => ({ conversationId: groupPk, messageId })))
      );
      ConvoHub.use().get(groupPk)?.updateLastMessage();
      lastAppliedRemoveMsgSentBeforeSeconds.set(groupPk, infos.deleteBeforeSeconds);
    }

    if (
      isNumber(infos.deleteAttachBeforeSeconds) &&
      isFinite(infos.deleteAttachBeforeSeconds) &&
      infos.deleteAttachBeforeSeconds > 0 &&
      (lastAppliedRemoveAttachmentSentBeforeSeconds.get(groupPk) || 0) <
        infos.deleteAttachBeforeSeconds
    ) {
      // delete any attachments in this conversation sent before that timestamp (in seconds)
      const impactedMsgModels = await Data.getAllMessagesWithAttachmentsInConversationSentBefore({
        deleteAttachBeforeSeconds: infos.deleteAttachBeforeSeconds,
        conversationId: groupPk,
      });
      window.log.info(
        `getAllMessagesWithAttachmentsInConversationSentBefore of ${ed25519Str(groupPk)} before ${infos.deleteAttachBeforeSeconds}: impactedMsgModelsIds `,
        impactedMsgModels.map(m => m.id)
      );

      await destroyMessagesAndUpdateRedux(
        impactedMsgModels.map(m => ({ conversationKey: groupPk, messageId: m.id }))
      );
      ConvoHub.use().get(groupPk)?.updateLastMessage();

      lastAppliedRemoveAttachmentSentBeforeSeconds.set(groupPk, infos.deleteAttachBeforeSeconds);
    }
  }
  const membersWithPendingRemovals =
    await MetaGroupWrapperActions.memberGetAllPendingRemovals(groupPk);
  if (membersWithPendingRemovals.length) {
    const group = await UserGroupsWrapperActions.getGroup(groupPk);
    if (group && group.secretKey && !isEmpty(group.secretKey)) {
      await GroupPendingRemovals.addJob({ groupPk });
    }
  }

  const us = UserUtils.getOurPubKeyStrFromCache();
  const usMember = await MetaGroupWrapperActions.memberGet(groupPk, us);
  let keysAlreadyHaveAdmin = await MetaGroupWrapperActions.keysAdmin(groupPk);
  const secretKeyInUserWrapper = (await UserGroupsWrapperActions.getGroup(groupPk))?.secretKey;

  // load admin keys if needed
  if (
    usMember &&
    secretKeyInUserWrapper &&
    !isEmpty(secretKeyInUserWrapper) &&
    !keysAlreadyHaveAdmin
  ) {
    try {
      await MetaGroupWrapperActions.loadAdminKeys(groupPk, secretKeyInUserWrapper);
      keysAlreadyHaveAdmin = await MetaGroupWrapperActions.keysAdmin(groupPk);
    } catch (e) {
      window.log.warn(
        `tried to update our adminKeys/state for group ${ed25519Str(groupPk)} but failed with, ${e.message}`
      );
    }
  }
  // Note: this call won't change anything if we are already an "accepted" admin, but will
  // overwrite any other states for promotion.
  if (keysAlreadyHaveAdmin && usMember) {
    // mark ourselves as accepting the promotion if needed.
    await MetaGroupWrapperActions.memberSetPromotionAccepted(groupPk, us);
  }
  // this won't do anything if there is no need for a sync, so we can safely plan one
  await GroupSync.queueNewJobIfNeeded(groupPk);

  const convo = ConvoHub.use().get(groupPk);
  const refreshedInfos = await MetaGroupWrapperActions.infoGet(groupPk);

  if (convo) {
    let changes = false;
    if (refreshedInfos.name !== convo.get('displayNameInProfile')) {
      convo.set({ displayNameInProfile: refreshedInfos.name || undefined });
      changes = true;
    }
    const expirationMode = refreshedInfos.expirySeconds ? 'deleteAfterSend' : 'off';
    if (
      refreshedInfos.expirySeconds !== convo.get('expireTimer') ||
      expirationMode !== convo.get('expirationMode')
    ) {
      convo.set({
        expireTimer: refreshedInfos.expirySeconds || undefined,
        expirationMode,
      });
      changes = true;
    }
    if (changes) {
      await convo.commit();
    }
  }

  const members = await MetaGroupWrapperActions.memberGetAll(groupPk);
  for (let index = 0; index < members.length; index++) {
    const member = members[index];
    // if our DB doesn't have details about this user, set them. Otherwise we don't want to overwrite our changes with those
    // because they are most likely out of date from what we get from the user himself.
    let memberConvoInDB = ConvoHub.use().get(member.pubkeyHex);
    if (memberConvoInDB) {
      continue;
    }
    if (!memberConvoInDB) {
      // eslint-disable-next-line no-await-in-loop
      memberConvoInDB = await ConvoHub.use().getOrCreateAndWait(
        member.pubkeyHex,
        ConversationTypeEnum.PRIVATE
      );
    }
    if (member.name && member.name !== memberConvoInDB.getRealSessionUsername()) {
      // eslint-disable-next-line no-await-in-loop
      await ProfileManager.updateProfileOfContact(
        member.pubkeyHex,
        member.name,
        member.profilePicture?.url || null,
        member.profilePicture?.key || null
      );
    }
  }
}

async function handleGroupSharedConfigMessages(
  groupConfigMessages: Array<RetrieveMessageItemWithNamespace>,
  groupPk: GroupPubkeyType
) {
  try {
    window.log.info(
      `received groupConfigMessages count: ${groupConfigMessages.length} for groupPk:${ed25519Str(
        groupPk
      )}`
    );

    if (groupConfigMessages.find(m => !m.storedAt)) {
      throw new Error('all incoming group config message should have a timestamp');
    }
    const infos = groupConfigMessages
      .filter(m => m.namespace === SnodeNamespaces.ClosedGroupInfo)
      .map(info => {
        return { data: fromBase64ToArray(info.data), hash: info.hash };
      });
    const members = groupConfigMessages
      .filter(m => m.namespace === SnodeNamespaces.ClosedGroupMembers)
      .map(info => {
        return { data: fromBase64ToArray(info.data), hash: info.hash };
      });
    const keys = groupConfigMessages
      .filter(m => m.namespace === SnodeNamespaces.ClosedGroupKeys)
      .map(info => {
        return {
          data: fromBase64ToArray(info.data),
          hash: info.hash,
          timestampMs: info.storedAt,
        };
      });
    const toMerge = {
      groupInfo: infos,
      groupKeys: keys,
      groupMember: members,
    };

    window.log.info(
      `received keys:${toMerge.groupKeys.length}, infos:${toMerge.groupInfo.length}, members:${
        toMerge.groupMember.length
      } for groupPk:${ed25519Str(groupPk)}`
    );
    // do the merge with our current state
    await MetaGroupWrapperActions.metaMerge(groupPk, toMerge);

    await handleMetaMergeResults(groupPk);

    // save updated dumps to the DB right away
    await LibSessionUtil.saveDumpsToDb(groupPk);

    await scheduleAvatarDownloadJobIfNeeded(groupPk);

    // refresh the redux slice with the merged result
    window.inboxStore?.dispatch(
      groupInfoActions.refreshGroupDetailsFromWrapper({
        groupPk,
      }) as any
    );
  } catch (e) {
    window.log.warn(
      `handleGroupSharedConfigMessages of ${groupConfigMessages.length} failed with ${e.message}`
    );
    // not rethrowing
  }
}

async function scheduleAvatarDownloadJobIfNeeded(groupPk: GroupPubkeyType) {
  try {
    const updatedInfo = await MetaGroupWrapperActions.infoGet(groupPk);

    const conversation = ConvoHub.use().get(groupPk);
    if (!conversation) {
      window.log.warn('scheduleAvatarDownloadJobIfNeeded: group: no corresponding conversation');

      return;
    }

    const profileUrl = updatedInfo.profilePicture?.url || null;
    const profileKeyHex = updatedInfo.profilePicture?.key
      ? toHex(updatedInfo.profilePicture?.key)
      : null;

    if (!profileUrl || !profileKeyHex) {
      // no avatar set for this group: make sure we also remove the one we might have locally.
      if (conversation.get('avatarPointer') || conversation.get('profileKey')) {
        conversation.set({
          avatarPointer: undefined,
          profileKey: undefined,
          avatarInProfile: undefined, // we want to remove the avatar here
        });
        await conversation.commit();
      }

      return;
    }

    // here, an avatar for this group is set. First we need to make sure if that's the same as we already have
    const prevPointer = conversation.getAvatarPointer();
    const prevProfileKey = conversation.getProfileKey();

    if (prevPointer !== profileUrl || prevProfileKey !== profileKeyHex) {
      // set the avatar for this group, it will be downloaded by the job scheduled below
      conversation.set({
        avatarPointer: profileUrl || undefined,
        profileKey: profileKeyHex || undefined,
      });
      await conversation.commit();

      // if the avatar data we had before is not the same of what we received, we need to schedule a new avatar download job.
      // this call will download the new avatar or reset the local filepath if needed
      await AvatarDownload.addAvatarDownloadJob({
        conversationId: groupPk,
      });
    }
  } catch (e) {
    window.log.error(
      `[profileupdate] Could not schedule avatar download job for ${groupPk}: ${e.message}`
    );
  }
}

export const SwarmPollingGroupConfig = { handleGroupSharedConfigMessages };
