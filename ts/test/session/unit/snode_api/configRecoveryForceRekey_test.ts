import chai from 'chai';
import { beforeEach, describe } from 'mocha';
import Sinon from 'sinon';
import { GroupPubkeyType } from 'libsession_util_nodejs';

import { ConfigRecoveryForceRekey } from '../../../../session/apis/snode_api/configRecoveryForceRekey';
import { ConfigRecovery } from '../../../../session/apis/snode_api/configRecovery';
import {
  MetaGroupWrapperActions,
  UserGroupsWrapperActions,
} from '../../../../webworker/workers/browser/libsession_worker_interface';
import { LibSessionUtil } from '../../../../session/utils/libsession/libsession_utils';
import { GroupSync } from '../../../../session/utils/job_runners/jobs/GroupSyncJob';
import { TestUtils } from '../../../test-utils';

const { expect } = chai;

/**
 * The force rekey — the only irreversible, universally visible write in config recovery.
 *
 * Every assertion below is about NOT doing it, which makes them all vulnerable to passing because
 * the path died early rather than because a rule held. Each therefore starts from a fixture that
 * WOULD rekey, and changes exactly one thing; the first test proves that fixture actually rekeys,
 * so every later refusal is measured against a known-live baseline.
 */
describe('ConfigRecovery force rekey', () => {
  let groupPk: GroupPubkeyType;
  let rekeyStub: Sinon.SinonStub;
  let backfillFailedStub: Sinon.SinonStub;

  /** the state in which a rekey IS warranted: admin, keys all gone, no bytes, backfill tried */
  function stubWarranted({
    secretKey = new Uint8Array(64).fill(7) as any,
    kicked = false,
    destroyed = false,
    keysHashes = ['keyshash1'],
    retained = {} as Record<string, Uint8Array>,
    backfillFailed = true,
  } = {}) {
    Sinon.stub(UserGroupsWrapperActions, 'getGroup').resolves({
      pubkeyHex: groupPk,
      secretKey,
      authData: null,
      kicked,
      destroyed,
      name: 'g',
      invitePending: false,
    } as any);
    Sinon.stub(MetaGroupWrapperActions, 'activeHashesByConfig').resolves({
      groupInfo: [],
      groupMember: [],
      groupKeys: keysHashes,
    });
    Sinon.stub(MetaGroupWrapperActions, 'activeKeyMessages').resolves(retained);
    backfillFailedStub = Sinon.stub(ConfigRecovery, 'keysBackfillHasFailedFor').returns(
      backfillFailed
    );
  }

  beforeEach(() => {
    TestUtils.stubWindowLog();
    ConfigRecoveryForceRekey.resetForTesting();
    ConfigRecovery.resetForTesting();
    groupPk = TestUtils.generateFakeClosedGroupV2PkStr();
    rekeyStub = Sinon.stub(MetaGroupWrapperActions, 'keyRekey').resolves(undefined as any);
    Sinon.stub(LibSessionUtil, 'saveDumpsToDb').resolves();
    Sinon.stub(GroupSync, 'queueNewJobIfNeeded').resolves();
  });

  afterEach(() => {
    Sinon.restore();
  });

  /** put the store into "level as of the poll running now" */
  function levelNow() {
    ConfigRecovery.beginPollForSwarm(groupPk);
    ConfigRecovery.markLocalStateLevelWithSwarm(groupPk);
  }

  it('rekeys when nothing here can restore the keys — the baseline every refusal is measured against', async () => {
    stubWarranted();
    levelNow();

    const did = await ConfigRecoveryForceRekey.forceRekeyIfPossible(groupPk);

    expect(did, 'the fixture genuinely rekeys').to.be.true;
    expect(rekeyStub.calledOnceWith(groupPk)).to.be.true;
    expect(
      (LibSessionUtil.saveDumpsToDb as unknown as Sinon.SinonStub).calledWith(groupPk),
      'and the new generation is persisted, or it dies with the process'
    ).to.be.true;
    expect(
      (GroupSync.queueNewJobIfNeeded as unknown as Sinon.SinonStub).called,
      'and queued for push, or nobody else ever sees it'
    ).to.be.true;
  });

  it('REFUSES a stale members view, even though everything else warrants it', async () => {
    // The rekey encrypts to this device's view of the members. If that view is behind, whoever was
    // added since is silently left out — and this fires precisely on devices whose config state is
    // known to be degraded, so "behind" is the expected condition rather than the unlucky one.
    stubWarranted();

    // no mark for the current poll — the store answers false
    const did = await ConfigRecoveryForceRekey.forceRekeyIfPossible(groupPk);

    expect(did).to.be.false;
    expect(rekeyStub.called, 'nothing minted from a members list we know may be behind').to.be
      .false;
  });

  it('REFUSES when a backfill has never run', async () => {
    // "We hold no bytes" cannot distinguish "a backfill ran and found nothing" from "no backfill has
    // ever run" — identical on a fresh install, a restored backup, or before the first poll
    // completes. Only the first justifies this.
    stubWarranted({ backfillFailed: false });
    levelNow();

    const did = await ConfigRecoveryForceRekey.forceRekeyIfPossible(groupPk);

    expect(did).to.be.false;
    expect(backfillFailedStub.called, 'PREMISE: it actually consulted the record').to.be.true;
    expect(rekeyStub.called).to.be.false;
  });

  it('REFUSES when one keys message is still recoverable', async () => {
    // A single surviving keys hash still lets a new device in, so the group is not stuck.
    stubWarranted({
      keysHashes: ['keyshash1', 'keyshash2'],
      retained: { keyshash2: new Uint8Array([1]) },
    });
    levelNow();

    expect(await ConfigRecoveryForceRekey.forceRekeyIfPossible(groupPk)).to.be.false;
    expect(rekeyStub.called).to.be.false;
  });

  it('REFUSES for a member — only an admin can mint a key', async () => {
    stubWarranted({ secretKey: null });
    levelNow();

    expect(await ConfigRecoveryForceRekey.forceRekeyIfPossible(groupPk)).to.be.false;
    expect(rekeyStub.called).to.be.false;
  });

  it('REFUSES for a kicked or destroyed group', async () => {
    stubWarranted({ destroyed: true });
    levelNow();

    expect(await ConfigRecoveryForceRekey.forceRekeyIfPossible(groupPk)).to.be.false;
    expect(rekeyStub.called).to.be.false;
  });

  it('V25e: refuses when the level mark is from a PREVIOUS poll', async () => {
    // The whole point of the poll token. A device that was level yesterday and has not completed a
    // poll since still answers true to the sticky question, and its members list may be behind by
    // exactly the member a rekey would drop. Three states, one fixture, asserting on the rekey
    // count rather than the return value so a refusal cannot be confused with a throw.
    stubWarranted();

    // 1. a poll has begun, nothing marked -> nothing to be level from
    ConfigRecovery.beginPollForSwarm(groupPk);
    await ConfigRecoveryForceRekey.forceRekeyIfPossible(groupPk);
    expect(rekeyStub.callCount, 'unmarked poll: refuse').to.be.eq(0);

    // 2. marked during THIS poll -> proceed
    ConfigRecovery.markLocalStateLevelWithSwarm(groupPk);
    await ConfigRecoveryForceRekey.forceRekeyIfPossible(groupPk);
    expect(rekeyStub.callCount, 'marked this poll: proceed').to.be.eq(1);

    // 3. a NEW poll begins, so the mark is now from the previous one -> refuse
    ConfigRecoveryForceRekey.resetForTesting(); // clear the once-per-session guard, isolating this rule
    ConfigRecovery.beginPollForSwarm(groupPk);
    await ConfigRecoveryForceRekey.forceRekeyIfPossible(groupPk);
    expect(
      rekeyStub.callCount,
      'a new poll makes the earlier mark stale, even though the sticky question still says level'
    ).to.be.eq(1);

    // and the sticky question DOES still say level — otherwise this test passes for the wrong reason
    expect(
      ConfigRecovery.localStateIsLevelWithSwarm(groupPk),
      'PREMISE: the sticky reading is still true, so only the poll-scoped one refused'
    ).to.be.true;
  });

  it('rekeys a group ONCE — a second call in the same session is refused', async () => {
    // Without this, every poll that still sees the old preconditions mints another generation, and
    // each one is a write every member on every version has to process.
    stubWarranted();
    levelNow();

    expect(await ConfigRecoveryForceRekey.forceRekeyIfPossible(groupPk)).to.be.true;
    expect(await ConfigRecoveryForceRekey.forceRekeyIfPossible(groupPk)).to.be.false;
    expect(rekeyStub.callCount, 'exactly one generation minted').to.be.eq(1);
  });

  it('the 24h cooldown lapses — a failed rekey is retried, but not before 24h', async () => {
    // The cooldown is a SEPARATE guard from the once-per-session set above, and it is the only one
    // of the two that can lapse: the session set is only written on success, so the cooldown's
    // reachable job is throttling RETRIES after a rekey that threw. Untested, a guard that never
    // lapses would leave such a group unable to ever try again, and — because the interval is a
    // full day — would be indistinguishable from a working guard for that whole day.
    stubWarranted();
    levelNow();

    let now = 1_000_000;
    ConfigRecoveryForceRekey.setNowForTesting(() => now);

    // an attempt that FAILS: the cooldown is stamped before the call, the session set is not
    rekeyStub.rejects(new Error('swarm unreachable'));
    expect(await ConfigRecoveryForceRekey.forceRekeyIfPossible(groupPk)).to.be.false;
    expect(rekeyStub.callCount, 'PREMISE: it genuinely attempted').to.be.eq(1);

    rekeyStub.resolves(undefined as any);

    // immediately after, and repeatedly: refused
    await ConfigRecoveryForceRekey.forceRekeyIfPossible(groupPk);
    await ConfigRecoveryForceRekey.forceRekeyIfPossible(groupPk);
    expect(rekeyStub.callCount, 'inside the window, however many polls run').to.be.eq(1);

    // 2 hours later: still refused. This step is what pins the interval at 24h — without it a
    // silent regression to a one-hour cooldown passes every other assertion here.
    now += 2 * 60 * 60 * 1000;
    await ConfigRecoveryForceRekey.forceRekeyIfPossible(groupPk);
    expect(rekeyStub.callCount, 'two hours is not a lapse').to.be.eq(1);

    // a further 23 hours: the guard lapses and the failed rekey is retried.
    // This step also discriminates WHICH guard refused above — the once-per-session set never
    // lapses, so if it had been the blocker this would still read 1.
    now += 23 * 60 * 60 * 1000;
    await ConfigRecoveryForceRekey.forceRekeyIfPossible(groupPk);
    expect(rekeyStub.callCount, 'past 24h the group gets another chance').to.be.eq(2);
  });
});
