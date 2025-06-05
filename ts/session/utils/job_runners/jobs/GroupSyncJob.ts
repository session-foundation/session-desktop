/* eslint-disable no-await-in-loop */
import { GroupPubkeyType, WithGroupPubkey } from 'libsession_util_nodejs';
import { to_hex } from 'libsodium-wrappers-sumo';
import { compact, isArray, isEmpty, isNumber } from 'lodash';
import AbortController from 'abort-controller';
import { UserUtils } from '../..';
import { assertUnreachable } from '../../../../types/sqlSharedTypes';
import { isSignInByLinking } from '../../../../util/storage';
import {
  MetaGroupWrapperActions,
  UserGroupsWrapperActions,
} from '../../../../webworker/workers/browser/libsession_worker_interface';
import {
  DeleteAllFromGroupMsgNodeSubRequest,
  DeleteAllFromGroupNodeSubRequest,
  DeleteHashesFromGroupNodeSubRequest,
  MAX_SUBREQUESTS_COUNT,
  StoreGroupKeysSubRequest,
  StoreGroupMessageSubRequest,
  SubaccountRevokeSubRequest,
  SubaccountUnrevokeSubRequest,
} from '../../../apis/snode_api/SnodeRequestTypes';
import { DeleteGroupHashesFactory } from '../../../apis/snode_api/factories/DeleteGroupHashesRequestFactory';
import { StoreGroupRequestFactory } from '../../../apis/snode_api/factories/StoreGroupRequestFactory';
import { SnodeNamespaces } from '../../../apis/snode_api/namespaces';
import { WithRevokeSubRequest } from '../../../apis/snode_api/types';
import { ConvoHub } from '../../../conversations';
import { MessageSender } from '../../../sending/MessageSender';
import { PubKey } from '../../../types';
import { allowOnlyOneAtATime, timeoutWithAbort } from '../../Promise';
import { ed25519Str } from '../../String';
import { GroupSuccessfulChange, LibSessionUtil } from '../../libsession/libsession_utils';
import { runners } from '../JobRunner';
import {
  AddJobCheckReturn,
  GroupSyncPersistedData,
  PersistedJob,
  RunJobResult,
} from '../PersistedJob';
import { DURATION } from '../../../constants';
import { WithAllow401s } from '../../../types/with';
import type { WithTimeoutMs } from '../../../apis/snode_api/requestWith';
import { Data } from '../../../../data/data';
import { GroupUpdateInfoChangeMessage } from '../../../messages/outgoing/controlMessage/group_v2/to_group/GroupUpdateInfoChangeMessage';
import { NetworkTime } from '../../../../util/NetworkTime';
import { SignalService } from '../../../../protobuf';
import { getSodiumRenderer } from '../../../crypto';
import { DisappearingMessages } from '../../../disappearing_messages';
import { GroupUpdateMemberChangeMessage } from '../../../messages/outgoing/controlMessage/group_v2/to_group/GroupUpdateMemberChangeMessage';

const defaultMsBetweenRetries = 15000; // a long time between retries, to avoid running multiple jobs at the same time, when one was postponed at the same time as one already planned (5s)
const defaultMaxAttempts = 2;

/**
 * We want to run each of those jobs at least 3 seconds apart.
 * So every time one of that job finishes, update this timestamp, so we know when adding a new job, what is the next minimum date to run it.
 */
const lastRunConfigSyncJobTimestamps = new Map<string, number | null>();

async function confirmPushedAndDump(
  changes: Array<GroupSuccessfulChange>,
  groupPk: GroupPubkeyType
): Promise<void> {
  const toConfirm: Parameters<typeof MetaGroupWrapperActions.metaConfirmPushed> = [
    groupPk,
    { groupInfo: null, groupMember: null },
  ];
  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    const namespace = change.pushed.namespace;
    switch (namespace) {
      case SnodeNamespaces.ClosedGroupInfo: {
        if (change.pushed.seqno) {
          if (toConfirm[1].groupInfo === null) {
            toConfirm[1].groupInfo = {
              seqno: change.pushed.seqno.toNumber(),
              hashes: [change.messageHash],
            };
          } else {
            toConfirm[1].groupInfo.hashes.push(change.messageHash);
          }
        }
        break;
      }
      case SnodeNamespaces.ClosedGroupMembers: {
        if (change.pushed.seqno) {
          if (toConfirm[1].groupMember === null) {
            toConfirm[1].groupMember = {
              seqno: change.pushed.seqno.toNumber(),
              hashes: [change.messageHash],
            };
          } else {
            toConfirm[1].groupMember.hashes.push(change.messageHash);
          }
        }
        break;
      }
      case SnodeNamespaces.ClosedGroupKeys: {
        // We don't need to confirm pushed keys, they are confirmed automatically
        // when they are fetched from the group's swarm
        break;
      }
      default:
        assertUnreachable(namespace, 'buildAndSaveDumpsToDB assertUnreachable');
    }
  }

  try {
    await MetaGroupWrapperActions.metaConfirmPushed(...toConfirm);
    await LibSessionUtil.saveDumpsToDb(groupPk);
  } catch (e) {
    // The reason we catch exception here is because sometimes we can have a race condition where
    // - we push a change to the group (req1 takes 10s)
    // - while req1 is running, a poll merge results with the group marked as destroyed
    // - this means we have free the wrapper
    // - then, req finishes, and tries to metaConfirmPushed/saveDumpsToDb which fails as the wrapper was freed.
    window.log.warn(
      `metaConfirmPushed/saveDumpsToDb for group ${ed25519Str(groupPk)} failed with ${e.message}. This can safely be ignored` // I hope
    );
  }
}

async function pushChangesToGroupSwarmIfNeeded({
  revokeSubRequest,
  unrevokeSubRequest,
  groupPk,
  supplementalKeysSubRequest,
  deleteAllMessagesSubRequest,
  extraStoreRequests,
  allow401s,
  timeoutMs,
}: WithGroupPubkey &
  WithAllow401s &
  WithRevokeSubRequest &
  Partial<WithTimeoutMs> & {
    supplementalKeysSubRequest?: StoreGroupKeysSubRequest;
    deleteAllMessagesSubRequest?:
      | DeleteAllFromGroupMsgNodeSubRequest
      | DeleteAllFromGroupNodeSubRequest;
    extraStoreRequests: Array<StoreGroupMessageSubRequest>;
  }): Promise<RunJobResult> {
  // save the dumps to DB even before trying to push them, so at least we have an up to date dumps in the DB in case of crash, no network etc
  await LibSessionUtil.saveDumpsToDb(groupPk);
  const { allOldHashes, messages: pendingConfigData } =
    await LibSessionUtil.pendingChangesForGroup(groupPk);
  // If there are no pending changes nor any requests to be made,
  // then the job can just complete (next time something is updated we want
  // to try and run immediately so don't schedule another run in this case)
  if (
    isEmpty(pendingConfigData) &&
    isEmpty(supplementalKeysSubRequest) &&
    isEmpty(revokeSubRequest) &&
    isEmpty(unrevokeSubRequest) &&
    isEmpty(deleteAllMessagesSubRequest) &&
    isEmpty(extraStoreRequests)
  ) {
    window.log.debug(`pushChangesToGroupSwarmIfNeeded: ${ed25519Str(groupPk)}: nothing to push`);
    return RunJobResult.Success;
  }

  const group = await UserGroupsWrapperActions.getGroup(groupPk);
  if (!group) {
    window.log.debug(`pushChangesToGroupSwarmIfNeeded: ${ed25519Str(groupPk)}: group not found`);
    return RunJobResult.Success;
  }

  if (window.sessionFeatureFlags.debug.debugLibsessionDumps) {
    const dumps = await MetaGroupWrapperActions.metaMakeDump(groupPk);
    window.log.info(
      `pushChangesToGroupSwarmIfNeeded: current meta dump: ${ed25519Str(groupPk)}:`,
      to_hex(dumps)
    );
  }

  const pendingConfigRequests = StoreGroupRequestFactory.makeStoreGroupConfigSubRequest({
    group,
    pendingConfigData,
  });

  const deleteHashesSubRequest = DeleteGroupHashesFactory.makeGroupHashesToDeleteSubRequest({
    group,
    messagesHashes: allOldHashes,
  });
  const extraRequests = compact([
    deleteHashesSubRequest,
    revokeSubRequest,
    unrevokeSubRequest,
    deleteAllMessagesSubRequest,
  ]);

  const extraRequestWithExpectedResults = extraRequests.filter(
    m =>
      m instanceof SubaccountRevokeSubRequest ||
      m instanceof SubaccountUnrevokeSubRequest ||
      m instanceof DeleteAllFromGroupMsgNodeSubRequest ||
      m instanceof DeleteAllFromGroupNodeSubRequest ||
      m instanceof DeleteHashesFromGroupNodeSubRequest
  );

  const sortedSubRequests = compact([
    supplementalKeysSubRequest, // this needs to be stored first
    ...pendingConfigRequests, // groupKeys are first in this array, so all good, then groupInfos are next
    ...extraStoreRequests, // this can be stored anytime
    ...extraRequests,
  ]);

  const controller = new AbortController();

  const result = await timeoutWithAbort(
    MessageSender.sendEncryptedDataToSnode({
      // Note: this is on purpose that supplementalKeysSubRequest is before pendingConfigRequests.
      // This is to avoid a race condition where a device is polling while we
      // are posting the configs (already encrypted with the new keys)
      sortedSubRequests,
      destination: groupPk,
      method: 'sequence',
      abortSignal: controller.signal,
      allow401s,
    }),
    timeoutMs || 30 * DURATION.SECONDS,
    controller
  );

  const expectedReplyLength =
    (supplementalKeysSubRequest ? 1 : 0) + // we are sending all the supplemental keys as a single sub request
    pendingConfigRequests.length + // each of those are sent as a sub request
    extraStoreRequests.length + // each of those are sent as a sub request
    extraRequestWithExpectedResults.length; // each of those are sent as a sub request, but they don't all return something...

  // we do a sequence call here. If we do not have the right expected number of results, consider it a failure
  if (!isArray(result) || result.length !== expectedReplyLength) {
    window.log.info(
      `GroupSyncJob: unexpected result length: expected ${expectedReplyLength} but got ${result?.length}`
    );

    // this might be a 421 error (already handled) so let's retry this request a little bit later
    return RunJobResult.RetryJobIfPossible;
  }

  const changes = LibSessionUtil.batchResultsToGroupSuccessfulChange(result, {
    allOldHashes,
    messages: pendingConfigData,
  });

  if ((allOldHashes.size || pendingConfigData.length) && isEmpty(changes)) {
    return RunJobResult.RetryJobIfPossible;
  }
  // Now that we have the successful changes, we need to mark them as pushed and
  // generate any config dumps which need to be stored
  await confirmPushedAndDump(changes, groupPk);
  return RunJobResult.Success;
}

async function allFailedToSentGroupControlMessagesToRetry(groupPk: GroupPubkeyType) {
  try {
    const sodium = await getSodiumRenderer();
    const msgsToResend = await Data.fetchAllGroupUpdateFailedMessage(groupPk);
    if (!msgsToResend.length) {
      return;
    }
    const firstChunk = msgsToResend.slice(0, Math.floor(MAX_SUBREQUESTS_COUNT));
    const convo = ConvoHub.use().get(groupPk);
    if (!convo) {
      throw new Error('allFailedToSentGroupControlMessagesToRetry: convo not found');
    }
    const group = await UserGroupsWrapperActions.getGroup(groupPk);
    if (!group || !group.secretKey || isEmpty(group.secretKey)) {
      throw new Error('allFailedToSentGroupControlMessagesToRetry: group secret key is not found');
    }
    const secretKey = group.secretKey;
    const extraStoreRequests = await StoreGroupRequestFactory.makeGroupMessageSubRequest(
      firstChunk.map(m => {
        const groupUpdate = m.get('group_update');
        const createAtNetworkTimestamp = m.get('sent_at') || NetworkTime.now();
        const identifier = m.id;
        if (!group.secretKey) {
          return null;
        }
        const shared = {
          groupPk,
          identifier,
          createAtNetworkTimestamp,
          secretKey,
          sodium,
          ...DisappearingMessages.getExpireDetailsForOutgoingMessage(
            convo,
            createAtNetworkTimestamp
          ),
        };
        if (groupUpdate?.avatarChange) {
          return new GroupUpdateInfoChangeMessage({
            typeOfChange: SignalService.GroupUpdateInfoChangeMessage.Type.AVATAR,
            ...shared,
          });
        }
        if (groupUpdate?.name) {
          return new GroupUpdateInfoChangeMessage({
            typeOfChange: SignalService.GroupUpdateInfoChangeMessage.Type.NAME,
            updatedName: groupUpdate.name || '',
            ...shared,
          });
        }
        if (groupUpdate?.joined?.length) {
          return new GroupUpdateMemberChangeMessage({
            typeOfChange: 'added',
            added: groupUpdate.joined,
            ...shared,
          });
        }
        if (groupUpdate?.joinedWithHistory?.length) {
          return new GroupUpdateMemberChangeMessage({
            typeOfChange: 'addedWithHistory',
            added: groupUpdate.joinedWithHistory,
            ...shared,
          });
        }
        if (groupUpdate?.kicked?.length) {
          return new GroupUpdateMemberChangeMessage({
            typeOfChange: 'removed',
            removed: groupUpdate.kicked,
            ...shared,
          });
        }
        if (groupUpdate?.promoted?.length) {
          return new GroupUpdateMemberChangeMessage({
            typeOfChange: 'promoted',
            promoted: groupUpdate.promoted,
            ...shared,
          });
        }
        const expirationTimerUpdate = m.get('expirationTimerUpdate');
        if (expirationTimerUpdate) {
          return new GroupUpdateInfoChangeMessage({
            typeOfChange: SignalService.GroupUpdateInfoChangeMessage.Type.DISAPPEARING_MESSAGES,
            ...shared,
            updatedExpirationSeconds: expirationTimerUpdate.expireTimer,
            expirationType: expirationTimerUpdate.expirationType,
          });
        }
        window.log.warn(
          `allFailedToSentGroupControlMessagesToRetry unhandled result for ms ${shared.identifier}`
        );
        return null;
      }),
      group
    );

    if (!extraStoreRequests.length) {
      return;
    }
    const controller = new AbortController();

    // we don't really care about the result. The messages in DB will get their state
    // updated as part of sendEncryptedDataToSnode
    await timeoutWithAbort(
      MessageSender.sendEncryptedDataToSnode({
        sortedSubRequests: extraStoreRequests,
        destination: groupPk,
        method: 'sequence',
        abortSignal: controller.signal,
        allow401s: false,
      }),
      30 * DURATION.SECONDS,
      controller
    );
  } catch (e) {
    window.log.warn('failed');
  }
}

class GroupSyncJob extends PersistedJob<GroupSyncPersistedData> {
  constructor({
    identifier, // this has to be the group's pubkey
    nextAttemptTimestamp,
    maxAttempts,
    currentRetry,
  }: Pick<GroupSyncPersistedData, 'identifier'> &
    Partial<
      Pick<GroupSyncPersistedData, 'nextAttemptTimestamp' | 'currentRetry' | 'maxAttempts'>
    >) {
    super({
      jobType: 'GroupSyncJobType',
      identifier,
      delayBetweenRetries: defaultMsBetweenRetries,
      maxAttempts: isNumber(maxAttempts) ? maxAttempts : defaultMaxAttempts,
      currentRetry: isNumber(currentRetry) ? currentRetry : 0,
      nextAttemptTimestamp: nextAttemptTimestamp || Date.now(),
    });
  }

  public async run(): Promise<RunJobResult> {
    const start = Date.now();
    const thisJobDestination = this.persistedData.identifier;

    try {
      if (!PubKey.is03Pubkey(thisJobDestination)) {
        return RunJobResult.PermanentFailure;
      }

      window.log.debug(`GroupSyncJob starting ${thisJobDestination}`);

      const us = UserUtils.getOurPubKeyStrFromCache();
      const ed25519Key = await UserUtils.getUserED25519KeyPairBytes();
      const conversation = ConvoHub.use().get(us);
      if (!us || !conversation || !ed25519Key) {
        // we check for ed25519Key because it is needed for authenticated requests
        window.log.warn('did not find our own conversation');
        return RunJobResult.PermanentFailure;
      }

      await allFailedToSentGroupControlMessagesToRetry(thisJobDestination);

      // return await so we catch exceptions in here
      return await GroupSync.pushChangesToGroupSwarmIfNeeded({
        groupPk: thisJobDestination,
        extraStoreRequests: [],
        allow401s: false,
      });
    } catch (e) {
      window.log.warn('GroupSyncJob failed with', e.message);
      return RunJobResult.RetryJobIfPossible;
    } finally {
      window.log.debug(
        `GroupSyncJob ${ed25519Str(thisJobDestination)} run() took ${Date.now() - start}ms`
      );

      // this is a simple way to make sure whatever happens here, we update the latest timestamp.
      // (a finally statement is always executed (no matter if exception or returns in other try/catch block)
      this.updateLastTickTimestamp();
    }
  }

  public serializeJob(): GroupSyncPersistedData {
    const fromParent = super.serializeBase();
    return fromParent;
  }

  public addJobCheck(jobs: Array<GroupSyncPersistedData>): AddJobCheckReturn {
    return this.addJobCheckSameTypeAndIdentifierPresent(jobs);
  }

  public nonRunningJobsToRemove(_jobs: Array<GroupSyncPersistedData>) {
    return [];
  }

  public getJobTimeoutMs(): number {
    return 20000;
  }

  private updateLastTickTimestamp() {
    lastRunConfigSyncJobTimestamps.set(this.persistedData.identifier, Date.now());
  }
}

/**
 * Queue a new Sync Configuration if needed job.
 * A GroupSyncJob can only be added if there is none of the same type queued already.
 */
async function queueNewJobIfNeeded(groupPk: GroupPubkeyType) {
  if (isSignInByLinking()) {
    window.log.info(`NOT Scheduling GroupSyncJob for ${groupPk} as we are linking a device`);

    return;
  }
  const lastRunConfigSyncJobTimestamp = lastRunConfigSyncJobTimestamps.get(groupPk);
  if (
    !lastRunConfigSyncJobTimestamp ||
    lastRunConfigSyncJobTimestamp < Date.now() - defaultMsBetweenRetries
  ) {
    // window.log.debug('Scheduling GroupSyncJob: ASAP');
    // we postpone by 1000ms to make sure whoever is adding this job is done with what is needs to do first
    // this call will make sure that there is only one configuration sync job at all times
    await runners.groupSyncRunner.addJob(
      new GroupSyncJob({ identifier: groupPk, nextAttemptTimestamp: Date.now() + 1000 })
    );
    return;
  }

  // if we did run at t=100, and it is currently t=110, the difference is 10
  const diff = Math.max(Date.now() - lastRunConfigSyncJobTimestamp, 0);
  // but we want to run every 30, so what we need is actually `30-10` from now = 20
  const leftBeforeNextTick = Math.max(defaultMsBetweenRetries - diff, 1000);
  // window.log.debug('Scheduling GroupSyncJob: LATER');

  await runners.groupSyncRunner.addJob(
    new GroupSyncJob({
      identifier: groupPk,
      nextAttemptTimestamp: Date.now() + leftBeforeNextTick,
    })
  );
}

export const GroupSync = {
  GroupSyncJob,
  pushChangesToGroupSwarmIfNeeded,
  queueNewJobIfNeeded: (groupPk: GroupPubkeyType) =>
    allowOnlyOneAtATime(`GroupSyncJob-oneAtAtTime-${groupPk}`, () => queueNewJobIfNeeded(groupPk)),
};
