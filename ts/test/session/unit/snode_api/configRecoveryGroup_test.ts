import chai from 'chai';
import { beforeEach, describe } from 'mocha';
import Sinon from 'sinon';
import { GroupPubkeyType, PubkeyType } from 'libsession_util_nodejs';

import { ConfigRecovery } from '../../../../session/apis/snode_api/configRecovery';
import {
  MetaGroupWrapperActions,
  UserGroupsWrapperActions,
} from '../../../../webworker/workers/browser/libsession_worker_interface';
import { LibSessionUtil } from '../../../../session/utils/libsession/libsession_utils';
import { MessageSender } from '../../../../session/sending/MessageSender';
import { UserUtils } from '../../../../session/utils';
import {
  DeleteHashesFromGroupNodeSubRequest,
  StoreGroupInfoSubRequest,
  StoreGroupKeysSubRequest,
  StoreGroupMembersSubRequest,
} from '../../../../session/apis/snode_api/SnodeRequestTypes';
import { TestUtils } from '../../../test-utils';
import { ConvoHub } from '../../../../session/conversations';
import { SnodePool } from '../../../../session/apis/snode_api/snodePool';
import { SnodeAPIRetrieve } from '../../../../session/apis/snode_api/retrieveRequest';
import { SnodeNamespaces } from '../../../../session/apis/snode_api/namespaces';

const { expect } = chai;

/**
 * Group recovery — the vectors that were blocked on the wrapper until v0.6.20 exposed
 * `pushForRecovery()` and `activeHashesByConfig()`: V16, V16a, V16b, V19, V20, V21.
 *
 * The user-path vectors are in configRecovery_test.ts and are NOT repeated here. What is specific
 * to groups is: which sub-config a hash belongs to (GroupKeys goes back only from retained bytes,
 * verbatim), and whether we are an admin or a member (a member cannot delete).
 *
 * ON "ASSERTS THAT X DOES NOT HAPPEN" TESTS — same rule as the user file. Every absence assertion
 * below is also satisfied by the path dying early, so each carries something proving it reached the
 * decision. Where a vector's own premise is "it stops at a guard", the reachability anchor is the
 * paired positive test using the SAME fixture, named in the test.
 */

const INFO_HASH = 'infohash1';
const MEMBER_HASH = 'memberhash1';
const KEYS_HASH = 'keyshash1';

describe('ConfigRecovery (groups)', () => {
  let groupPk: GroupPubkeyType;
  let us: PubkeyType;
  let sendStub: Sinon.SinonStub;

  /** a clean group we are an ADMIN of, holding one hash in each of the three sub-configs */
  function stubGroup({
    secretKey = new Uint8Array(64).fill(7) as any,
    authData = null as any,
    kicked = false,
    destroyed = false,
    needsPush = false,
    infoHashes = [INFO_HASH],
    memberHashes = [MEMBER_HASH],
    keysHashes = [KEYS_HASH],
    infoParts = [new Uint8Array([1])],
    memberParts = [new Uint8Array([2])],
    infoObsolete = [] as Array<string>,
    memberObsolete = [] as Array<string>,
    retainedKeyMessages = {} as Record<string, Uint8Array>,
  } = {}) {
    Sinon.stub(UserGroupsWrapperActions, 'getGroup').resolves({
      pubkeyHex: groupPk,
      secretKey,
      authData,
      kicked,
      destroyed,
      name: 'g',
      invitePending: false,
    } as any);
    Sinon.stub(MetaGroupWrapperActions, 'needsPush').resolves(needsPush);
    Sinon.stub(MetaGroupWrapperActions, 'activeHashesByConfig').resolves({
      groupInfo: infoHashes,
      groupMember: memberHashes,
      groupKeys: keysHashes,
    });
    // Must be stubbed even for tests that are not about keys. Without it the call throws, the
    // inspection reports "could not inspect" and every keys assertion below passes through the
    // error path instead of the rule it names.
    Sinon.stub(MetaGroupWrapperActions, 'activeKeyMessages').resolves(retainedKeyMessages);
    Sinon.stub(MetaGroupWrapperActions, 'pushForRecovery').resolves({
      groupInfo: { data: infoParts, seqno: 5, hashes: infoObsolete, namespace: 12 },
      groupMember: { data: memberParts, seqno: 5, hashes: memberObsolete, namespace: 13 },
    } as any);
  }

  function allSubRequestsSent() {
    return sendStub.getCalls().flatMap(c => c.args[0].sortedSubRequests as Array<unknown>);
  }

  function infoStoresSent() {
    return allSubRequestsSent().filter(r => r instanceof StoreGroupInfoSubRequest);
  }

  function memberStoresSent() {
    return allSubRequestsSent().filter(r => r instanceof StoreGroupMembersSubRequest);
  }

  function keysStoresSent() {
    return allSubRequestsSent().filter(
      (r): r is StoreGroupKeysSubRequest => r instanceof StoreGroupKeysSubRequest
    );
  }

  function deleteRequestSent() {
    return allSubRequestsSent().find(
      (r): r is DeleteHashesFromGroupNodeSubRequest =>
        r instanceof DeleteHashesFromGroupNodeSubRequest
    );
  }

  beforeEach(() => {
    TestUtils.stubWindowLog();
    ConfigRecovery.resetForTesting();
    us = TestUtils.generateFakePubKeyStr();
    groupPk = TestUtils.generateFakeClosedGroupV2PkStr();
    Sinon.stub(UserUtils, 'getOurPubKeyStrFromCache').returns(us);
    Sinon.stub(UserUtils, 'isUsFromCache').callsFake(pk => pk === us);
    Sinon.stub(LibSessionUtil, 'saveDumpsToDb').resolves();
    sendStub = Sinon.stub(MessageSender, 'sendEncryptedDataToSnode').callsFake(
      async ({ sortedSubRequests }: any) =>
        sortedSubRequests.map(() => ({ code: 200, body: { hash: 'newhash' } })) as any
    );
  });

  afterEach(() => {
    Sinon.restore();
  });

  function detectMissing(hashes: Array<string>) {
    ConfigRecovery.recordDetection(groupPk, { status: 'conclusive', missingHashes: hashes });
  }

  it('V19: a missing GroupInfo hash is re-stored, and GroupKeys is not flagged expired', async () => {
    // The vector's point is that a missing groupInfo hash says nothing about the keys. An
    // implementation that treats "any group hash missing" as "the group is gone" passes nothing
    // else in this file and fails here.
    stubGroup();
    detectMissing([INFO_HASH]);
    ConfigRecovery.markLocalStateLevelWithSwarm(groupPk);

    const ran = await ConfigRecovery.recoverIfNeeded(groupPk);

    expect(ran, 'the group config was put back').to.be.true;
    expect(infoStoresSent().length, 'groupInfo re-stored').to.be.eq(1);
    expect(
      memberStoresSent().length,
      'and groupMember was NOT, it claimed no missing hash'
    ).to.be.eq(0);
  });

  it('V16a: one GroupKeys hash missing while another is PRESENT — no re-store, group not expired', async () => {
    // The reason is "we retain no bytes for it", NOT "a keys message can never be put back" —
    // this fixture holds none. A device that DOES hold them re-stores instead, which is V23. Kept
    // as the no-bytes case because groups predating retention are real.
    stubGroup({ keysHashes: [KEYS_HASH, 'keyshash2'] });
    detectMissing([KEYS_HASH]);
    ConfigRecovery.markLocalStateLevelWithSwarm(groupPk);

    const ran = await ConfigRecovery.recoverIfNeeded(groupPk);

    expect(ran, 'nothing was restorable').to.be.false;
    expect(sendStub.called, 'and nothing was SENT — this fixture retains no bytes to send').to.be
      .false;
  });

  it('V16/V23a: EVERY GroupKeys hash missing and NO retained bytes — no re-store attempted', async () => {
    // The group predates keys retention, so there is nothing to push back. Unchanged behaviour, but
    // note the reason: not "impossible to recover" — "not recoverable BY THIS DEVICE". A peer that
    // holds the bytes can still repair it.
    stubGroup({ retainedKeyMessages: {} });
    detectMissing([KEYS_HASH]);
    ConfigRecovery.markLocalStateLevelWithSwarm(groupPk);

    const ran = await ConfigRecovery.recoverIfNeeded(groupPk);

    expect(ran).to.be.false;
    expect(sendStub.called, 'nothing held, so nothing to send').to.be.false;
  });

  it('V23: every GroupKeys hash missing but the bytes ARE held — re-store them', async () => {
    // The vector pins BYTES-HELD as the term, not the missing-ness: V23a has the identical missing
    // set and does nothing. The only difference between them is the retained map.
    stubGroup({ retainedKeyMessages: { [KEYS_HASH]: new Uint8Array([9, 9]) } });
    detectMissing([KEYS_HASH]);
    ConfigRecovery.markLocalStateLevelWithSwarm(groupPk);

    const ran = await ConfigRecovery.recoverIfNeeded(groupPk);

    expect(ran, 'a member CAN put keys back, because it pushes the bytes verbatim').to.be.true;
    expect(keysStoresSent().length, 'the keys message went out').to.be.eq(1);
    expect(
      keysStoresSent()[0].encryptedData,
      'and VERBATIM — re-signing is impossible, so any transformation breaks it'
    ).to.deep.eq(new Uint8Array([9, 9]));
  });

  it('V23 (member): a non-admin with retained bytes repairs the keys', async () => {
    // The point of the whole change. A member cannot sign a keys message, so this only works
    // because the bytes are pushed back unchanged.
    stubGroup({
      secretKey: null,
      authData: new Uint8Array(100).fill(3),
      retainedKeyMessages: { [KEYS_HASH]: new Uint8Array([9]) },
    });
    detectMissing([KEYS_HASH]);
    ConfigRecovery.markLocalStateLevelWithSwarm(groupPk);

    expect(await ConfigRecovery.recoverIfNeeded(groupPk)).to.be.true;
    expect(keysStoresSent().length).to.be.eq(1);
    expect(deleteRequestSent(), 'a keys message supersedes nothing, so no delete ever').to.be
      .undefined;
  });

  it('V23b: a supplemental is retained and re-stored too, not dropped', async () => {
    // Storage is hash-keyed, not generation-keyed, and a generation is the full rekey PLUS every
    // supplemental issued against it — a member receiving only one of them does not get the key.
    // We cannot group by generation (the accessor carries none), so EVERY retained message goes
    // back. That is a superset of the affected generation, which is what the rule protects.
    stubGroup({
      keysHashes: [KEYS_HASH, 'supplemental1'],
      retainedKeyMessages: {
        [KEYS_HASH]: new Uint8Array([1]),
        supplemental1: new Uint8Array([2]),
      },
    });
    detectMissing([KEYS_HASH]); // only ONE reported missing

    ConfigRecovery.markLocalStateLevelWithSwarm(groupPk);
    await ConfigRecovery.recoverIfNeeded(groupPk);

    expect(
      keysStoresSent().length,
      'both go back though only one was missing — a partial generation is unusable'
    ).to.be.eq(2);
  });

  it('V23c: a FAILED keys re-store is not banked as success', async () => {
    stubGroup({ retainedKeyMessages: { [KEYS_HASH]: new Uint8Array([9]) } });
    detectMissing([KEYS_HASH]);
    ConfigRecovery.markLocalStateLevelWithSwarm(groupPk);
    sendStub.callsFake(async ({ sortedSubRequests }: any) =>
      sortedSubRequests.map(() => ({ code: 500, body: {} }))
    );

    const ran = await ConfigRecovery.recoverIfNeeded(groupPk);

    expect(ran, 'a 500 is not a repair').to.be.false;
    expect(keysStoresSent().length, 'but it was attempted — this is not an early return').to.be.eq(
      1
    );
  });

  it('V16b: the device holds NO GroupKeys hashes at all, so no keys question was asked', async () => {
    // Distinct from V16: there, the keys hashes exist and are gone. Here we never had any, so a
    // missing groupInfo hash must still be recovered normally rather than the absence of keys
    // hashes being read as "the keys are missing".
    stubGroup({ keysHashes: [] });
    detectMissing([INFO_HASH]);
    ConfigRecovery.markLocalStateLevelWithSwarm(groupPk);

    const ran = await ConfigRecovery.recoverIfNeeded(groupPk);

    expect(ran, 'holding no keys hashes must not block an unrelated recovery').to.be.true;
    expect(infoStoresSent().length).to.be.eq(1);
  });

  it('V20: a non-admin MEMBER re-stores a clean GroupInfo whose hash is missing', async () => {
    // The trap this vector exists for is asserting the store is skipped for a member. It is not:
    // a member's subaccount token carries Read+Write, and this is the whole point of member-driven
    // recovery. Assert it SUCCEEDS.
    stubGroup({ secretKey: null, authData: new Uint8Array(100).fill(3) });
    detectMissing([INFO_HASH]);
    ConfigRecovery.markLocalStateLevelWithSwarm(groupPk);

    const ran = await ConfigRecovery.recoverIfNeeded(groupPk);

    expect(ran, 'a member CAN put its own copy back').to.be.true;
    expect(infoStoresSent().length, 'the store went out').to.be.eq(1);
  });

  it('V21: a member with an EMPTY obsolete-hash list still succeeds, and issues no delete', async () => {
    // Two traps in one vector. push() hands the superseded hashes back only if !is_readonly(), so
    // an empty list is EXPECTED for a member — asserting a non-empty one would be asserting a bug.
    // And a member could not delete anyway: its token has no Delete permission.
    stubGroup({ secretKey: null, authData: new Uint8Array(100).fill(3), infoObsolete: [] });
    detectMissing([INFO_HASH]);
    ConfigRecovery.markLocalStateLevelWithSwarm(groupPk);

    const ran = await ConfigRecovery.recoverIfNeeded(groupPk);

    expect(ran, 'the re-store still succeeds').to.be.true;
    expect(
      infoStoresSent().length,
      'proving we got past the store, not that we never tried'
    ).to.be.eq(1);
    expect(deleteRequestSent(), 'and no delete is attempted').to.be.undefined;
  });

  it('V21 (the gate itself): a MEMBER never deletes, even given a non-empty obsolete list', async () => {
    // The test above cannot see this rule. Its fixture has an EMPTY obsolete list, so "no delete"
    // is true there whether the admin check exists or not — found by mutation: removing the check
    // left that test green. push() should never hand a member a non-empty list, so this state is
    // not reachable through the wrapper today; the check is what stops it becoming a 401 storm if
    // that ever changes. Asserting it needs a fixture the real path cannot produce, which is the
    // point: an unreachable state is exactly what a defence-in-depth check is for.
    stubGroup({
      secretKey: null,
      authData: new Uint8Array(100).fill(3),
      infoObsolete: ['oldinfo1'],
    });
    detectMissing([INFO_HASH]);
    ConfigRecovery.markLocalStateLevelWithSwarm(groupPk);

    const ran = await ConfigRecovery.recoverIfNeeded(groupPk);

    expect(ran, 'the re-store still succeeds').to.be.true;
    expect(
      infoStoresSent().length,
      'and we got past the store rather than stopping short'
    ).to.be.eq(1);
    expect(deleteRequestSent(), 'but a member has no Delete permission, so no delete goes out').to
      .be.undefined;
  });

  it('V21 counterpart: an ADMIN with a non-empty obsolete list DOES delete', async () => {
    // The reachability control for the assertion above: without this, "no delete" would also pass
    // against a group delete path that was never wired at all.
    stubGroup({ infoObsolete: ['oldinfo1'] });
    detectMissing([INFO_HASH]);
    ConfigRecovery.markLocalStateLevelWithSwarm(groupPk);

    await ConfigRecovery.recoverIfNeeded(groupPk);

    expect(
      deleteRequestSent()?.messageHashes,
      'the admin prunes what it superseded'
    ).to.have.members(['oldinfo1']);
  });

  it('V23d: a successful keys re-store CLEARS an existing expired flag, eagerly', async () => {
    // Not left to the poller's reactive clear. That fires when config messages are RECEIVED — but
    // we just re-stored messages we already hold, so we may never receive or re-handle them, and
    // the flag would sit set forever over keys that are back on the swarm.
    const setExpired = Sinon.stub();
    const commit = Sinon.stub().resolves();
    Sinon.stub(ConvoHub, 'use').returns({
      get: () => ({ getIsExpired03Group: () => true, setIsExpired03Group: setExpired, commit }),
    } as any);

    stubGroup({ retainedKeyMessages: { [KEYS_HASH]: new Uint8Array([9]) } });
    detectMissing([KEYS_HASH]);
    ConfigRecovery.markLocalStateLevelWithSwarm(groupPk);

    await ConfigRecovery.recoverIfNeeded(groupPk);

    expect(keysStoresSent().length, 'the re-store happened').to.be.eq(1);
    expect(setExpired.calledOnceWith(false), 'and the flag was cleared by it').to.be.true;
    expect(commit.called, 'and persisted').to.be.true;
  });

  it('V23d counterpart: a FAILED keys re-store leaves the expired flag alone', async () => {
    // The reachability control for the assertion above: without it, "cleared" would also pass
    // against an implementation that cleared the flag unconditionally on every attempt.
    const setExpired = Sinon.stub();
    Sinon.stub(ConvoHub, 'use').returns({
      get: () => ({
        getIsExpired03Group: () => true,
        setIsExpired03Group: setExpired,
        commit: Sinon.stub().resolves(),
      }),
    } as any);

    stubGroup({ retainedKeyMessages: { [KEYS_HASH]: new Uint8Array([9]) } });
    detectMissing([KEYS_HASH]);
    ConfigRecovery.markLocalStateLevelWithSwarm(groupPk);
    sendStub.callsFake(async ({ sortedSubRequests }: any) =>
      sortedSubRequests.map(() => ({ code: 500, body: {} }))
    );

    await ConfigRecovery.recoverIfNeeded(groupPk);

    expect(keysStoresSent().length, 'it was attempted').to.be.eq(1);
    expect(setExpired.called, 'but nothing landed, so the group is still expired').to.be.false;
  });

  it('canRepairGroupKeys: true only when bytes are actually held', async () => {
    // What the poller asks before flagging a group expired. The flag means "not recoverable by this
    // device", so holding the bytes must defer it rather than raise-then-clear.
    stubGroup({ retainedKeyMessages: { [KEYS_HASH]: new Uint8Array([9]) } });
    expect(await ConfigRecovery.canRepairGroupKeys(groupPk)).to.be.true;
    Sinon.restore();

    TestUtils.stubWindowLog();
    stubGroup({ retainedKeyMessages: {} });
    expect(await ConfigRecovery.canRepairGroupKeys(groupPk)).to.be.false;
  });

  it('Q4/V16: all keys hashes gone and NO retained bytes -> the group is flagged EXPIRED', async () => {
    // Detection is the only thing that can raise the flag for this case. The poller's empty-fetch
    // branch cannot reach it by construction: that branch requires holding NO config hashes, and a
    // device in this state holds plenty — the hashes are exactly what told us they were missing.
    const setExpired = Sinon.stub();
    Sinon.stub(ConvoHub, 'use').returns({
      get: () => ({
        getIsExpired03Group: () => false,
        setIsExpired03Group: setExpired,
        commit: Sinon.stub().resolves(),
      }),
    } as any);

    stubGroup({ retainedKeyMessages: {} });
    detectMissing([KEYS_HASH]);
    ConfigRecovery.markLocalStateLevelWithSwarm(groupPk);

    await ConfigRecovery.recoverIfNeeded(groupPk);

    expect(setExpired.calledOnceWith(true), 'the banner is raised').to.be.true;
  });

  it('Q4/V16a: only SOME keys hashes gone -> NOT expired, even with no bytes', async () => {
    // The reachability control for the assertion above, and the vector's own point: one surviving
    // keys hash still lets a new device in, so a partial miss is not an expired group.
    const setExpired = Sinon.stub();
    Sinon.stub(ConvoHub, 'use').returns({
      get: () => ({
        getIsExpired03Group: () => false,
        setIsExpired03Group: setExpired,
        commit: Sinon.stub().resolves(),
      }),
    } as any);

    stubGroup({ keysHashes: [KEYS_HASH, 'keyshash2'], retainedKeyMessages: {} });
    detectMissing([KEYS_HASH]); // one of two
    ConfigRecovery.markLocalStateLevelWithSwarm(groupPk);

    await ConfigRecovery.recoverIfNeeded(groupPk);

    expect(setExpired.called, 'one surviving keys hash is not an expired group').to.be.false;
  });

  it('Q4/V23c: bytes held but the keys re-store FAILS -> expired after all', async () => {
    // The banner is deferred while we hold a repair in hand. Once that repair fails the keys are
    // still gone and still not back, so the user needs to know.
    const setExpired = Sinon.stub();
    Sinon.stub(ConvoHub, 'use').returns({
      get: () => ({
        getIsExpired03Group: () => false,
        setIsExpired03Group: setExpired,
        commit: Sinon.stub().resolves(),
      }),
    } as any);

    stubGroup({ retainedKeyMessages: { [KEYS_HASH]: new Uint8Array([9]) } });
    detectMissing([KEYS_HASH]);
    ConfigRecovery.markLocalStateLevelWithSwarm(groupPk);
    sendStub.callsFake(async ({ sortedSubRequests }: any) =>
      sortedSubRequests.map(() => ({ code: 500, body: {} }))
    );

    await ConfigRecovery.recoverIfNeeded(groupPk);

    expect(keysStoresSent().length, 'the repair was attempted').to.be.eq(1);
    expect(setExpired.calledWith(true), 'and having failed, the banner goes up').to.be.true;
  });

  it('Q10: a dirty groupInfo does NOT block KEYS recovery', async () => {
    // The clean-only gate exists so local state cannot overwrite newer remote state.
    // Keys recovery replays the exact bytes the swarm already had, so it cannot overwrite anything,
    // and a pending rekey produces a NEW message at a NEW generation — which says nothing about
    // whether the retained ones are stale. Gating keys on a dirty groupInfo excluded groups in
    // active use, which is the population most likely to need them.
    stubGroup({ needsPush: true, retainedKeyMessages: { [KEYS_HASH]: new Uint8Array([9]) } });
    detectMissing([KEYS_HASH]);
    ConfigRecovery.markLocalStateLevelWithSwarm(groupPk);

    const ran = await ConfigRecovery.recoverIfNeeded(groupPk);

    expect(ran, 'keys go back even though the group is dirty').to.be.true;
    expect(keysStoresSent().length).to.be.eq(1);
  });

  it('Q10 counterpart: a dirty group still blocks groupInfo/groupMember', async () => {
    // The exemption is keys-only. Info and members are re-serialised from local state, so the gate
    // is doing real work for them — without this, "dirty blocks nothing" would pass the test above.
    stubGroup({ needsPush: true });
    detectMissing([INFO_HASH]);
    ConfigRecovery.markLocalStateLevelWithSwarm(groupPk);

    const ran = await ConfigRecovery.recoverIfNeeded(groupPk);

    expect(ran).to.be.false;
    expect(infoStoresSent().length, 'GroupSync will push it under a new hash anyway').to.be.eq(0);
  });

  describe('keys backfill', () => {
    // The backfill exists to capture BYTES for keys messages the swarm still holds, so that this
    // device can repair the group later. It runs proactively — by the time detection fires, the
    // message it would have fetched is gone.

    function stubBackfill({
      keysHashes = [KEYS_HASH],
      retained = {} as Record<string, Uint8Array>,
      retainedAfterMerge = null as Record<string, Uint8Array> | null,
      fetched = [] as Array<{ hash: string; data: string; storedAt: number }>,
    } = {}) {
      Sinon.stub(SnodePool, 'getSwarmFor').resolves([
        { pubkey_ed25519: 'ed', ip: '1', port: 1 },
      ] as any);
      const hashesStub = Sinon.stub(MetaGroupWrapperActions, 'activeHashesByConfig').resolves({
        groupInfo: [],
        groupMember: [],
        groupKeys: keysHashes,
      });
      // second call (after the merge) reports the post-merge state when one is given
      const keysStub = Sinon.stub(MetaGroupWrapperActions, 'activeKeyMessages');
      keysStub.onFirstCall().resolves(retained);
      keysStub.resolves(retainedAfterMerge ?? retained);
      const mergeStub = Sinon.stub(MetaGroupWrapperActions, 'metaMerge').resolves(undefined as any);
      const retrieveStub = Sinon.stub(SnodeAPIRetrieve, 'retrieveNextMessagesNoRetries').resolves([
        { code: 200, namespace: SnodeNamespaces.ClosedGroupKeys, messages: { messages: fetched } },
      ] as any);
      return { hashesStub, keysStub, mergeStub, retrieveStub };
    }

    it('does nothing when we already hold bytes for every active keys hash', async () => {
      const { retrieveStub } = stubBackfill({ retained: { [KEYS_HASH]: new Uint8Array([1]) } });

      await ConfigRecovery.backfillGroupKeysIfNeeded(groupPk);

      expect(retrieveStub.called, 'no fetch when there is nothing to capture').to.be.false;
      expect(ConfigRecovery.keysBackfillHasFailedFor(groupPk)).to.be.false;
    });

    it('fetches the keys namespace with NO last_hash and merges what comes back', async () => {
      const { retrieveStub, mergeStub } = stubBackfill({
        fetched: [{ hash: KEYS_HASH, data: 'AQID', storedAt: 111 }],
        retainedAfterMerge: { [KEYS_HASH]: new Uint8Array([1]) },
      });

      await ConfigRecovery.backfillGroupKeysIfNeeded(groupPk);

      expect(retrieveStub.calledOnce, 'it fetched').to.be.true;
      const namespaces = retrieveStub.firstCall.args[2];
      expect(namespaces, 'the keys namespace, and only that').to.be.deep.eq([
        { lastHash: '', namespace: SnodeNamespaces.ClosedGroupKeys },
      ]);
      expect(mergeStub.calledOnce, 'and merged').to.be.true;
      expect(
        mergeStub.firstCall.args[1].groupKeys!.length,
        'the fetched keys message went into the merge'
      ).to.be.eq(1);
    });

    it('PERSISTS the dump — a merge that only captures in memory dies with the process', async () => {
      // iOS hit this: retention lives in the config dump, so bytes captured by a merge that never
      // persists are gone on restart. It passes every in-process assertion either way.
      //
      // On Desktop the hazard is worse: saveDumpsToDb is stubbed in this file's beforeEach for an
      // unrelated reason, so an implementation that never persists passes the whole suite silently.
      // Hence the PREMISE assertion first — without it "saveDumpsToDb was called" is also satisfied
      // by a path that exited before the merge.
      const { mergeStub } = stubBackfill({
        fetched: [{ hash: KEYS_HASH, data: 'AQID', storedAt: 111 }],
        retainedAfterMerge: { [KEYS_HASH]: new Uint8Array([1]) },
      });
      const saveStub = LibSessionUtil.saveDumpsToDb as unknown as Sinon.SinonStub;

      await ConfigRecovery.backfillGroupKeysIfNeeded(groupPk);

      expect(mergeStub.called, 'PREMISE: the merge ran at all').to.be.true;
      expect(saveStub.calledWith(groupPk), 'and the dump was persisted for this group').to.be.true;
    });

    it('records a failure when the fetch comes back EMPTY', async () => {
      stubBackfill({ fetched: [] });

      await ConfigRecovery.backfillGroupKeysIfNeeded(groupPk);

      expect(ConfigRecovery.keysBackfillHasFailedFor(groupPk)).to.be.true;
    });

    it('records a failure when messages ARRIVE but the bytes are still absent', async () => {
      // The one that separates "attempted and still absent" from "the fetch was empty". Both look
      // identical in any fixture where the swarm has nothing — which is the fixture above, and the
      // first one anyone writes. An implementation that only records the empty case passes that one
      // and fails this, and without this test it would refetch the same useless messages forever.
      const { mergeStub } = stubBackfill({
        fetched: [{ hash: 'someotherhash', data: 'AQID', storedAt: 111 }],
        retained: {},
        retainedAfterMerge: {}, // merged something, still hold no bytes for KEYS_HASH
      });

      await ConfigRecovery.backfillGroupKeysIfNeeded(groupPk);

      expect(mergeStub.called, 'PREMISE: it got as far as merging').to.be.true;
      expect(
        ConfigRecovery.keysBackfillHasFailedFor(groupPk),
        'a merge that did not restore the bytes is still a failed attempt'
      ).to.be.true;
    });

    it('CLEARS the failure once the bytes are obtained', async () => {
      // The record is read as "this device cannot repair this group". A device that just retained
      // the bytes plainly can, so leaving it set would permanently misreport it to the rekey.
      stubBackfill({ fetched: [] });
      await ConfigRecovery.backfillGroupKeysIfNeeded(groupPk);
      expect(ConfigRecovery.keysBackfillHasFailedFor(groupPk), 'failed first').to.be.true;

      Sinon.restore();
      TestUtils.stubWindowLog();
      Sinon.stub(LibSessionUtil, 'saveDumpsToDb').resolves();
      ConfigRecovery.setNowForTesting(() => Date.now() + 2 * 60 * 60 * 1000);
      stubBackfill({ retained: { [KEYS_HASH]: new Uint8Array([1]) } });

      await ConfigRecovery.backfillGroupKeysIfNeeded(groupPk);

      expect(ConfigRecovery.keysBackfillHasFailedFor(groupPk), 'cleared once we hold them').to.be
        .false;
    });

    it('a THROW is not an attempt — no failure recorded', async () => {
      // We never learned whether the bytes are obtainable. Recording a failure would let the rekey
      // act on evidence we do not have.
      Sinon.stub(SnodePool, 'getSwarmFor').resolves([] as any);
      Sinon.stub(MetaGroupWrapperActions, 'activeHashesByConfig').resolves({
        groupInfo: [],
        groupMember: [],
        groupKeys: [KEYS_HASH],
      });
      Sinon.stub(MetaGroupWrapperActions, 'activeKeyMessages').resolves({});

      await ConfigRecovery.backfillGroupKeysIfNeeded(groupPk);

      expect(
        ConfigRecovery.keysBackfillHasFailedFor(groupPk),
        'an empty swarm tells us nothing about the bytes'
      ).to.be.false;
    });

    it('does not re-attempt within the bar', async () => {
      stubBackfill({ fetched: [] });
      await ConfigRecovery.backfillGroupKeysIfNeeded(groupPk);
      const { retrieveStub } = {
        retrieveStub: SnodeAPIRetrieve.retrieveNextMessagesNoRetries as unknown as Sinon.SinonStub,
      };
      expect(retrieveStub.callCount, 'first attempt fetched').to.be.eq(1);

      await ConfigRecovery.backfillGroupKeysIfNeeded(groupPk);

      expect(retrieveStub.callCount, 'the second is barred, not retried').to.be.eq(1);
    });
  });

  it('a KICKED group is not re-stored', async () => {
    stubGroup({ kicked: true });
    detectMissing([INFO_HASH]);
    ConfigRecovery.markLocalStateLevelWithSwarm(groupPk);

    const ran = await ConfigRecovery.recoverIfNeeded(groupPk);

    expect(ran).to.be.false;
    expect(sendStub.called, 'we are not entitled to write to this swarm any more').to.be.false;
  });

  it('a DESTROYED group is not re-stored — kicked is FALSE in that case', async () => {
    // Deliberately separate from the kicked test. libsession sets kicked=false when a group was
    // destroyed, so an implementation checking only `kicked` passes the test above and fails here.
    stubGroup({ kicked: false, destroyed: true });
    detectMissing([INFO_HASH]);
    ConfigRecovery.markLocalStateLevelWithSwarm(groupPk);

    const ran = await ConfigRecovery.recoverIfNeeded(groupPk);

    expect(ran).to.be.false;
    expect(sendStub.called).to.be.false;
  });

  it('a group with pending changes is not re-stored', async () => {
    stubGroup({ needsPush: true });
    detectMissing([INFO_HASH]);
    ConfigRecovery.markLocalStateLevelWithSwarm(groupPk);

    const ran = await ConfigRecovery.recoverIfNeeded(groupPk);

    expect(ran).to.be.false;
    expect(sendStub.called, 'GroupSync will push it under a new hash anyway').to.be.false;
  });

  it('a group swarm not level with local state is not recovered', async () => {
    stubGroup();
    detectMissing([INFO_HASH]);
    // deliberately NOT marking level

    const ran = await ConfigRecovery.recoverIfNeeded(groupPk);

    expect(ran).to.be.false;
    expect(sendStub.called).to.be.false;
  });

  it('both sub-configs are re-stored when both claim a missing hash', async () => {
    stubGroup();
    detectMissing([INFO_HASH, MEMBER_HASH]);
    ConfigRecovery.markLocalStateLevelWithSwarm(groupPk);

    const ran = await ConfigRecovery.recoverIfNeeded(groupPk);

    expect(ran).to.be.true;
    expect(infoStoresSent().length).to.be.eq(1);
    expect(memberStoresSent().length).to.be.eq(1);
  });

  it('the in-flight guard: a second round for the same swarm while one is running is refused', async () => {
    // Without this, `void`-ing the call in the poller means the next poll starts a second round
    // over hashes the first has not settled yet — duplicate stores aimed at the swarm already
    // being repaired.
    stubGroup();
    detectMissing([INFO_HASH]);
    ConfigRecovery.markLocalStateLevelWithSwarm(groupPk);

    let releaseSend: () => void = () => {};
    const blocked = new Promise<void>(resolve => {
      releaseSend = resolve;
    });
    sendStub.callsFake(async ({ sortedSubRequests }: any) => {
      await blocked;
      return sortedSubRequests.map(() => ({ code: 200, body: { hash: 'newhash' } }));
    });

    const first = ConfigRecovery.recoverIfNeeded(groupPk);

    // Let the first round get as far as the send before starting the second. It awaits the wrapper
    // several times on the way, so without this the second call races it to an earlier await and
    // the assertion below would be measuring the wrong moment.
    const flush = () =>
      new Promise<void>(resolve => {
        setTimeout(resolve, 0);
      });
    while (!sendStub.called) {
      // eslint-disable-next-line no-await-in-loop
      await flush();
    }

    // the first round is now parked inside the send, so this one must be turned away
    const second = await ConfigRecovery.recoverIfNeeded(groupPk);

    expect(second, 'the overlapping round is refused').to.be.false;
    expect(sendStub.callCount, 'and it sent nothing — one round is in flight, not two').to.be.eq(1);

    releaseSend();
    expect(await first, 'the original round still completes normally').to.be.true;
  });

  it('the in-flight guard releases after a FAILING round, or the swarm is withdrawn forever', async () => {
    // The guard must clear on the failure path too. A marker that leaks there would be a permanent
    // exclusion of exactly the swarm that needs repairing.
    stubGroup();
    detectMissing([INFO_HASH]);
    ConfigRecovery.markLocalStateLevelWithSwarm(groupPk);
    sendStub.rejects(new Error('network gone'));

    expect(await ConfigRecovery.recoverIfNeeded(groupPk), 'first round fails').to.be.false;

    // same swarm, a later round must still be admitted
    sendStub.callsFake(async ({ sortedSubRequests }: any) =>
      sortedSubRequests.map(() => ({ code: 200, body: { hash: 'newhash' } }))
    );
    ConfigRecovery.setNowForTesting(() => Date.now() + 60 * 60 * 1000);
    detectMissing([INFO_HASH]);

    expect(
      await ConfigRecovery.recoverIfNeeded(groupPk),
      'the guard released, so the retry is admitted'
    ).to.be.true;
  });
});
