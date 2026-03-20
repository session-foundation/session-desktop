/* eslint-disable no-await-in-loop */
import { isNumber, toNumber } from 'lodash';
import { runners } from '../JobRunner';
import {
  AddJobCheckReturn,
  PersistedJob,
  RunJobResult,
  type UpdateProRevocationListPersistedData,
} from '../PersistedJob';
import ProBackendAPI from '../../../apis/pro_backend_api/ProBackendAPI';
import { DURATION } from '../../../constants';
import { getFeatureFlag } from '../../../../state/ducks/types/releasedFeaturesReduxTypes';
import { ProRevocationCache } from '../../../revocation_list/pro_revocation_list';
import { stringify } from '../../../../types/sqlSharedTypes';
import { proBackendDataActions } from '../../../../state/ducks/proBackendData';
import { getCachedUserConfig } from '../../../../webworker/workers/browser/libsession/libsession_worker_userconfig_interface';
import { ConvoHub } from '../../../conversations';
import { uuidV4 } from '../../../../util/uuid';
import { SettingsKey } from '../../../../data/settings-key';
import { Storage } from '../../../../util/storage';

/**
 * Start with null, that means we need to check the nextRunAtMs from the DB
 */
let nextRunAtMs: number | null = null;

async function updateNextRunAtMs(newNextRunAtMs: number) {
  if (newNextRunAtMs !== nextRunAtMs) {
    await Storage.put(SettingsKey.proRevocationListNextRunAtMs, newNextRunAtMs);
    nextRunAtMs = newNextRunAtMs;
  }
}

/**
 * Refresh the value from the DB if needed, otherwise returns the already cached value
 */
async function refreshNextRunAtMsIfNeeded() {
  const now = Date.now();
  // if nextRunAtMs isn't cached yet, fetch it from the DB or init it
  if (nextRunAtMs === null) {
    const nextRunAtMsFromDb = Storage.get(SettingsKey.proRevocationListNextRunAtMs);
    if (!nextRunAtMsFromDb || !isNumber(nextRunAtMsFromDb)) {
      // if the nextRunAtMs is unset, we want the job to run so consider that now is the time to run the job
      await Storage.put(SettingsKey.proRevocationListNextRunAtMs, now);
      nextRunAtMs = now;
    } else {
      nextRunAtMs = toNumber(nextRunAtMsFromDb);
    }
  }

  return nextRunAtMs;
}

class UpdateProRevocationListJob extends PersistedJob<UpdateProRevocationListPersistedData> {
  constructor({
    identifier,
    nextAttemptTimestamp,
    maxAttempts,
    currentRetry,
  }: Partial<
    Pick<
      UpdateProRevocationListPersistedData,
      'identifier' | 'nextAttemptTimestamp' | 'currentRetry' | 'maxAttempts'
    >
  >) {
    super({
      jobType: 'UpdateProRevocationListJobType',
      identifier: identifier ?? uuidV4(),
      delayBetweenRetries: 15 * DURATION.SECONDS,
      maxAttempts: isNumber(maxAttempts) ? maxAttempts : 2,
      currentRetry: isNumber(currentRetry) ? currentRetry : 0,
      nextAttemptTimestamp: nextAttemptTimestamp || Date.now(),
    });
  }

  public async run(): Promise<RunJobResult> {
    if (!getFeatureFlag('proAvailable')) {
      return RunJobResult.Success;
    }
    const start = Date.now();

    try {
      window.log.debug(`UpdateProRevocationListJob run() started`);

      const ticketFromDb = ProRevocationCache.getTicket();
      const response = await ProBackendAPI.getRevocationList({
        ticket: ticketFromDb,
      });

      if (getFeatureFlag('debugServerRequests')) {
        window.log.info(
          `[updateProRevocationList] response from server: ${JSON.stringify(response)}`
        );
      }

      if (response?.status_code !== 200) {
        window.log.debug(`UpdateProRevocationListJob run() failed: ${JSON.stringify(response)}`);
        window.log.warn(`UpdateProRevocationListJob run() failed. Will retry soon if possible`);
        return RunJobResult.RetryJobIfPossible;
      }

      const retryInSecondsFromBackend = response.result.retry_in_s;
      const retryInSeconds = Math.max(retryInSecondsFromBackend, 0);

      const retryAtMs = Date.now() + toNumber(retryInSeconds) * DURATION.SECONDS;

      window.log.debug(
        `UpdateProRevocationListJob: got 'retry_in_s' from server: ${retryInSeconds}, i.e we will retryAtMs: ${retryAtMs}`
      );
      await updateNextRunAtMs(retryAtMs);

      if (response.result.ticket <= ticketFromDb) {
        window.log.debug(
          `UpdateProRevocationListJob: no new revocations from our existing ticket #${ticketFromDb}`
        );

        return RunJobResult.Success;
      }
      const newTicket = response.result.ticket;
      const newItems = response.result.items;

      window.log.debug(
        `UpdateProRevocationListJob: new revocations from ticket #${ticketFromDb}: to #${newTicket}. items: ${stringify(response.result.items)}`
      );

      // Note: we only want to update the lastRunAt once we have successfully fetched the new revocations
      await ProRevocationCache.setTicket(newTicket);
      await ProRevocationCache.setListItems(newItems);

      window.log.info(
        `UpdateProRevocationListJob: new revocations from ticket #${ticketFromDb}: to #${newTicket}. itemsCount: ${response.result.items.length}`
      );

      const ourProConfig = getCachedUserConfig().proConfig;

      if (
        ourProConfig &&
        ourProConfig.proProof.genIndexHashB64 &&
        // `ProRevocationCache.setListItems` above updated the cache, so we can use it here
        ProRevocationCache.isB64HashEffectivelyRevoked(ourProConfig.proProof.genIndexHashB64)
      ) {
        // if we've been revoked, refresh our pro proof.
        // this will fetch the new one if one is provided or just remove it from our config.
        window.log.info(
          `UpdateProRevocationListJob: our current genIndexHash is revoked. Refreshing our pro proof.`
        );
        window.inboxStore?.dispatch(
          proBackendDataActions.refreshGetProDetailsFromProBackend({}) as any
        );
      }
      // find all the conversations that have a revoked genIndexHAsh and trigger a UI refresh on them
      const convos = ConvoHub.use().getConversations();
      convos.forEach(m => {
        const proDetails = m.dbContactProDetails();
        if (!proDetails?.proGenIndexHashB64) {
          return;
        }
        const revoked = ProRevocationCache.isB64HashEffectivelyRevoked(
          proDetails.proGenIndexHashB64
        );

        if (revoked) {
          window.log.debug(
            `UpdateProRevocationListJob: found an effectively revoked genIndexHash for convo ${m.idForLogging()}. Triggering UI refresh.`
          );
          m.triggerUIRefresh();
        }
      });

      return RunJobResult.Success;
    } catch (e) {
      window.log.warn('UpdateProRevocationListJob run() failed with', e.message);
      return RunJobResult.RetryJobIfPossible;
    } finally {
      window.log.debug(`UpdateProRevocationListPersistedData run() took ${Date.now() - start}ms`);
    }
  }

  public serializeJob(): UpdateProRevocationListPersistedData {
    const fromParent = super.serializeBase();
    return fromParent;
  }

  public addJobCheck(jobs: Array<UpdateProRevocationListPersistedData>): AddJobCheckReturn {
    return this.addJobCheckSameTypePresent(jobs);
  }

  public nonRunningJobsToRemove(_jobs: Array<UpdateProRevocationListPersistedData>) {
    return [];
  }

  public getJobTimeoutMs(): number {
    return 20 * DURATION.SECONDS;
  }
}

async function queueNewJobIfNeeded() {
  const now = Date.now();
  const refreshedNextRunAtMs = await refreshNextRunAtMsIfNeeded();

  window.log.debug(
    `UpdateProRevocationListJob: now: ${now}, refreshedNextRunAtMs: ${refreshedNextRunAtMs}, `
  );

  const shouldJobRun = refreshedNextRunAtMs <= now;
  if (!shouldJobRun) {
    window.log.debug(
      `NOT Scheduling UpdateProRevocationListJob: as refreshedNextRunAtMs: ${refreshedNextRunAtMs} and now: ${now}`
    );
    return;
  }
  const postponedSeconds = 20;
  window.log.debug(
    `Scheduling UpdateProRevocationListJob in ${postponedSeconds}s. refreshedNextRunAtMs: ${refreshedNextRunAtMs} and now: ${now}`
  );
  await runners.updateProRevocationListRunner.addJob(
    new UpdateProRevocationListJob({
      nextAttemptTimestamp: Date.now() + postponedSeconds * DURATION.SECONDS,
    })
  );
}

/**
 * Run, and await the UpdateProRevocationListJob on startup.
 * Note: this is only run if the nextRunAtMs is unset or is already passed.
 */
async function runOnStartup() {
  try {
    const now = Date.now();
    const refreshedNextRunAtMs = await refreshNextRunAtMsIfNeeded();

    window.log.debug(
      `UpdateProRevocationListJob.runOnStartup(): now: ${now}, refreshedNextRunAtMs: ${refreshedNextRunAtMs}, `
    );
    const shouldJobRun = refreshedNextRunAtMs <= now;
    if (!shouldJobRun) {
      window.log.info(
        'UpdateProRevocationListJob.runOnStartup(): not running job as it is not due yet'
      );
      return;
    }

    const job = new UpdateProRevocationListJob({ nextAttemptTimestamp: Date.now() });
    await job.run();
  } catch (e) {
    window.log.warn('UpdateProRevocationListJob runOnStartup failed with', e.message);
  }
}

export const UpdateProRevocationList = {
  UpdateProRevocationListJob,
  queueNewJobIfNeeded,
  runOnStartup,
};
