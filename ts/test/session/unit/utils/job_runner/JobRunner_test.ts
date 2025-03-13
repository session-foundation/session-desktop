import { expect } from 'chai';
import { isUndefined } from 'lodash';
import Sinon from 'sinon';
import { v4 } from 'uuid';
import { sleepFor } from '../../../../../session/utils/Promise';
import { PersistedJobRunner } from '../../../../../session/utils/job_runners/JobRunner';
import {
  FakeSleepForMultiJobData,
  FakeSleepJobData,
} from '../../../../../session/utils/job_runners/PersistedJob';
import { TestUtils } from '../../../../test-utils';
import { stubData } from '../../../../test-utils/utils';
import { FakeSleepForJob, FakeSleepForMultiJob } from './FakeSleepForJob';

function getFakeSleepForJob(timestamp: number): FakeSleepForJob {
  const job = new FakeSleepForJob({
    identifier: v4(),
    maxAttempts: 3,
    nextAttemptTimestamp: timestamp || 3000,
    currentRetry: 0,
  });
  return job;
}

function getFakeSleepForJobPersisted(timestamp: number): FakeSleepJobData {
  return getFakeSleepForJob(timestamp).serializeJob();
}

const multiJobSleepDuration = 5000;

function getFakeSleepForMultiJob({
  timestamp,
  identifier,
  returnResult,
}: {
  timestamp: number;
  identifier?: string;
  returnResult?: boolean;
}): FakeSleepForMultiJob {
  const job = new FakeSleepForMultiJob({
    identifier: identifier || v4(),
    maxAttempts: 3,
    nextAttemptTimestamp: timestamp || 3000,
    currentRetry: 0,
    returnResult: isUndefined(returnResult) ? true : returnResult,
    sleepDuration: multiJobSleepDuration,
  });
  return job;
}

describe('JobRunner SINGLE', () => {
  let getItemById: Sinon.SinonStub;
  let clock: Sinon.SinonFakeTimers;
  let runner: PersistedJobRunner<FakeSleepJobData>;

  beforeEach(() => {
    getItemById = stubData('getItemById');
    stubData('createOrUpdateItem');
    clock = Sinon.useFakeTimers({ shouldAdvanceTime: true });
    runner = new PersistedJobRunner<FakeSleepJobData>('FakeSleepForJob');
  });

  afterEach(() => {
    Sinon.restore();
    runner.resetForTesting();
  });

  describe('loadJobsFromDb', () => {
    it('throw if not loaded', async () => {
      try {
        getItemById.resolves({
          id: '',
          value: JSON.stringify([]),
        });
        const job = getFakeSleepForJob(123);

        await runner.addJob(job);
        throw new Error('fake error'); // the line above should throw something else
      } catch (e) {
        expect(e.message).to.not.eq('fake error');
      }
    });
    it('unsorted list is sorted after loading', async () => {
      const unsorted = [
        getFakeSleepForJobPersisted(1),
        getFakeSleepForJobPersisted(5),
        getFakeSleepForJobPersisted(0),
      ];
      getItemById.resolves({
        id: '',
        value: JSON.stringify(unsorted),
      });

      await runner.loadJobsFromDb();

      const jobList = runner.getScheduledJobs();
      expect(jobList).to.be.deep.eq(
        unsorted.sort((a, b) => a.nextAttemptTimestamp - b.nextAttemptTimestamp)
      );
    });

    it('invalid stored data results in empty array of jobs', async () => {
      const unsorted = { invalid: 'data' };
      getItemById.resolves({
        id: '',
        value: JSON.stringify(unsorted),
      });

      await runner.loadJobsFromDb();

      const jobList = runner.getScheduledJobs();
      expect(jobList).to.be.deep.eq([]);
    });

    it('no stored data results in empty array of jobs', async () => {
      getItemById.resolves(null);

      await runner.loadJobsFromDb();

      const jobList = runner.getScheduledJobs();
      expect(jobList).to.be.deep.eq([]);
    });
  });

  describe('addJob', () => {
    it('can add FakeSleepForJob ', async () => {
      await runner.loadJobsFromDb();
      const job = getFakeSleepForJob(123);
      const persisted = job.serializeJob();
      const result = await runner.addJob(job);
      expect(result).to.be.eq('job_added');

      expect(runner.getScheduledJobs()).to.deep.eq([persisted]);
    });
    it('does not add a second FakeSleepForJob if one is already there', async () => {
      await runner.loadJobsFromDb();
      const job = getFakeSleepForJob(123);
      const job2 = getFakeSleepForJob(1234);
      let result = await runner.addJob(job);
      expect(result).to.eq('job_added');
      result = await runner.addJob(job2);
      expect(result).to.eq('type_exists');
      const persisted = job.serializeJob();

      expect(runner.getScheduledJobs()).to.deep.eq([persisted]);
    });
  });

  describe('startProcessing FakeSleepForJob', () => {
    it('triggers a job right away if there is a job which should already be running', async () => {
      await runner.loadJobsFromDb();
      clock.tick(100);
      const job = getFakeSleepForJob(50);
      await runner.addJob(job);
      runner.startProcessing();
      expect(runner.getCurrentJobs()).to.deep.eq([job.serializeJob()]);
    });

    it('plans a deferred job if there is a job starting later', async () => {
      await runner.loadJobsFromDb();
      clock.tick(100);
      const job = getFakeSleepForJob(150);
      expect(await runner.addJob(job)).to.be.eq('job_added');
      runner.startProcessing();
    });
  });

  describe('stopAndWaitCurrentJob', () => {
    it('does not await if no job at all ', async () => {
      await runner.loadJobsFromDb();
      runner.startProcessing();
      const ret = await runner.stopAndWaitCurrentJobs();

      expect(ret).to.be.eq('no_await');
    });

    it('does not await if there are jobs but none are started', async () => {
      await runner.loadJobsFromDb();
      clock.tick(100);
      const job = getFakeSleepForJob(150);
      await runner.addJob(job);
      runner.startProcessing();
      clock.tick(45);
      await sleepFor(10); // the runner should pick up the job
      expect(runner.getCurrentJobs()).to.deep.eq([]);
      expect(runner.isRunningJobs()).to.deep.eq(false);
      const ret = await runner.stopAndWaitCurrentJobs();

      expect(ret).to.be.eq('no_await');
    });

    it('does await if there are jobs and one is started', async () => {
      await runner.loadJobsFromDb();
      clock.tick(200);
      const job = getFakeSleepForJob(150);
      expect(await runner.addJob(job)).to.eq('job_added');
      runner.startProcessing();
      expect(runner.getCurrentJobs()).to.deep.eq([job.serializeJob()]);

      clock.tick(5000);
      const ret = await runner.stopAndWaitCurrentJobs();
      await sleepFor(10);
      expect(runner.getCurrentJobs()).to.deep.eq([]);

      expect(ret).to.be.eq('await');
    });
  });

  describe('retriesFailing Jobs', () => {
    it('does not await if no job at all ', async () => {
      await runner.loadJobsFromDb();
      runner.startProcessing();
      const ret = await runner.stopAndWaitCurrentJobs();
      expect(ret).to.be.eq('no_await');
    });

    it('does not await if there are jobs but none are started', async () => {
      TestUtils.stubWindowLog();
      await runner.loadJobsFromDb();
      clock.tick(100);
      const job = getFakeSleepForJob(150);
      await runner.addJob(job);

      expect(runner.getCurrentJobs()).to.deep.eq([]);
      expect(runner.getScheduledJobs()).to.deep.eq([job.serializeJob()]);
      expect(runner.isRunningJobs()).to.be.eq(false);

      runner.startProcessing(); // a job should be started right away in the list of jobs
      await sleepFor(10);
      expect(runner.isRunningJobs()).to.be.eq(false);

      expect(runner.getCurrentJobs()).to.deep.eq([]);
      expect(runner.getScheduledJobs()).to.deep.eq([job.serializeJob()]);
      await sleepFor(10);
      const ret = await runner.stopAndWaitCurrentJobs();
      expect(runner.getCurrentJobs()).to.deep.eq([]);
      expect(runner.getScheduledJobs()).to.deep.eq([
        { ...job.serializeJob(), currentRetry: 0, nextAttemptTimestamp: 150 },
      ]);

      expect(ret).to.be.eq('no_await');
    });

    it('does await if there are jobs and at least one is running', async () => {
      await runner.loadJobsFromDb();
      clock.tick(100);
      const job = getFakeSleepForJob(150);
      await runner.addJob(job);

      clock.tick(50);

      expect(runner.getCurrentJobs()).to.deep.eq([]);
      expect(runner.getScheduledJobs()).to.deep.eq([job.serializeJob()]);
      expect(runner.isRunningJobs()).to.be.eq(false);

      runner.startProcessing(); // a job should be started right away in the list of jobs
      await sleepFor(5);
      expect(runner.isRunningJobs()).to.be.eq(true);

      expect(runner.getCurrentJobs()).to.deep.eq([job.serializeJob()]);

      clock.tick(5000);

      await sleepFor(5);
      const ret = await runner.stopAndWaitCurrentJobs();
      expect(runner.getCurrentJobs()).to.deep.eq([]);
      expect(runner.getScheduledJobs()).to.deep.eq([
        { ...job.serializeJob(), currentRetry: 1, nextAttemptTimestamp: clock.now + 10000 - 20 },
      ]);

      expect(ret).to.be.eq('no_await');
    });
  });
});

describe('JobRunner MULTI', () => {
  let clock: Sinon.SinonFakeTimers;
  let runnerMulti: PersistedJobRunner<FakeSleepForMultiJobData>;

  beforeEach(() => {
    stubData('createOrUpdateItem');
    stubData('getItemById');

    clock = Sinon.useFakeTimers({ shouldAdvanceTime: true });
    runnerMulti = new PersistedJobRunner<FakeSleepForMultiJobData>('FakeSleepForMultiJob');
  });

  afterEach(() => {
    Sinon.restore();
    runnerMulti.resetForTesting();
  });

  describe('addJob', () => {
    it('can add a FakeSleepForJobMulti (sorted) even if one is already there', async () => {
      await runnerMulti.loadJobsFromDb();
      const job = getFakeSleepForMultiJob({ timestamp: 1234 });
      const job2 = getFakeSleepForMultiJob({ timestamp: 123 });
      const job3 = getFakeSleepForMultiJob({ timestamp: 1 });

      let result = await runnerMulti.addJob(job);
      expect(result).to.eq('job_added');

      result = await runnerMulti.addJob(job2);
      expect(result).to.eq('job_added');

      result = await runnerMulti.addJob(job3);
      expect(result).to.eq('job_added');

      expect(runnerMulti.getScheduledJobs()).to.deep.eq([
        job3.serializeJob(),
        job2.serializeJob(),
        job.serializeJob(),
      ]);
    });

    it('cannot add a FakeSleepForJobMulti with an id already existing', async () => {
      await runnerMulti.loadJobsFromDb();
      const job = getFakeSleepForMultiJob({ timestamp: 1234 });
      const job2 = getFakeSleepForMultiJob({
        timestamp: 123,
        identifier: job.persistedData.identifier,
      });
      let result = await runnerMulti.addJob(job);
      expect(result).to.be.eq('job_added');
      result = await runnerMulti.addJob(job2);
      expect(result).to.be.eq('identifier_exists');

      expect(runnerMulti.getScheduledJobs()).to.deep.eq([job.serializeJob()]);
    });

    it('two jobs are running sequentially', async () => {
      await runnerMulti.loadJobsFromDb();
      TestUtils.stubWindowLog();
      const job = getFakeSleepForMultiJob({ timestamp: 5 });
      const job2 = getFakeSleepForMultiJob({ timestamp: 200 });
      runnerMulti.startProcessing();
      clock.tick(100);

      // job should be started right away
      let result = await runnerMulti.addJob(job);
      expect(result).to.eq('job_added');
      result = await runnerMulti.addJob(job2);
      expect(result).to.eq('job_added');
      expect(runnerMulti.getScheduledJobs()).to.deep.eq([job.serializeJob(), job2.serializeJob()]);
      expect(runnerMulti.getCurrentJobIdentifiers()).to.be.deep.equal([
        job.persistedData.identifier,
      ]);

      // each job takes 5s to finish, so let's tick once the first one should be done
      clock.tick(5000);
      expect(runnerMulti.getCurrentJobIdentifiers()).to.be.deep.equal([
        job.persistedData.identifier,
      ]);
      let awaited = await runnerMulti.waitCurrentJobs();
      expect(awaited).to.eq('await');
      await sleepFor(10);
      expect(runnerMulti.getCurrentJobIdentifiers()).to.be.deep.equal([
        job2.persistedData.identifier,
      ]);
      clock.tick(5000);

      awaited = await runnerMulti.waitCurrentJobs();
      expect(awaited).to.eq('await');
      await sleepFor(10); // those sleep for is just to let the runner the time to finish writing the tests to the DB and exit the handling of the previous test

      expect(runnerMulti.getCurrentJobIdentifiers()).to.deep.eq([]);

      expect(runnerMulti.getScheduledJobs()).to.deep.eq([]);
    });

    it('adding one job after the first is done starts it', async () => {
      await runnerMulti.loadJobsFromDb();
      const job = getFakeSleepForMultiJob({ timestamp: 100 });
      const job2 = getFakeSleepForMultiJob({ timestamp: 120 });
      runnerMulti.startProcessing();
      clock.tick(110);
      // job should be started right away
      let result = await runnerMulti.addJob(job);
      expect(result).to.eq('job_added');
      expect(runnerMulti.getScheduledJobs()).to.deep.eq([job.serializeJob()]);
      expect(runnerMulti.getCurrentJobIdentifiers()).to.be.deep.equal([
        job.persistedData.identifier,
      ]);

      clock.tick(5000);

      await runnerMulti.waitCurrentJobs();
      // just give some time for the runnerMulti to pick up a new job
      await sleepFor(10);
      expect(runnerMulti.getScheduledJobs()).to.deep.eq([]);
      expect(runnerMulti.getCurrentJobIdentifiers()).to.be.deep.equal([]);

      // the first job should already be finished now
      result = await runnerMulti.addJob(job2);
      expect(result).to.eq('job_added');
      expect(runnerMulti.getScheduledJobs()).to.deep.eq([job2.serializeJob()]);

      // each job takes 5s to finish, so let's tick once the first one should be done
      clock.tick(5010);
      await runnerMulti.waitCurrentJobs();
      await sleepFor(10);

      expect(runnerMulti.getScheduledJobs()).to.deep.eq([]);
    });

    it('adding one job after the first is done schedules it', async () => {
      await runnerMulti.loadJobsFromDb();
      TestUtils.stubWindowLog();
      const job = getFakeSleepForMultiJob({ timestamp: 100 });
      runnerMulti.startProcessing();
      clock.tick(110);
      // job should be started right away
      let result = await runnerMulti.addJob(job);

      expect(runnerMulti.getScheduledJobs()).to.deep.eq([job.serializeJob()]);

      expect(result).to.eq('job_added');
      clock.tick(5010);
      await runnerMulti.waitCurrentJobs();
      clock.tick(5010);
      // just give some time for the runner to pick up a new job

      await sleepFor(5);

      const job2 = getFakeSleepForMultiJob({ timestamp: clock.now + 100 });

      // job should already be finished now
      result = await runnerMulti.addJob(job2);
      // new job should be deferred as timestamp is not in the past
      expect(result).to.eq('job_added');
      expect(runnerMulti.getScheduledJobs()).to.deep.eq([job2.serializeJob()]);

      // tick enough for the job to need to be started
      clock.tick(100);

      // that job2 should be running now
      await sleepFor(5);
      clock.tick(5000);

      await job2.waitForCurrentTry();
      clock.tick(730);

      await runnerMulti.waitCurrentJobs();

      // we need to give some time for the jobrunner to handle the return of job2 and remove it
      await sleepFor(5);

      expect(runnerMulti.getScheduledJobs()).to.deep.eq([]);
    });
  });

  describe('retriesFailing Jobs', () => {
    it('does await if there are jobs and one is started', async () => {
      await runnerMulti.loadJobsFromDb();
      const job = getFakeSleepForMultiJob({ timestamp: 100, returnResult: false }); // this job keeps failing, on purpose
      runnerMulti.startProcessing();
      clock.tick(110);
      // job should be started right away
      const result = await runnerMulti.addJob(job);
      expect(runnerMulti.getScheduledJobs()).to.deep.eq([job.serializeJob()]);
      expect(runnerMulti.getCurrentJobs()).to.deep.eq([job.serializeJob()]);

      expect(result).to.eq('job_added');
      // the job takes 5 fake seconds, tick a bit less than that and then wait for it to finish
      clock.tick(multiJobSleepDuration - 50);
      expect(runnerMulti.getCurrentJobs()).to.deep.eq([job.serializeJob()]);

      await runnerMulti.waitCurrentJobs();
      const jobUpdated = {
        ...job.serializeJob(),
        nextAttemptTimestamp: clock.now + job.persistedData.delayBetweenRetries,
        currentRetry: 1,
      };
      // just give time for the runnerMulti to sort out the job finishing
      await sleepFor(10);

      // the job failed, so the job should still be there with a currentRetry of 1
      expect(runnerMulti.getScheduledJobs()).to.deep.eq([jobUpdated]);
      expect(runnerMulti.getCurrentJobs()).to.deep.eq([]);
      clock.tick(job.persistedData.delayBetweenRetries + 50);
      expect(runnerMulti.planNextJobs());

      // job should have been rescheduled after 10s, so if we tick 10000 + 4900ms, we should have that job about to be done again
      clock.tick(multiJobSleepDuration - 50);
      await runnerMulti.waitCurrentJobs();
      await sleepFor(10);

      const jobUpdated2 = {
        ...job.serializeJob(),
        nextAttemptTimestamp: clock.now + job.persistedData.delayBetweenRetries - 20, // the 20 is for the sleepFor we had earlier
        currentRetry: 2,
      };

      await sleepFor(10);

      expect(runnerMulti.getScheduledJobs()).to.deep.eq([jobUpdated2]);

      // that job should be retried one more time and then removed from the list of jobs to be run
      clock.tick(job.persistedData.delayBetweenRetries + 50);
      expect(runnerMulti.planNextJobs());
      clock.tick(multiJobSleepDuration - 20);

      await runnerMulti.waitCurrentJobs();

      await sleepFor(10);

      expect(runnerMulti.getScheduledJobs()).to.deep.eq([]);
    });
  });
});
