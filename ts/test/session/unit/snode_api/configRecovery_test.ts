import chai from 'chai';
import { beforeEach, describe } from 'mocha';
import Sinon from 'sinon';
import { PubkeyType } from 'libsession_util_nodejs';

import { ConfigRecovery } from '../../../../session/apis/snode_api/configRecovery';
import {
  UserGenericWrapperActions,
  UserGroupsWrapperActions,
} from '../../../../webworker/workers/browser/libsession_worker_interface';
import { LibSessionUtil } from '../../../../session/utils/libsession/libsession_utils';
import { MessageSender } from '../../../../session/sending/MessageSender';
import { UserUtils } from '../../../../session/utils';
import { SnodeNamespaces } from '../../../../session/apis/snode_api/namespaces';
import {
  DeleteHashesFromUserNodeSubRequest,
  StoreUserConfigSubRequest,
} from '../../../../session/apis/snode_api/SnodeRequestTypes';
import { TestUtils } from '../../../test-utils';

const { expect } = chai;

/**
 * The shared guard and action vectors — V10-V13, V17 and V18.
 * The response-shaped vectors live in configExpiryDetection_test.ts.
 *
 * V22 is deliberately NOT here. It is about the polling path reaching this module at all, and
 * supplying that precondition in setup — as every test below does — is exactly what hides the bug
 * it guards against. It lives in SwarmPolling_configRecovery_test.ts.
 *
 * ON "ASSERTS THAT X DOES NOT HAPPEN" TESTS. Every such assertion here is also satisfied by the path
 * dying early, so each needs something proving it got as far as the decision. Most do. Three cannot,
 * and it is deliberate rather than an omission — V10, "nothing missing" and V12/V16 all have a
 * premise that IS "recoverIfNeeded returns at its first guard", so there is no later stage to
 * witness. Don't add a reachability assertion to those; there is nothing to assert. Their
 * protection is that a harness death would break the tests around them that DO have one.
 */

const H1 = 'hash1';
const H2 = 'hash2';

describe('ConfigRecovery', () => {
  let us: PubkeyType;
  let sendStub: Sinon.SinonStub;

  /** what a clean, healthy ContactsConfig holding H1 and H2 looks like to the wrapper */
  function stubWrappers({
    activeHashes = [H1, H2],
    needsPush = false,
    parts = [new Uint8Array([1])],
    obsoleteHashes = [] as Array<string>,
  } = {}) {
    const needsPushStub = Sinon.stub(UserGenericWrapperActions, 'needsPush').callsFake(
      async variant => (variant === 'ContactsConfig' ? needsPush : false)
    );
    const activeHashesStub = Sinon.stub(UserGenericWrapperActions, 'activeHashes').callsFake(
      async variant => (variant === 'ContactsConfig' ? activeHashes : [])
    );
    Sinon.stub(UserGenericWrapperActions, 'push').resolves({
      data: parts,
      seqno: 5,
      hashes: obsoleteHashes,
      namespace: SnodeNamespaces.UserContacts,
    });

    return { needsPushStub, activeHashesStub };
  }

  /** across every batch: the delete goes in its own, after the stores have run */
  function allSubRequestsSent() {
    return sendStub.getCalls().flatMap(c => c.args[0].sortedSubRequests as Array<unknown>);
  }

  function storeRequestsSent() {
    return allSubRequestsSent().filter(r => r instanceof StoreUserConfigSubRequest);
  }

  function deleteRequestSent() {
    return allSubRequestsSent().find(
      (r): r is DeleteHashesFromUserNodeSubRequest =>
        r instanceof DeleteHashesFromUserNodeSubRequest
    );
  }

  beforeEach(() => {
    TestUtils.stubWindowLog();
    ConfigRecovery.resetForTesting();
    us = TestUtils.generateFakePubKeyStr();
    Sinon.stub(UserUtils, 'getOurPubKeyStrFromCache').returns(us);
    Sinon.stub(UserUtils, 'isUsFromCache').callsFake(pk => pk === us);
    Sinon.stub(LibSessionUtil, 'saveDumpsToDb').resolves();
    // one result per sub-request sent, which is what the caller checks for
    sendStub = Sinon.stub(MessageSender, 'sendEncryptedDataToSnode').callsFake(
      async ({ sortedSubRequests }: any) =>
        sortedSubRequests.map(() => ({ code: 200, body: { hash: 'newhash' } })) as any
    );
  });

  afterEach(() => {
    Sinon.restore();
  });

  function detectMissing(hashes: Array<string>) {
    ConfigRecovery.recordDetection(us, { status: 'conclusive', missingHashes: hashes });
  }

  it('V10: no successful poll AT ALL this session -> recovery MUST NOT run', async () => {
    stubWrappers();
    detectMissing([H2]);

    // deliberately not marking the swarm level. Note this is "no poll succeeded", NOT "no merge
    // happened" — a successful poll that returned nothing also makes us level, and V22 covers it.
    const ran = await ConfigRecovery.recoverIfNeeded(us);

    expect(ran, 'recovery must not run before any successful poll').to.be.false;
    expect(sendStub.called, 'nothing may be sent').to.be.false;
  });

  it('the same detection recovers once we are level with the swarm', async () => {
    stubWrappers();
    detectMissing([H2]);
    ConfigRecovery.markLocalStateLevelWithSwarm(us);

    const ran = await ConfigRecovery.recoverIfNeeded(us);

    expect(ran, 'recovery should run after a merge').to.be.true;
    expect(storeRequestsSent().length).to.be.eq(1);
  });

  it('V10b: another swarm being level does NOT satisfy THIS swarm', async () => {
    // Per-swarm keying. A flat or global "we polled successfully" flag passes every other vector
    // in the table and fails only here.
    const otherSwarm = TestUtils.generateFakePubKeyStr();
    stubWrappers();
    detectMissing([H2]);
    ConfigRecovery.markLocalStateLevelWithSwarm(otherSwarm);

    expect(
      ConfigRecovery.localStateIsLevelWithSwarm(otherSwarm),
      'the other swarm really is level — otherwise this passes for the wrong reason'
    ).to.be.true;
    expect(
      await ConfigRecovery.recoverIfNeeded(us),
      'but ours is not, and being level is per-swarm'
    ).to.be.false;
    expect(sendStub.called).to.be.false;
  });

  it('expired bars are PRUNED, not just read past — the leak is otherwise invisible', async () => {
    // Reading past an expired entry gives the right answer, so every behavioural test passes with
    // or without pruning. What is left is a map that grows for the life of the process — against
    // long-lived sessions, which is the exact population the time-bound was added to protect.
    // Note the hashes must ROTATE between rounds. Re-storing the same hashes overwrites the same
    // keys, so the map stays the same size whether or not it prunes — a version of this test that
    // reuses one hash set passes with pruning removed, which is how the first draft of it did.
    let fakeNow = 1_700_000_000_000;
    ConfigRecovery.setNowForTesting(() => fakeNow);
    let currentHashes = ['R1', 'R2'];
    Sinon.stub(UserGenericWrapperActions, 'needsPush').resolves(false);
    Sinon.stub(UserGenericWrapperActions, 'activeHashes').callsFake(async variant =>
      variant === 'ContactsConfig' ? currentHashes : []
    );
    Sinon.stub(UserGenericWrapperActions, 'push').resolves({
      data: [new Uint8Array([1])],
      seqno: 5,
      hashes: [],
      namespace: SnodeNamespaces.UserContacts,
    });
    ConfigRecovery.markLocalStateLevelWithSwarm(us);

    detectMissing(['R1']);
    await ConfigRecovery.recoverIfNeeded(us);
    expect(ConfigRecovery.barredHashCountForTesting(), 'two hashes barred').to.be.eq(2);

    // the config is re-pushed in the meantime, so it now occupies different hashes
    fakeNow += 61 * 60 * 1000;
    currentHashes = ['R3', 'R4'];
    detectMissing(['R3']);
    await ConfigRecovery.recoverIfNeeded(us);

    // Three, not two: R3 and R4 were stored, and R1 comes back as GUARD-settled because it is no
    // longer in activeHashes. R2 is the one that must be gone — it expired and nothing re-settled
    // it. Without pruning this is four.
    expect(
      ConfigRecovery.barredHashCountForTesting(),
      'the cleanly-expired entry is dropped rather than accumulating'
    ).to.be.eq(3);
  });

  it('V11: a hash no longer in the active set MUST NOT be re-stored', async () => {
    // H2 was reported missing, but this config has since moved on and no longer claims it
    const { activeHashesStub } = stubWrappers({ activeHashes: [H1] });
    detectMissing([H2]);
    ConfigRecovery.markLocalStateLevelWithSwarm(us);

    const ran = await ConfigRecovery.recoverIfNeeded(us);

    expect(activeHashesStub.called, 'the config must actually have been inspected').to.be.true;
    expect(ran, 'an obsolete hash is not ours to put back').to.be.false;
    expect(sendStub.called).to.be.false;
  });

  it('guard 4.2: a dirty config MUST NOT be re-stored', async () => {
    const { needsPushStub } = stubWrappers({ needsPush: true });
    detectMissing([H2]);
    ConfigRecovery.markLocalStateLevelWithSwarm(us);

    const ran = await ConfigRecovery.recoverIfNeeded(us);

    expect(needsPushStub.called, 'cleanliness must actually have been checked').to.be.true;
    expect(ran, 'recovery re-uploads existing state, it never creates new state').to.be.false;
    expect(sendStub.called).to.be.false;
  });

  it('V13: a hash is re-stored ONCE however many polls report it, within the bar interval', async () => {
    stubWrappers();
    detectMissing([H2]);
    ConfigRecovery.markLocalStateLevelWithSwarm(us);

    expect(await ConfigRecovery.recoverIfNeeded(us), 'first poll recovers').to.be.true;

    // the next poll still sees it missing, because the swarm hasn't caught up yet
    detectMissing([H2]);

    expect(await ConfigRecovery.recoverIfNeeded(us), 'second poll must not re-store').to.be.false;
    // "one send" holds for the BAR INTERVAL, not the session — the clock does not move in this
    // test, so the two are indistinguishable here and only V13g can tell them apart.
    expect(sendStub.callCount, 'exactly one send while the bar holds').to.be.eq(1);
  });

  it('V13g: the bar EXPIRES — a barred hash is re-stored after the interval, same session', async () => {
    // Driven by advancing the clock, NOT by restarting: a restart clears in-memory state and would
    // pass on the session-scoped version too. That is the trap this vector exists for — a
    // session-scoped bar passes V13, V13a and V13b and fails only here.
    //
    // Why it matters on Desktop specifically: there is no foreground gate, so a session
    // runs for weeks. "Never again this session" can outlive the 30-day TTL, and the hash the bar
    // is protecting can expire from the swarm a second time inside it.
    let fakeNow = 1_700_000_000_000;
    ConfigRecovery.setNowForTesting(() => fakeNow);
    stubWrappers();
    ConfigRecovery.markLocalStateLevelWithSwarm(us);

    detectMissing([H2]);
    expect(await ConfigRecovery.recoverIfNeeded(us), 'stored, and now barred').to.be.true;

    fakeNow += 5 * 60 * 1000; // five minutes later, still barred
    detectMissing([H2]);
    expect(await ConfigRecovery.recoverIfNeeded(us), 'the bar holds against a burst').to.be.false;

    fakeNow += 61 * 60 * 1000; // past HASH_BAR_MS (1 hour)
    detectMissing([H2]);

    expect(
      await ConfigRecovery.recoverIfNeeded(us),
      'the config expired again in a long-lived session, so it is ours to put back'
    ).to.be.true;
    expect(sendStub.callCount, 'two re-stores, an interval apart').to.be.eq(2);
  });

  it('V13h: a config too big for one batch is SPLIT across batches, not skipped', async () => {
    // 25 parts against a limit of 20. Skipping would make a config over ~1.5MB permanently
    // unrecoverable — the largest accounts, excluded by the fix written for them. The all-parts rule governs
    // when it counts as stored, not which transport the parts travel in.
    const many = Array.from({ length: 25 }, (_, i) => new Uint8Array([i]));
    stubWrappers({ activeHashes: ['P1'], parts: many, obsoleteHashes: ['old1'] });
    detectMissing(['P1']);
    ConfigRecovery.markLocalStateLevelWithSwarm(us);

    const ran = await ConfigRecovery.recoverIfNeeded(us);

    expect(ran, 'every part landed, across however many batches it took').to.be.true;
    // 20 + 5 stores, then the delete in its own batch once they have all landed
    expect(sendStub.callCount, 'two store batches plus the delete').to.be.eq(3);

    const sizes = sendStub.getCalls().map(c => c.args[0].sortedSubRequests.length);
    expect(Math.max(...sizes), 'no batch may exceed the limit').to.be.at.most(20);
    expect(storeRequestsSent().length, 'and nothing is dropped').to.be.eq(25);
    expect(deleteRequestSent(), 'the delete still goes out').to.not.be.undefined;
  });

  it('V13h (failure half): a batch failing part-way does NOT send the delete for the rest', async () => {
    const many = Array.from({ length: 25 }, (_, i) => new Uint8Array([i]));
    stubWrappers({ activeHashes: ['P1'], parts: many, obsoleteHashes: ['old1'] });
    detectMissing(['P1']);
    ConfigRecovery.markLocalStateLevelWithSwarm(us);
    sendStub.callsFake(async ({ sortedSubRequests }: any) =>
      sortedSubRequests.map(() => ({ code: 500, body: {} }))
    );

    const ran = await ConfigRecovery.recoverIfNeeded(us);

    expect(ran).to.be.false;
    expect(sendStub.callCount, 'it stops at the first failing batch').to.be.eq(1);
  });

  it('V17: the obsolete hashes push() returns are deleted, not dropped', async () => {
    // push() drains _old_hashes unconditionally, even for a clean config. If we discard them here
    // nothing ever reports them again and those messages leak on the swarm permanently.
    // Note: V17 is the user/admin path specifically. A read-only group member is never handed the
    // hashes at all (the hand-back is gated on !is_readonly(), the clear is not), so an empty list
    // there is correct rather than a failure — that's V21, and it needs group recovery first.
    stubWrappers({ obsoleteHashes: ['oldhash1', 'oldhash2'] });
    detectMissing([H2]);
    ConfigRecovery.markLocalStateLevelWithSwarm(us);

    await ConfigRecovery.recoverIfNeeded(us);

    const deleteRequest = deleteRequestSent();
    expect(deleteRequest, 'a delete request must be sent for the drained hashes').to.not.be
      .undefined;
    expect(deleteRequest?.messageHashes).to.have.members(['oldhash1', 'oldhash2']);
  });

  it('no delete for a config whose store did NOT land', async () => {
    // Deleting an obsolete hash whose replacement failed to store removes the swarm's only older
    // copy — a seed restore in that window then gets nothing rather than something stale. Note the
    // pair below: the absence assertion alone would also pass against a delete path that was never
    // wired at all.
    stubWrappers({ obsoleteHashes: ['oldhash1'] });
    detectMissing([H2]);
    ConfigRecovery.markLocalStateLevelWithSwarm(us);
    sendStub.callsFake(async ({ sortedSubRequests }: any) =>
      sortedSubRequests.map(() => ({ code: 500, body: {} }))
    );

    await ConfigRecovery.recoverIfNeeded(us);

    expect(storeRequestsSent().length, 'the store was attempted').to.be.eq(1);
    expect(deleteRequestSent(), 'but its obsolete hash is left alone').to.be.undefined;
  });

  it('counterpart: the SAME fixture DOES delete once the store lands', async () => {
    stubWrappers({ obsoleteHashes: ['oldhash1'] });
    detectMissing([H2]);
    ConfigRecovery.markLocalStateLevelWithSwarm(us);

    await ConfigRecovery.recoverIfNeeded(us);

    expect(storeRequestsSent().length, 'same store').to.be.eq(1);
    expect(
      deleteRequestSent()?.messageHashes,
      'and now the obsolete hash is safe to drop'
    ).to.have.members(['oldhash1']);
  });

  it('V17b: no delete request when push() returns no obsolete hashes', async () => {
    stubWrappers({ obsoleteHashes: [] });
    detectMissing([H2]);
    ConfigRecovery.markLocalStateLevelWithSwarm(us);

    await ConfigRecovery.recoverIfNeeded(us);

    // "no delete request" is also true when nothing was sent at all, so prove the re-store ran
    // first. Found by breaking the stubWrappers helper: this was the one survivor with no excuse.
    expect(storeRequestsSent().length, 'the re-store must actually have happened').to.be.eq(1);
    expect(deleteRequestSent()).to.be.undefined;
  });

  it('V18: every part of a multipart config is re-stored, not just the missing one', async () => {
    const parts = [new Uint8Array([1]), new Uint8Array([2]), new Uint8Array([3])];
    stubWrappers({ activeHashes: ['P1', 'P2', 'P3'], parts });
    detectMissing(['P2']);
    ConfigRecovery.markLocalStateLevelWithSwarm(us);

    await ConfigRecovery.recoverIfNeeded(us);

    expect(storeRequestsSent().length, 'all three parts go back').to.be.eq(3);
  });

  it('a persistently half-landing config is RATE-LIMITED, not retried on every poll', async () => {
    // The storm this replaces: the reset was keyed on "any sub-request returned 200", so a config
    // with one part that always succeeds beside one that always fails reset the counter every
    // round. Nothing barred, backoffMsFor(0) is 0, identical full re-send on every poll — measured
    // at 10 rounds / 10 sends / 0 barred.
    //
    // This test pins the SIZE of the retry, not its existence. The version it replaces asserted
    // only that a second attempt happened, which is true of the storm too — that is precisely why
    // the defect survived: every part goes back on every attempt, so a half-landing config
    // never shrinks its next round and "it retried" cannot distinguish progress from a loop.
    const fakeNow = 1_700_000_000_000; // deliberately not advanced
    ConfigRecovery.setNowForTesting(() => fakeNow);
    stubWrappers({ activeHashes: ['P1', 'P2'], parts: [new Uint8Array([1]), new Uint8Array([2])] });
    ConfigRecovery.markLocalStateLevelWithSwarm(us);

    // one part lands, one does not — repeatedly
    sendStub.callsFake(async ({ sortedSubRequests }: any) =>
      sortedSubRequests.map((_r: unknown, i: number) => ({ code: i === 0 ? 200 : 500, body: {} }))
    );

    for (let poll = 0; poll < 10; poll++) {
      detectMissing(['P1']);
      // eslint-disable-next-line no-await-in-loop
      await ConfigRecovery.recoverIfNeeded(us);
    }

    expect(
      sendStub.callCount,
      'ten polls collapse to one attempt — nothing was barred, so this is not progress'
    ).to.be.eq(1);
    expect(ConfigRecovery.barredHashCountForTesting(), 'and nothing is barred').to.be.eq(0);
  });

  it('but one config landing IN FULL beside a failing one DOES reset the backoff', async () => {
    // The counterpart, and the reason the reset is not simply keyed on total success: when several
    // configs are in flight and one lands completely, its hashes ARE barred and the next round is
    // genuinely smaller. That is convergence and must not be penalised.
    //
    // Without this pair, "reset on full success only" would look equally correct and would back off
    // against a swarm that is demonstrably making ground.
    const fakeNow = 1_700_000_000_000;
    ConfigRecovery.setNowForTesting(() => fakeNow);
    Sinon.stub(UserGenericWrapperActions, 'needsPush').resolves(false);
    Sinon.stub(UserGenericWrapperActions, 'activeHashes').callsFake(async variant =>
      variant === 'ContactsConfig' ? ['C1'] : variant === 'UserConfig' ? ['U1'] : []
    );
    Sinon.stub(UserGenericWrapperActions, 'push').resolves({
      data: [new Uint8Array([1])],
      seqno: 5,
      hashes: [],
      namespace: SnodeNamespaces.UserContacts,
    });
    ConfigRecovery.markLocalStateLevelWithSwarm(us);

    // the first config's store lands, the second's does not
    sendStub.callsFake(async ({ sortedSubRequests }: any) =>
      sortedSubRequests.map((_r: unknown, i: number) => ({ code: i === 0 ? 200 : 500, body: {} }))
    );

    detectMissing(['C1', 'U1']);
    await ConfigRecovery.recoverIfNeeded(us);
    expect(sendStub.callCount).to.be.eq(1);
    expect(
      ConfigRecovery.barredHashCountForTesting(),
      'the config that landed in full is barred — this is what makes the next round smaller'
    ).to.be.greaterThan(0);

    // and because something was barred, the very next poll is allowed to try again
    detectMissing(['U1']);
    await ConfigRecovery.recoverIfNeeded(us);
    expect(sendStub.callCount, 'a converging swarm is not made to wait').to.be.eq(2);
  });

  it('settled detections are PRUNED — the accumulator does not grow for the life of the process', async () => {
    // Same leak pruneExpiredBars was written for, one map over and against the same population.
    // Hashes rotate on every re-push and a Desktop session runs for days, so every superseded hash
    // would otherwise be retained forever.
    //
    // The hashes must ROTATE between rounds, exactly as in the bars test. Re-detecting the same
    // hashes writes the same Set entries, so the size is unchanged whether or not it prunes — a
    // version of this reusing one hash set passes with the pruning removed.
    let fakeNow = 1_700_000_000_000;
    ConfigRecovery.setNowForTesting(() => fakeNow);
    let currentHashes = ['R1', 'R2'];
    Sinon.stub(UserGenericWrapperActions, 'needsPush').resolves(false);
    Sinon.stub(UserGenericWrapperActions, 'activeHashes').callsFake(async variant =>
      variant === 'ContactsConfig' ? currentHashes : []
    );
    Sinon.stub(UserGenericWrapperActions, 'push').resolves({
      data: [new Uint8Array([1])],
      seqno: 5,
      hashes: [],
      namespace: SnodeNamespaces.UserContacts,
    });
    ConfigRecovery.markLocalStateLevelWithSwarm(us);

    for (let round = 0; round < 5; round++) {
      currentHashes = [`R${round}a`, `R${round}b`];
      detectMissing([`R${round}a`]);
      // eslint-disable-next-line no-await-in-loop
      await ConfigRecovery.recoverIfNeeded(us);
      fakeNow += 61 * 60 * 1000; // past the bar, so the next round is admitted
    }

    // ONE, not five, and not zero. The property is that it stays CONSTANT as rounds accumulate —
    // the single entry is the round just completed, whose hashes were settled by a restore that ran
    // after this round's prune and will be dropped by the next one. Without pruning this is 5 and
    // climbs with every poll for the life of the process.
    expect(
      ConfigRecovery.trackedDetectionCountForTesting(us),
      'the accumulator is bounded by the round in flight, not by how many rounds have run'
    ).to.be.eq(1);
  });

  it('V13e: a hash ruled out by a GUARD is settled, not re-examined every poll', async () => {
    // "not stored" is three outcomes, not two. Stored -> barred; store FAILED ->
    // retryable; ruled out by a guard -> barred, because no guard's verdict changes within a
    // session. Folding guard-rejections into "failure" costs no requests — the rejection happens
    // before any network call — which is exactly why it does not look like a problem: it silently
    // re-examines and re-logs the same detection on every poll for the life of the session.
    const { activeHashesStub } = stubWrappers({ activeHashes: [H1] });
    detectMissing([H2]); // H2 is no longer active, so a guard will rule it out
    ConfigRecovery.markLocalStateLevelWithSwarm(us);

    await ConfigRecovery.recoverIfNeeded(us);
    const inspectionsAfterFirstPoll = activeHashesStub.callCount;
    expect(inspectionsAfterFirstPoll, 'the first poll must actually have inspected').to.be.above(0);

    // a later poll re-reports the same hash, as a real swarm would
    detectMissing([H2]);
    await ConfigRecovery.recoverIfNeeded(us);

    expect(
      activeHashesStub.callCount,
      'H2 was settled by the guard, so the second poll must not inspect again'
    ).to.be.eq(inspectionsAfterFirstPoll);
  });

  it('V13a + V13b: a store whose SUB-RESPONSE failed is retried, though the batch returned 200', async () => {
    // Two vectors, one fixture, because they are two claims about the same situation:
    //   V13a — the bar keys on SUCCESS, not on attempt. Read as a pair with V13, which alone
    //          passes on a bars-on-attempt implementation — which is why that reading went
    //          unnoticed for a long time. V13 cannot catch it; only this pairing can.
    //   V13b — "success" means every SUB-RESPONSE's own code, not that the outer batch returned.
    //          A sequence returns 200 while its sub-requests carry their own codes, so barring on
    //          "did not throw" would settle a hash having written nothing.
    // Either misreading excludes, for the whole session, exactly the device this feature is for.
    let fakeNow = 1_700_000_000_000;
    ConfigRecovery.setNowForTesting(() => fakeNow);
    stubWrappers({ activeHashes: ['P1', 'P2'], parts: [new Uint8Array([1]), new Uint8Array([2])] });
    detectMissing(['P1']);
    ConfigRecovery.markLocalStateLevelWithSwarm(us);

    sendStub.callsFake(async ({ sortedSubRequests }: any) =>
      sortedSubRequests.map((_r: unknown, i: number) => ({
        code: i === 0 ? 200 : 500,
        body: {},
      }))
    );

    expect(await ConfigRecovery.recoverIfNeeded(us), 'a partial store is not a success').to.be
      .false;

    // and it must not be banked as done: a later poll gets another go, once the backoff on the
    // failed attempt has elapsed
    fakeNow += 61 * 1000;
    sendStub.callsFake(async ({ sortedSubRequests }: any) =>
      sortedSubRequests.map(() => ({ code: 200, body: {} }))
    );
    detectMissing(['P1']);

    expect(
      await ConfigRecovery.recoverIfNeeded(us),
      'the hash was never successfully stored, so it is still ours to retry'
    ).to.be.true;
  });

  it('V13c + V13d: a failing store is rate-limited, but NEVER permanently excluded', async () => {
    // Release-without-bound is the re-push storm; a hard cap re-creates the exclusion the rule was
    // corrected to remove (three transient failures would write the device off for a session that
    // can last days). So: rate-limited, never excluded. Asserts BOTH halves with exact counts.
    // a swappable clock rather than Sinon fake timers: faking global time deadlocks mocha, and
    // faking only Date breaks its timeout accounting.
    let fakeNow = 1_700_000_000_000;
    ConfigRecovery.setNowForTesting(() => fakeNow);
    stubWrappers();
    sendStub.callsFake(async ({ sortedSubRequests }: any) =>
      sortedSubRequests.map(() => ({ code: 500, body: {} }))
    );
    ConfigRecovery.markLocalStateLevelWithSwarm(us);

    for (let poll = 0; poll < 10; poll++) {
      detectMissing([H2]);
      // eslint-disable-next-line no-await-in-loop
      expect(await ConfigRecovery.recoverIfNeeded(us), 'a failing store never reports success').to
        .be.false;
    }

    expect(sendStub.callCount, 'ten rapid polls collapse to one attempt').to.be.eq(1);

    fakeNow += 61 * 1000; // past the first backoff step (60s)
    detectMissing([H2]);
    await ConfigRecovery.recoverIfNeeded(us);
    expect(sendStub.callCount, 'and it tries again once the backoff elapses').to.be.eq(2);

    // V13c: the SECOND wait DOUBLES. A flat-rate implementation passes everything above and fails
    // only here, which is why it needs its own assertion rather than a longer tick.
    fakeNow += 61 * 1000;
    detectMissing([H2]);
    await ConfigRecovery.recoverIfNeeded(us);
    expect(sendStub.callCount, '60s is not enough after a second failure — it is 120s').to.be.eq(2);

    fakeNow += 61 * 1000; // 122s total since the second failure
    detectMissing([H2]);
    await ConfigRecovery.recoverIfNeeded(us);
    expect(sendStub.callCount, 'but 120s is').to.be.eq(3);

    // V13d: the retry never stops. A ceiling on the INTERVAL, never on the entitlement — walk a
    // long failing session and confirm it is still trying at the end of it.
    let expected = 3;
    for (let hour = 0; hour < 24; hour++) {
      fakeNow += 60 * 60 * 1000;
      detectMissing([H2]);
      // eslint-disable-next-line no-await-in-loop
      await ConfigRecovery.recoverIfNeeded(us);
      expected += 1;
    }
    expect(
      sendStub.callCount,
      'a day of failures later it is STILL retrying — capped interval, uncapped attempts'
    ).to.be.eq(expected);
  });

  it('does nothing when detection reported nothing missing', async () => {
    stubWrappers();
    ConfigRecovery.recordDetection(us, { status: 'conclusive', missingHashes: [] });
    ConfigRecovery.markLocalStateLevelWithSwarm(us);

    expect(await ConfigRecovery.recoverIfNeeded(us)).to.be.false;
    expect(sendStub.called).to.be.false;
  });

  it('an inconclusive or unavailable detection records nothing', () => {
    detectMissing([H2]);
    ConfigRecovery.recordDetection(us, { status: 'inconclusive' });
    ConfigRecovery.recordDetection(us, { status: 'unavailable' });

    // and crucially, neither clears what a conclusive one already established
    expect(ConfigRecovery.getMissingHashes(us)).to.be.deep.eq([H2]);
  });

  describe('groups', () => {
    it('a group whose details cannot be read is not recovered, and the poll survives it', async () => {
      // This replaces a test asserting "group swarms are not re-stored on Desktop", which stopped
      // being true when group recovery landed. It had kept passing — but only because this file
      // never stubbed the group wrappers, so the lookup threw and the early return did the work.
      // The stub below makes the throw deliberate instead of incidental; the real group vectors
      // live in configRecoveryGroup_test.ts.
      Sinon.stub(UserGroupsWrapperActions, 'getGroup').rejects(new Error('no such group'));
      const groupPk = TestUtils.generateFakeClosedGroupV2PkStr();
      ConfigRecovery.recordDetection(groupPk, { status: 'conclusive', missingHashes: [H2] });
      ConfigRecovery.markLocalStateLevelWithSwarm(groupPk);

      const ran = await ConfigRecovery.recoverIfNeeded(groupPk);

      expect(ran, 'nothing inspectable, so nothing to put back').to.be.false;
      expect(sendStub.called, 'and nothing sent').to.be.false;
    });
  });
});
