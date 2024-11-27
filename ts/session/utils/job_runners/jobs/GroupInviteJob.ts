import { GroupPubkeyType, PubkeyType } from 'libsession_util_nodejs';
import { debounce, difference, isNumber } from 'lodash';
import { v4 } from 'uuid';
import { ToastUtils, UserUtils } from '../..';
import { groupInfoActions } from '../../../../state/ducks/metaGroups';
import {
  MetaGroupWrapperActions,
  UserGroupsWrapperActions,
} from '../../../../webworker/workers/browser/libsession_worker_interface';
import { SnodeNamespaces } from '../../../apis/snode_api/namespaces';
import { SnodeGroupSignature } from '../../../apis/snode_api/signature/groupSignature';
import { PubKey } from '../../../types';
import { runners } from '../JobRunner';
import {
  AddJobCheckReturn,
  GroupInvitePersistedData,
  PersistedJob,
  RunJobResult,
} from '../PersistedJob';
import { LibSessionUtil } from '../../libsession/libsession_utils';
import { showUpdateGroupMembersByConvoId } from '../../../../interactions/conversationInteractions';
import { ConvoHub } from '../../../conversations';
import { MessageQueue } from '../../../sending';
import { NetworkTime } from '../../../../util/NetworkTime';
import { SubaccountUnrevokeSubRequest } from '../../../apis/snode_api/SnodeRequestTypes';
import { GroupSync } from './GroupSyncJob';
import { DURATION } from '../../../constants';

const defaultMsBetweenRetries = 10000;
const defaultMaxAttempts = 1;

type JobExtraArgs = {
  groupPk: GroupPubkeyType;
  member: PubkeyType;
  inviteAsAdmin: boolean;
  /**
   * When inviting a member, we usually only want to sent a message to his swarm.
   * In the case of an invitation resend process though, we also want to make sure his token is unrevoked from the group's swarm.
   *
   */
  forceUnrevoke: boolean;
};

export function shouldAddJob(args: JobExtraArgs) {
  if (UserUtils.isUsFromCache(args.member)) {
    return false;
  }

  return true;
}

const invitesFailed = new Map<
  GroupPubkeyType,
  {
    debouncedCall: (groupPk: GroupPubkeyType) => void;
    failedMembers: Array<PubkeyType>;
  }
>();

async function addJob({ groupPk, member, inviteAsAdmin, forceUnrevoke }: JobExtraArgs) {
  if (shouldAddJob({ groupPk, member, inviteAsAdmin, forceUnrevoke })) {
    const groupInviteJob = new GroupInviteJob({
      groupPk,
      member,
      inviteAsAdmin,
      forceUnrevoke,
      nextAttemptTimestamp: Date.now(),
    });
    window.log.debug(`addGroupInviteJob: adding group invite for ${groupPk}:${member} `);

    window?.inboxStore?.dispatch(
      groupInfoActions.refreshGroupDetailsFromWrapper({ groupPk }) as any
    );
    await LibSessionUtil.saveDumpsToDb(groupPk);

    await runners.groupInviteJobRunner.addJob(groupInviteJob);

    if (inviteAsAdmin) {
      window?.inboxStore?.dispatch(
        groupInfoActions.setPromotionPending({ groupPk, pubkey: member, sending: true })
      );
    } else {
      window?.inboxStore?.dispatch(
        groupInfoActions.setInvitePending({ groupPk, pubkey: member, sending: true })
      );
    }
  }
}

function displayFailedInvitesForGroup(groupPk: GroupPubkeyType) {
  const thisGroupFailures = invitesFailed.get(groupPk);

  if (!thisGroupFailures || thisGroupFailures.failedMembers.length === 0) {
    return;
  }
  const onToastClick = () => {
    void showUpdateGroupMembersByConvoId(groupPk);
  };
  const count = thisGroupFailures.failedMembers.length;
  const groupName = ConvoHub.use().get(groupPk)?.getRealSessionUsername() || window.i18n('unknown');
  const firstUserName =
    ConvoHub.use().get(thisGroupFailures.failedMembers?.[0])?.getRealSessionUsername() ||
    window.i18n('unknown');
  const secondUserName =
    ConvoHub.use().get(thisGroupFailures.failedMembers?.[1])?.getRealSessionUsername() ||
    window.i18n('unknown');
  switch (count) {
    case 1:
      ToastUtils.pushToastWarning(
        `invite-failed${groupPk}`,
        window.i18n('groupInviteFailedUser', { group_name: groupName, name: firstUserName }),
        onToastClick
      );
      break;
    case 2:
      ToastUtils.pushToastWarning(
        `invite-failed${groupPk}`,
        window.i18n('groupInviteFailedTwo', {
          group_name: groupName,
          name: firstUserName,
          other_name: secondUserName,
        }),
        onToastClick
      );
      break;
    default:
      ToastUtils.pushToastWarning(
        `invite-failed${groupPk}`,
        window.i18n('groupInviteFailedMultiple', {
          group_name: groupName,
          name: firstUserName,
          count: thisGroupFailures.failedMembers.length - 1,
        }),
        onToastClick
      );
  }
  // toast was displayed empty the list
  thisGroupFailures.failedMembers = [];
}

class GroupInviteJob extends PersistedJob<GroupInvitePersistedData> {
  constructor({
    groupPk,
    member,
    inviteAsAdmin,
    nextAttemptTimestamp,
    maxAttempts,
    currentRetry,
    forceUnrevoke,
    identifier,
  }: Pick<GroupInvitePersistedData, 'groupPk' | 'member' | 'inviteAsAdmin' | 'forceUnrevoke'> &
    Partial<
      Pick<
        GroupInvitePersistedData,
        'nextAttemptTimestamp' | 'identifier' | 'maxAttempts' | 'currentRetry'
      >
    >) {
    super({
      jobType: 'GroupInviteJobType',
      identifier: identifier || v4(),
      member,
      groupPk,
      inviteAsAdmin,
      forceUnrevoke,
      delayBetweenRetries: defaultMsBetweenRetries,
      maxAttempts: isNumber(maxAttempts) ? maxAttempts : defaultMaxAttempts,
      nextAttemptTimestamp: nextAttemptTimestamp || Date.now() + defaultMsBetweenRetries,
      currentRetry: isNumber(currentRetry) ? currentRetry : 0,
    });
  }

  public async run(): Promise<RunJobResult> {
    const { groupPk, member, inviteAsAdmin, jobType, identifier } = this.persistedData;

    window.log.info(
      `running job ${jobType} with groupPk:"${groupPk}" member:${member} inviteAsAdmin:${inviteAsAdmin} id:"${identifier}" `
    );
    const group = await UserGroupsWrapperActions.getGroup(groupPk);
    if (!group || !group.secretKey || !group.name) {
      window.log.warn(`GroupInviteJob: Did not find group in wrapper or no valid info in wrapper`);
      return RunJobResult.PermanentFailure;
    }

    if (UserUtils.isUsFromCache(member)) {
      return RunJobResult.Success; // nothing to do for us, we get the update from our user's libsession wrappers
    }
    let failed = true;
    try {
      if (this.persistedData.forceUnrevoke) {
        const token = await MetaGroupWrapperActions.swarmSubAccountToken(groupPk, member);
        const unrevokeSubRequest = new SubaccountUnrevokeSubRequest({
          groupPk,
          revokeTokenHex: [token],
          timestamp: NetworkTime.now(),
          secretKey: group.secretKey,
        });
        const sequenceResult = await GroupSync.pushChangesToGroupSwarmIfNeeded({
          groupPk,
          unrevokeSubRequest,
          extraStoreRequests: [],
        });
        if (sequenceResult !== RunJobResult.Success) {
          throw new Error(
            'GroupInviteJob: SubaccountUnrevokeSubRequest push() did not return success'
          );
        }
      }

      const inviteDetails = inviteAsAdmin
        ? await SnodeGroupSignature.getGroupPromoteMessage({
            groupName: group.name,
            member,
            secretKey: group.secretKey,
            groupPk,
          })
        : await SnodeGroupSignature.getGroupInviteMessage({
            groupName: group.name,
            member,
            secretKey: group.secretKey,
            groupPk,
          });

      const storedAt = await MessageQueue.use().sendTo1o1NonDurably({
        message: inviteDetails,
        namespace: SnodeNamespaces.Default,
        pubkey: PubKey.cast(member),
      });
      if (storedAt !== null) {
        failed = false;
      }
    } catch (e) {
      window.log.warn(
        `${jobType} with groupPk:"${groupPk}" member: ${member} id:"${identifier}" failed with ${e.message}`
      );
      failed = true;
    } finally {
      window.log.info(
        `${jobType} with groupPk:"${groupPk}" member: ${member} id:"${identifier}" finished. failed:${failed}`
      );
      try {
        await MetaGroupWrapperActions.memberSetInvited(groupPk, member, failed);
        // Depending on this field, we either send an invite or an invite-as-admin message.
        // When we do send an invite-as-admin we also need to update the promoted state, so that the invited members
        // knows he needs to accept the promotion when accepting the invite
        if (inviteAsAdmin) {
          if (failed) {
            await MetaGroupWrapperActions.memberSetPromotionFailed(groupPk, member);
          } else {
            await MetaGroupWrapperActions.memberSetPromotionSent(groupPk, member);
          }
        }
      } catch (e) {
        window.log.warn('GroupInviteJob memberSetInvited failed with', e.message);
      }

      updateFailedStateForMember(groupPk, member, failed);

      if (inviteAsAdmin) {
        window?.inboxStore?.dispatch(
          groupInfoActions.setPromotionPending({ groupPk, pubkey: member, sending: false })
        );
      } else {
        window?.inboxStore?.dispatch(
          groupInfoActions.setInvitePending({ groupPk, pubkey: member, sending: false })
        );
      }
      window?.inboxStore?.dispatch(
        groupInfoActions.refreshGroupDetailsFromWrapper({ groupPk }) as any
      );
      await LibSessionUtil.saveDumpsToDb(groupPk);
    }
    // return true so this job is marked as a success and we don't need to retry it
    return RunJobResult.Success;
  }

  public serializeJob(): GroupInvitePersistedData {
    return super.serializeBase();
  }

  public nonRunningJobsToRemove(_jobs: Array<GroupInvitePersistedData>) {
    return [];
  }

  public addJobCheck(jobs: Array<GroupInvitePersistedData>): AddJobCheckReturn {
    // avoid adding the same job if the exact same one is already planned
    const hasSameJob = jobs.some(j => {
      return j.groupPk === this.persistedData.groupPk && j.member === this.persistedData.member;
    });

    if (hasSameJob) {
      return 'skipAddSameJobPresent';
    }

    return null;
  }

  public getJobTimeoutMs(): number {
    return 15 * DURATION.SECONDS;
  }
}

export const GroupInvite = {
  GroupInviteJob,
  addJob,
};
function updateFailedStateForMember(groupPk: GroupPubkeyType, member: PubkeyType, failed: boolean) {
  let thisGroupFailure = invitesFailed.get(groupPk);

  if (!failed) {
    // invite sent success, remove a pending failure state from the list of toasts to display
    if (thisGroupFailure) {
      thisGroupFailure.failedMembers = difference(thisGroupFailure.failedMembers, [member]);
    }

    return;
  }
  // invite sent failed, append the member to that groupFailure member list, and trigger the debounce call
  if (!thisGroupFailure) {
    thisGroupFailure = {
      failedMembers: [],
      debouncedCall: debounce(displayFailedInvitesForGroup, 5 * DURATION.SECONDS),
    };
  }

  if (!thisGroupFailure.failedMembers.includes(member)) {
    thisGroupFailure.failedMembers.push(member);
  }

  invitesFailed.set(groupPk, thisGroupFailure);
  thisGroupFailure.debouncedCall(groupPk);
}
