import { v4 } from 'uuid';
/* eslint-disable no-await-in-loop */
import { isNumber } from 'lodash';
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
import { formatRoundedUpDuration } from '../../../../util/i18n/formatting/generics';
import { isDevProd } from '../../../../shared/env_vars';
import { ProRevocationCache } from '../../../revocation_list/pro_revocation_list';
import { stringify } from '../../../../types/sqlSharedTypes';
import { proBackendDataActions } from '../../../../state/ducks/proBackendData';
import { getCachedUserConfig } from '../../../../webworker/workers/browser/libsession/libsession_worker_userconfig_interface';

let lastRunAtMs = 0;

const delayBetweenRuns = isDevProd() ? 15 * DURATION.SECONDS : 15 * DURATION.MINUTES;

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
      identifier: identifier ?? v4(),
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

      if (response.result.ticket <= ticketFromDb) {
        window.log.debug(
          `UpdateProRevocationListJob: no new revocations from our existing ticket #${ticketFromDb}`
        );
        lastRunAtMs = Date.now();

        return RunJobResult.Success;
      }
      const newTicket = response.result.ticket;
      const newItems = response.result.items;

      window.log.debug(
        `UpdateProRevocationListJob: new revocations from ticket #${ticketFromDb}: to #${newTicket}. items: ${stringify(response.result.items)}`
      );

      // Note: we only want to update the lastRunAt once we have successfully fetched the new revocations
      lastRunAtMs = Date.now();
      await ProRevocationCache.setTicket(newTicket);
      await ProRevocationCache.setListItems(newItems);

      window.log.info(
        `UpdateProRevocationListJob: new revocations from ticket #${ticketFromDb}: to #${newTicket}. itemsCount: ${response.result.items.length}`
      );

      const proConfig = getCachedUserConfig().proConfig;
      if (
        proConfig &&
        proConfig.proProof.genIndexHashB64 &&
        newItems.some(m => m.gen_index_hash_b64 === proConfig.proProof.genIndexHashB64)
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
  const diffMs = Date.now() - lastRunAtMs;
  if (diffMs <= delayBetweenRuns) {
    window.log.debug(
      `NOT Scheduling UpdateProRevocationListJob: as we have already run it recently (${formatRoundedUpDuration(diffMs)} ago)`
    );
    return;
  }
  window.log.debug(
    `Scheduling UpdateProRevocationListJob: as the last (successful) run was not recent (${formatRoundedUpDuration(diffMs)} ago)`
  );
  await runners.updateProRevocationListRunner.addJob(
    new UpdateProRevocationListJob({ nextAttemptTimestamp: Date.now() + 20 * DURATION.SECONDS })
  );
}

export const UpdateProRevocationList = {
  UpdateProRevocationListJob,
  queueNewJobIfNeeded,
};
