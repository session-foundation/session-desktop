/* eslint-disable no-await-in-loop */
import { WithGroupPubkey } from 'libsession_util_nodejs';
import { compact, isEmpty, isNumber } from 'lodash';
import { v4 } from 'uuid';
import AbortController from 'abort-controller';
import { StringUtils } from '../..';
import { Data } from '../../../../data/data';
import { deleteMessagesFromSwarmOnly } from '../../../../interactions/conversations/unsendingInteractions';
import {
  MetaGroupWrapperActions,
  MultiEncryptWrapperActions,
  UserGroupsWrapperActions,
} from '../../../../webworker/workers/browser/libsession_worker_interface';
import {
  StoreGroupMessageSubRequest,
  StoreGroupRevokedRetrievableSubRequest,
} from '../../../apis/snode_api/SnodeRequestTypes';
import { StoreGroupRequestFactory } from '../../../apis/snode_api/factories/StoreGroupRequestFactory';
import { RevokeChanges, SnodeAPIRevoke } from '../../../apis/snode_api/revokeSubaccount';
import { concatUInt8Array, getSodiumRenderer } from '../../../crypto';
import { GroupUpdateDeleteMemberContentMessage } from '../../../messages/outgoing/controlMessage/group_v2/to_group/GroupUpdateDeleteMemberContentMessage';
import { MessageSender } from '../../../sending';
import { fromHexToArray } from '../../String';
import { runners } from '../JobRunner';
import {
  AddJobCheckReturn,
  GroupPendingRemovalsPersistedData,
  PersistedJob,
  RunJobResult,
} from '../PersistedJob';
import { GroupSync } from './GroupSyncJob';
import { NetworkTime } from '../../../../util/NetworkTime';
import {
  WithAddWithHistoryMembers,
  WithAddWithoutHistoryMembers,
  WithRemoveMembers,
  WithSecretKey,
} from '../../../types/with';
import { groupInfoActions } from '../../../../state/ducks/metaGroups';
import { DURATION, TTL_DEFAULT } from '../../../constants';
import { timeoutWithAbort } from '../../Promise';

const defaultMsBetweenRetries = 10000;
const defaultMaxAttempts = 1;

type JobExtraArgs = Pick<GroupPendingRemovalsPersistedData, 'groupPk'>;

async function addJob({ groupPk }: JobExtraArgs) {
  const pendingRemovalJob = new GroupPendingRemovalsJob({
    groupPk,
    nextAttemptTimestamp: Date.now() + 1000, // postpone by 1s
  });
  window.log.debug(`addGroupPendingRemovalJob: adding group pending removal for ${groupPk} `);
  await runners.groupPendingRemovalJobRunner.addJob(pendingRemovalJob);
}

async function getPendingRevokeParams({
  withoutHistory,
  withHistory,
  removed,
  groupPk,
  secretKey,
}: WithGroupPubkey &
  WithSecretKey &
  WithAddWithoutHistoryMembers &
  WithAddWithHistoryMembers &
  WithRemoveMembers) {
  const revokeChanges: RevokeChanges = [];
  const unrevokeChanges: RevokeChanges = [];

  const toUnrevoke = withoutHistory.concat(withHistory);

  for (let index = 0; index < toUnrevoke.length; index++) {
    const m = toUnrevoke[index];
    const token = await MetaGroupWrapperActions.swarmSubAccountToken(groupPk, m);
    unrevokeChanges.push({ action: 'unrevoke_subaccount', tokenToRevokeHex: token });
  }
  for (let index = 0; index < removed.length; index++) {
    const m = removed[index];
    const token = await MetaGroupWrapperActions.swarmSubAccountToken(groupPk, m);
    revokeChanges.push({ action: 'revoke_subaccount', tokenToRevokeHex: token });
  }

  return SnodeAPIRevoke.getRevokeSubaccountParams(groupPk, secretKey, {
    revokeChanges,
    unrevokeChanges,
  });
}

class GroupPendingRemovalsJob extends PersistedJob<GroupPendingRemovalsPersistedData> {
  constructor({
    groupPk,
    nextAttemptTimestamp,
    maxAttempts,
    currentRetry,
    identifier,
  }: Pick<GroupPendingRemovalsPersistedData, 'groupPk'> &
    Partial<
      Pick<
        GroupPendingRemovalsPersistedData,
        'nextAttemptTimestamp' | 'identifier' | 'maxAttempts' | 'currentRetry'
      >
    >) {
    super({
      jobType: 'GroupPendingRemovalJobType',
      identifier: identifier || v4(),
      groupPk,
      delayBetweenRetries: defaultMsBetweenRetries,
      maxAttempts: isNumber(maxAttempts) ? maxAttempts : defaultMaxAttempts,
      nextAttemptTimestamp: nextAttemptTimestamp || Date.now() + defaultMsBetweenRetries,
      currentRetry: isNumber(currentRetry) ? currentRetry : 0,
    });
  }

  public async run() {
    const { groupPk, jobType, identifier } = this.persistedData;

    window.log.info(`running job ${jobType} with groupPk:"${groupPk}" id:"${identifier}" `);
    const group = await UserGroupsWrapperActions.getGroup(groupPk);
    if (!group || !group.secretKey || isEmpty(group.secretKey)) {
      window.log.warn(
        `GroupPendingRemovalsJob: Did not find group in wrapper or no valid info in wrapper`
      );
      return RunJobResult.PermanentFailure;
    }

    try {
      const pendingRemovals = await MetaGroupWrapperActions.memberGetAllPendingRemovals(groupPk);

      if (!pendingRemovals.length) {
        return RunJobResult.Success;
      }
      const deleteMessagesOfMembers = pendingRemovals
        .filter(m => m.memberStatus === 'REMOVED_MEMBER_AND_MESSAGES')
        .map(m => m.pubkeyHex);

      const sessionIdsHex = pendingRemovals.map(m => m.pubkeyHex);
      const sessionIds = sessionIdsHex.map(m => fromHexToArray(m).slice(1));
      const currentGen = await MetaGroupWrapperActions.keyGetCurrentGen(groupPk);
      const dataToEncrypt = sessionIds.map(s => {
        return concatUInt8Array(s, StringUtils.stringToUint8Array(`${currentGen}`));
      });

      const multiEncryptedMessage = await MultiEncryptWrapperActions.multiEncrypt({
        messages: dataToEncrypt,
        recipients: sessionIds,
        ed25519SecretKey: group.secretKey,
        domain: 'SessionGroupKickedMessage',
      });
      // first, get revoke requests that need to be pushed for leaving member
      const revokeUnrevokeParams = await getPendingRevokeParams({
        groupPk,
        withHistory: [],
        withoutHistory: [],
        removed: sessionIdsHex,
        secretKey: group.secretKey,
      });

      const multiEncryptRequest = new StoreGroupRevokedRetrievableSubRequest({
        encryptedData: multiEncryptedMessage,
        groupPk,
        secretKey: group.secretKey,
        ttlMs: TTL_DEFAULT.CONFIG_MESSAGE,
        getNow: NetworkTime.now,
      });

      const revokeRequests = compact([
        revokeUnrevokeParams.revokeSubRequest ? revokeUnrevokeParams.revokeSubRequest : null,
        revokeUnrevokeParams.unrevokeSubRequest ? revokeUnrevokeParams.unrevokeSubRequest : null,
      ]);
      let storeRequests: Array<StoreGroupMessageSubRequest> = [];
      if (deleteMessagesOfMembers.length) {
        const deleteContentMsg = new GroupUpdateDeleteMemberContentMessage({
          createAtNetworkTimestamp: NetworkTime.now(),
          expirationType: 'unknown', // GroupUpdateDeleteMemberContentMessage this is not displayed so not expiring.
          expireTimer: 0,
          groupPk,
          memberSessionIds: deleteMessagesOfMembers,
          messageHashes: [],
          sodium: await getSodiumRenderer(),
          secretKey: group.secretKey,
        });
        storeRequests = await StoreGroupRequestFactory.makeGroupMessageSubRequest(
          [deleteContentMsg],
          { authData: null, secretKey: group.secretKey }
        );
      }

      const sortedSubRequests = compact([multiEncryptRequest, ...revokeRequests, ...storeRequests]);

      const controller = new AbortController();
      const result = await timeoutWithAbort(
        MessageSender.sendEncryptedDataToSnode({
          sortedSubRequests,
          destination: groupPk,
          method: 'sequence',
          abortSignal: controller.signal,
          allow401s: false,
        }),
        30 * DURATION.SECONDS,
        controller
      );

      if (
        !result ||
        result.length !== sortedSubRequests.length ||
        result.some(m => m.code !== 200)
      ) {
        window.log.warn(
          'GroupPendingRemovalsJob: sendEncryptedDataToSnode unexpected result length or content. Scheduling retry if possible'
        );
        return RunJobResult.RetryJobIfPossible;
      }

      // both requests success, remove the members from the group member entirely and sync
      await MetaGroupWrapperActions.memberEraseAndRekey(groupPk, sessionIdsHex);
      await GroupSync.queueNewJobIfNeeded(groupPk);

      try {
        if (deleteMessagesOfMembers.length) {
          const models = await Data.findAllMessageFromSendersInConversation({
            groupPk,
            toRemove: deleteMessagesOfMembers,
            signatureTimestamp: NetworkTime.now(),
          });

          const messageHashes = compact(models.map(m => m.getMessageHash()));

          if (messageHashes.length) {
            await deleteMessagesFromSwarmOnly(messageHashes, groupPk);
          }
          for (let index = 0; index < models.length; index++) {
            const messageModel = models[index];
            try {
              // eslint-disable-next-line no-await-in-loop
              await messageModel.markAsDeleted();
            } catch (e) {
              window.log.warn(
                `GroupPendingRemoval markAsDeleted of ${messageModel.getMessageHash()} failed with`,
                e.message
              );
            }
          }
        }
      } catch (e) {
        window.log.warn('GroupPendingRemovalsJob allowed to fail part failed with:', e.message);
      }

      window.inboxStore?.dispatch(
        groupInfoActions.refreshGroupDetailsFromWrapper({ groupPk }) as any
      );

      // return true so this job is marked as a success and we don't need to retry it
      return RunJobResult.Success;
    } catch (e) {
      window.log.warn('GroupPendingRemovalsJob failed with', e.message);
      return RunJobResult.RetryJobIfPossible;
    }
  }

  public serializeJob() {
    return super.serializeBase();
  }

  public nonRunningJobsToRemove(_jobs: Array<GroupPendingRemovalsPersistedData>) {
    return [];
  }

  public addJobCheck(jobs: Array<GroupPendingRemovalsPersistedData>): AddJobCheckReturn {
    // avoid adding the same job if the exact same one is already planned
    const hasSameJob = jobs.some(j => {
      return j.groupPk === this.persistedData.groupPk;
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

export const GroupPendingRemovals = {
  addJob,
  getPendingRevokeParams,
};
