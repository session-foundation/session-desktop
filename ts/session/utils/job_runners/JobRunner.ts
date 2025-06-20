import { cloneDeep, compact, isArray, isString } from 'lodash';
import { Data } from '../../../data/data';
import { Storage } from '../../../util/storage';
import { timeout } from '../Promise';
import { persistedJobFromData } from './JobDeserialization';
import {
  AvatarDownloadPersistedData,
  FetchMsgExpirySwarmPersistedData,
  GroupInvitePersistedData,
  GroupPendingRemovalsPersistedData,
  GroupPromotePersistedData,
  GroupSyncPersistedData,
  PersistedJob,
  RunJobResult,
  TypeOfPersistedData,
  UpdateMsgExpirySwarmPersistedData,
  UserSyncPersistedData,
} from './PersistedJob';
import { JobRunnerType } from './jobs/JobRunnerType';
import { DURATION } from '../../constants';

function jobToLogId<T extends TypeOfPersistedData>(jobRunner: JobRunnerType, job: PersistedJob<T>) {
  return `id: "${job.persistedData.identifier}" (type: "${jobRunner}")`;
}

/**
 * The maximum number of workers that can be run at the same time in a job runner.
 */
const MAX_WORKER_COUNT = 4 as const;

/**
 * Everytime we add a job, we check if we can/should run it.
 * When the runner start processing, we check if we can should run a job.
 * Everytime a job finishes, we check if another one needs to be added.
 *
 * But when some jobs are scheduled and none of them needs to be run now, nothing will start the first one.
 * This interval is used to periodically check for jobs to run.
 */
const planNextJobInternalMs = DURATION.SECONDS * 1;

/**
 * This class is used to plan jobs and make sure they are retried until the success.
 * By having a specific type, we can find the logic to be run by that type of job.
 */
export class PersistedJobRunner<T extends TypeOfPersistedData> {
  /**
   * The type of jobs that this runner is. It will only run jobs that matches it.
   */
  private readonly jobRunnerType: JobRunnerType;
  /**
   * True if the runner has loaded its job list from the DB.
   */
  private isInit = false;
  /**
   * The count of workers that can be run at the same time for this runner.
   * Enforced to be between 1 and `MAX_WORKER_COUNT`.
   * Default is 1, so sequential jobs.
   */
  private workerCount: number;
  /**
   * The list of jobs that are planned to be run.
   * At most `this.workerCount` might be currently running. If so, they are also in `this.currentJobs`.
   */
  private jobsScheduled: Array<PersistedJob<T>> = [];
  /**
   * The list of jobs that are currently running. Those should always reference a job from `jobsScheduled`.
   * The length of this array can never be more than this.workerCount.
   */
  private currentJobs: Array<PersistedJob<T>> = [];

  /**
   *
   */
  private planNextJobTick: NodeJS.Timeout | null = null;

  /**
   *
   * @param jobRunnerType the type of jobs allowed to run as part of this job runner
   * @param workerCount the count of workers to allow (beware: not all jobs can be run in parallel safely)
   */
  constructor(jobRunnerType: JobRunnerType, workerCount: 1 | 2 | 3 | typeof MAX_WORKER_COUNT = 1) {
    this.jobRunnerType = jobRunnerType;
    this.workerCount = workerCount;
    if (workerCount <= 0 || workerCount > MAX_WORKER_COUNT) {
      throw new Error(`workerCount must be between 1 and ${MAX_WORKER_COUNT}`);
    }
    window?.log?.warn(`new runner of type ${jobRunnerType} built`);
  }

  public async loadJobsFromDb() {
    if (this.isInit) {
      return;
    }
    let jobsArray: Array<T> = [];
    const found = await Data.getItemById(this.getJobRunnerItemId());
    if (found && found.value && isString(found.value)) {
      const asStr = found.value;

      try {
        const parsed = JSON.parse(asStr);
        if (!isArray(parsed)) {
          jobsArray = [];
        } else {
          jobsArray = parsed;
        }
      } catch (e) {
        window.log.warn(`Failed to parse jobs of type ${this.jobRunnerType} from DB`);
        jobsArray = [];
      }
    }
    const jobs: Array<PersistedJob<T>> = compact(jobsArray.map(persistedJobFromData));
    this.jobsScheduled = cloneDeep(jobs);
    // make sure the list is sorted on load
    this.sortJobsList();
    this.isInit = true;
  }

  public async addJob(
    job: PersistedJob<T>
  ): Promise<'type_exists' | 'identifier_exists' | 'job_added'> {
    this.assertIsInitialized();

    if (
      this.getJobsScheduledButNotRunning().find(
        j => j.persistedData.identifier === job.persistedData.identifier
      )
    ) {
      window.log.debug(
        `job runner (${this.jobRunnerType}) has already a job with id:"${job.persistedData.identifier}" planned so not adding another one`
      );
      return 'identifier_exists';
    }

    const serializedNonRunningJobs = this.getJobsScheduledButNotRunning().map(k =>
      k.serializeJob()
    );

    const addJobChecks = job.addJobCheck(serializedNonRunningJobs);
    if (addJobChecks === 'skipAddSameJobPresent') {
      // window.log.warn(`addjobCheck returned "${addJobChecks}" so not adding it`);
      return 'type_exists';
    }

    // make sure there is no job with that same identifier already .

    window.log.debug(`job runner adding type:"${job.persistedData.jobType}"`);
    await this.addJobUnchecked(job);
    return 'job_added';
  }

  /**
   * Only used for testing
   */
  public getScheduledJobs() {
    return this.jobsScheduled.map(m => m.serializeJob());
  }

  /**
   * Only used for testing
   */
  public getCurrentJobs() {
    return this.currentJobs.map(m => m.serializeJob());
  }

  public resetForTesting() {
    this.jobsScheduled = [];
    this.isInit = false;
    this.stopTicking();
    this.currentJobs = [];
  }

  public getCurrentJobIdentifiers(): Array<string> {
    return this.currentJobs.map(job => job.persistedData.identifier);
  }

  private isStarted() {
    return this.planNextJobTick !== null;
  }

  /**
   * if we are running a job, this call will await until the job is done and stop the queue
   */
  public async stopAndWaitCurrentJobs(): Promise<'no_await' | 'await'> {
    this.stopTicking();
    if (!this.isRunningJobs()) {
      return 'no_await';
    }

    await Promise.all(this.currentJobs.map(job => job.waitForCurrentTry()));
    return 'await';
  }

  public isRunningJobs() {
    return this.currentJobs.length > 0;
  }

  /**
   * if we are running a job, this call will await until the job is done.
   * If another job must be run right away this one, we will also add the upcoming one as the currentJob.
   */
  public async waitCurrentJobs(): Promise<'no_await' | 'await'> {
    if (!this.isRunningJobs()) {
      return 'no_await';
    }
    await Promise.all(this.currentJobs.map(job => job.waitForCurrentTry()));
    return 'await';
  }

  public startProcessing() {
    if (this.isStarted()) {
      return;
    }
    this.planNextJobTick = global.setInterval(() => {
      this.planNextJobs();
    }, planNextJobInternalMs);
    // check if anything needs to be started now too
    this.planNextJobs();
  }

  private getJobsScheduledButNotRunning() {
    return this.jobsScheduled.filter(
      scheduled =>
        !this.currentJobs.find(
          running => scheduled.persistedData.identifier === running.persistedData.identifier
        )
    );
  }

  private stopTicking() {
    if (this.planNextJobTick) {
      clearInterval(this.planNextJobTick);
      this.planNextJobTick = null;
    }
  }

  private sortJobsList() {
    this.jobsScheduled.sort(
      (a, b) => a.persistedData.nextAttemptTimestamp - b.persistedData.nextAttemptTimestamp
    );
  }

  private async writeJobsToDB() {
    this.sortJobsList();
    const serialized = this.getScheduledJobs();

    await Storage.put(this.getJobRunnerItemId(), JSON.stringify(serialized));
  }

  private async addJobUnchecked(job: PersistedJob<T>) {
    this.jobsScheduled.push(cloneDeep(job));
    this.sortJobsList();
    await this.writeJobsToDB();
    // a job has been added, let's check if we should/can run it now
    this.planNextJobs();
  }

  private getJobRunnerItemId() {
    return `jobRunner-${this.jobRunnerType}`;
  }

  public planNextJobs() {
    // we can start at most `this.workerCount` jobs, but if we have some running already in `thiscurrentJobs`
    for (let index = 0; index < this.workerCount - this.currentJobs.length; index++) {
      void this.runNextJob();
    }
  }

  private deleteJobsByIdentifier(identifiers: Array<string>) {
    identifiers.forEach(identifier => {
      const jobIndex = this.jobsScheduled.findIndex(f => f.persistedData.identifier === identifier);

      if (jobIndex >= 0 && jobIndex <= this.jobsScheduled.length) {
        window.log.debug(
          `removing job ${jobToLogId(
            this.jobRunnerType,
            this.jobsScheduled[jobIndex]
          )} at ${jobIndex}`
        );

        this.jobsScheduled.splice(jobIndex, 1);
      } else {
        window.log.debug(
          `failed to remove job ${identifier} with index ${jobIndex} from ${this.jobRunnerType}`
        );
      }
    });
  }

  private areWorkersFull() {
    return this.currentJobs.length >= this.workerCount;
  }

  private async runNextJob() {
    this.assertIsInitialized();

    if (this.areWorkersFull() || !this.isStarted || !this.jobsScheduled.length) {
      return;
    }

    const nextJob = this.getJobsScheduledButNotRunning()[0];
    if (!nextJob) {
      return;
    }

    // if the time is 101, and that task is to be run at t=101, we need to start it right away.
    if (nextJob.persistedData.nextAttemptTimestamp > Date.now()) {
      return;
    }
    let jobResult: RunJobResult | null = null;

    try {
      // checked above already, and there are no `await` between there and here... but better be sure.
      if (this.areWorkersFull()) {
        return;
      }
      this.currentJobs.push(nextJob);

      jobResult = await timeout(nextJob.runJob(), nextJob.getJobTimeoutMs());

      if (jobResult !== RunJobResult.Success) {
        throw new Error('return result was not "Success"');
      }

      // here the job did not throw and didn't return false. Consider it OK then and remove it from the list of jobs to run.
      this.deleteJobsByIdentifier([nextJob.persistedData.identifier]);
    } catch (e) {
      window.log.info(`${jobToLogId(this.jobRunnerType, nextJob)} failed with "${e.message}"`);
      if (
        jobResult === RunJobResult.PermanentFailure ||
        nextJob.persistedData.currentRetry >= nextJob.persistedData.maxAttempts - 1
      ) {
        if (jobResult === RunJobResult.PermanentFailure) {
          window.log.info(
            `${jobToLogId(this.jobRunnerType, nextJob)}:${
              nextJob.persistedData.currentRetry
            } permament failure for job`
          );
        } else {
          window.log.info(
            `Too many failures for ${jobToLogId(this.jobRunnerType, nextJob)}: ${
              nextJob.persistedData.currentRetry
            } out of ${nextJob.persistedData.maxAttempts}`
          );
        }
        // we cannot restart this job anymore. Remove the entry completely
        this.deleteJobsByIdentifier([nextJob.persistedData.identifier]);
      } else {
        window.log.info(
          `Rescheduling ${jobToLogId(this.jobRunnerType, nextJob)} in ${
            nextJob.persistedData.delayBetweenRetries
          }...`
        );
        nextJob.persistedData.currentRetry += 1;
        // that job can be restarted. Plan a retry later with the already defined retry
        nextJob.persistedData.nextAttemptTimestamp =
          Date.now() + nextJob.persistedData.delayBetweenRetries;
      }
    } finally {
      // write changes (retries or success) to the DB
      this.sortJobsList();
      await this.writeJobsToDB();

      // remove the job from the current jobs list (memory only)
      const jobIndex = this.currentJobs.findIndex(f => f === nextJob);
      if (jobIndex >= 0) {
        this.currentJobs.splice(jobIndex, 1);
      }

      this.planNextJobs();
    }
  }

  private assertIsInitialized() {
    if (!this.isInit) {
      throw new Error(
        'persisted job runner was not initlized yet. Call loadJobsFromDb with what you have persisted first'
      );
    }
  }
}

const userSyncRunner = new PersistedJobRunner<UserSyncPersistedData>('UserSyncJob');
const groupSyncRunner = new PersistedJobRunner<GroupSyncPersistedData>('GroupSyncJob');

const avatarDownloadRunner = new PersistedJobRunner<AvatarDownloadPersistedData>(
  'AvatarDownloadJob'
);

const groupInviteJobRunner = new PersistedJobRunner<GroupInvitePersistedData>('GroupInviteJob', 4);

const groupPromoteJobRunner = new PersistedJobRunner<GroupPromotePersistedData>(
  'GroupPromoteJob',
  4
);

const groupPendingRemovalJobRunner = new PersistedJobRunner<GroupPendingRemovalsPersistedData>(
  'GroupPendingRemovalJob',
  4
);

const updateMsgExpiryRunner = new PersistedJobRunner<UpdateMsgExpirySwarmPersistedData>(
  'UpdateMsgExpirySwarmJob'
);

const fetchSwarmMsgExpiryRunner = new PersistedJobRunner<FetchMsgExpirySwarmPersistedData>(
  'FetchMsgExpirySwarmJob'
);

export const runners = {
  userSyncRunner,
  groupSyncRunner,
  updateMsgExpiryRunner,
  fetchSwarmMsgExpiryRunner,
  avatarDownloadRunner,
  groupInviteJobRunner,
  groupPromoteJobRunner,
  groupPendingRemovalJobRunner,
};
