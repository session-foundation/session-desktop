import chai from 'chai';
import { describe } from 'mocha';
import Sinon from 'sinon';
import { PubkeyType } from 'libsession_util_nodejs';

import { ConversationTypeEnum } from '../../../../models/types';
import { Convo } from '../../../../models/conversation';
import { getSwarmPollingInstance } from '../../../../session/apis/snode_api';
import { SnodeAPIRetrieve } from '../../../../session/apis/snode_api/retrieveRequest';
import { SnodePool } from '../../../../session/apis/snode_api/snodePool';
import { SwarmPollingUserConfig } from '../../../../session/apis/snode_api/swarm_polling_config/SwarmPollingUserConfig';
import { SwarmPolling } from '../../../../session/apis/snode_api/swarmPolling';
import { ConfigRecovery } from '../../../../session/apis/snode_api/configRecovery';
import { ConvoHub } from '../../../../session/conversations';
import { UserUtils } from '../../../../session/utils';
import { UserSync } from '../../../../session/utils/job_runners/jobs/UserSyncJob';
import { LibSessionUtil } from '../../../../session/utils/libsession/libsession_utils';
import { MessageSender } from '../../../../session/sending/MessageSender';
import {
  ContactsWrapperActions,
  UserGenericWrapperActions,
} from '../../../../webworker/workers/browser/libsession_worker_interface';
import { SnodeNamespaces } from '../../../../session/apis/snode_api/namespaces';
import { TestUtils } from '../../../test-utils';
import { generateFakeSnodes, stubData } from '../../../test-utils/utils';
import { ReduxOnionSelectors } from '../../../../state/selectors/onions';

const { expect } = chai;

/**
 * V22 — the vector that has to go through the POLLING PATH rather than through
 * ConfigRecovery directly.
 *
 * A device whose config has expired gets nothing back when it polls, because there is nothing left
 * on the swarm to return. Guard §4.1 originally read "a successful poll *and merge*", and taken
 * literally that means recovery can never run for exactly those devices — and it fails silently:
 * detection runs, the guard declines, no error and no failing test.
 *
 * A unit test against ConfigRecovery cannot catch that, because supplying the precondition in
 * setup is what hides it. So this one drives `pollOnceForKey` with an empty swarm and asserts the
 * re-store actually goes out. Asserting that recovery is skipped here is a FAIL, not a pass.
 */
describe('SwarmPolling: config recovery on an empty poll (V22)', () => {
  const ourPubkey = TestUtils.generateFakePubKey();
  const ourNumber = ourPubkey.key as PubkeyType;
  const missingHash = 'expiredhash1';

  let swarmPolling: SwarmPolling;
  let sendStub: Sinon.SinonStub;
  let retrieveStub: Sinon.SinonStub;

  beforeEach(async () => {
    // Note: these come first because they create `global.window` if it is missing, and
    // ConvoHub.reset() reads it. Other swarm-polling suites get away with the opposite order only
    // because an earlier test file happened to create it.
    TestUtils.stubWindowFeatureFlags();
    TestUtils.stubWindowLog();
    ConvoHub.use().reset();
    ConfigRecovery.resetForTesting();
    Sinon.stub(UserSync, 'queueNewJobIfNeeded').resolves();
    Sinon.stub(UserUtils, 'getOurPubKeyStrFromCache').returns(ourNumber);
    Sinon.stub(UserUtils, 'isUsFromCache').callsFake(pk => pk === ourNumber);
    // a poll that gets past the early return goes on to decrypt, which needs our keypair
    Sinon.stub(UserUtils, 'getUserED25519KeyPairBytes').resolves({
      pubKeyBytes: new Uint8Array(32),
      privKeyBytes: new Uint8Array(64),
    });

    stubData('getAllConversations').resolves([]);
    TestUtils.stubData('getItemById');
    stubData('saveConversation').resolves();
    stubData('getSwarmNodesForPubkey').resolves();
    stubData('getLastHashBySnode').resolves();
    // needed as soon as a poll actually returns a message: pollNodeForKey records its last hash,
    // and an unstubbed failure there makes pollNodeForKey return null — which would make the
    // negative vectors below pass for entirely the wrong reason.
    stubData('updateLastHash').resolves();
    stubData('createOrUpdateItem').resolves();
    Sinon.stub(Convo, 'commitConversationAndRefreshWrapper').resolves();

    TestUtils.stubLibSessionWorker(undefined);
    // needed once a poll gets past the early-return branch: pollOnceForKey then reaches
    // shouldLeaveNotPolledGroup, which reads the user-groups wrapper.
    TestUtils.stubUserGroupWrapper('getAllGroups', []);
    TestUtils.stubUserGroupWrapper('getAllLegacyGroups', []);
    Sinon.stub(SnodePool, 'getSwarmFor').resolves(generateFakeSnodes(5));
    Sinon.stub(ReduxOnionSelectors, 'isOnlineOutsideRedux').returns(true);
    TestUtils.stubWindow('inboxStore', undefined);
    TestUtils.stubWindow('isOnline', true);

    // the swarm has nothing for us — this is what an expired-config device sees on every poll
    retrieveStub = Sinon.stub(SnodeAPIRetrieve, 'retrieveNextMessagesNoRetries').resolves([]);

    // a clean local config that still believes it owns the hash the swarm has lost
    Sinon.stub(UserGenericWrapperActions, 'needsPush').resolves(false);
    Sinon.stub(UserGenericWrapperActions, 'activeHashes').callsFake(async variant =>
      variant === 'ContactsConfig' ? [missingHash] : []
    );
    Sinon.stub(UserGenericWrapperActions, 'push').resolves({
      data: [new Uint8Array([1, 2, 3])],
      seqno: 7,
      hashes: [],
      namespace: SnodeNamespaces.UserContacts,
    });
    Sinon.stub(LibSessionUtil, 'saveDumpsToDb').resolves();

    sendStub = Sinon.stub(MessageSender, 'sendEncryptedDataToSnode').callsFake(
      async ({ sortedSubRequests }: any) =>
        sortedSubRequests.map(() => ({ code: 200, body: { hash: 'newhash' } })) as any
    );

    const convoController = ConvoHub.use();
    await convoController.load();
    ConvoHub.use().getOrCreate(ourPubkey.key, ConversationTypeEnum.PRIVATE);

    swarmPolling = getSwarmPollingInstance();
    swarmPolling.resetSwarmPolling();
  });

  afterEach(() => {
    ConvoHub.use().reset();
    ConfigRecovery.resetForTesting();
    Sinon.restore();
  });

  it('V22: re-stores after a successful poll that returned NO config messages', async () => {
    ConfigRecovery.recordDetection(ourNumber, {
      status: 'conclusive',
      missingHashes: [missingHash],
    });

    await swarmPolling.pollOnceForKey([ourNumber, ConversationTypeEnum.PRIVATE]);

    expect(
      ConfigRecovery.localStateIsLevelWithSwarm(ourNumber),
      'an empty poll leaves us level with the swarm — there is nothing unmerged out there'
    ).to.be.true;
    expect(
      sendStub.called,
      'recovery MUST run here; asserting it is skipped would encode the bug this vector exists for'
    ).to.be.true;
  });

  it('V22a: an all-snodes-failed poll does NOT satisfy the guard, despite looking identical', async () => {
    // The trap: a failed poll and an empty swarm both arrive as an empty result set, so keying off
    // emptiness would treat "we couldn't reach anyone" as "there is nothing out there" and re-store
    // against a swarm we never actually read.
    retrieveStub.rejects(new Error('every snode timed out'));

    ConfigRecovery.recordDetection(ourNumber, {
      status: 'conclusive',
      missingHashes: [missingHash],
    });

    await swarmPolling.pollOnceForKey([ourNumber, ConversationTypeEnum.PRIVATE]);

    expect(retrieveStub.called, 'the poll must actually have been attempted').to.be.true;
    expect(
      ConfigRecovery.localStateIsLevelWithSwarm(ourNumber),
      'no snode answered, so we know nothing about the swarm'
    ).to.be.false;
    expect(sendStub.called, 'a failed poll must not license a re-store').to.be.false;
  });

  it('V22b: one config namespace failing does NOT satisfy the guard, even though others answered', async () => {
    // A half-fix that checks "some namespace answered" passes V22 and V22a and fails only here.
    // With one config namespace erroring we do not know the swarm state for the configs in it, so
    // there is nothing level to act on.
    retrieveStub.resolves([
      { code: 200, messages: { messages: [] }, namespace: SnodeNamespaces.UserProfile },
      { code: 500, messages: { messages: [] }, namespace: SnodeNamespaces.UserContacts },
      { code: 200, messages: { messages: [] }, namespace: SnodeNamespaces.Default },
    ] as any);

    ConfigRecovery.recordDetection(ourNumber, {
      status: 'conclusive',
      missingHashes: [missingHash],
    });

    await swarmPolling.pollOnceForKey([ourNumber, ConversationTypeEnum.PRIVATE]);

    expect(retrieveStub.called, 'the poll must actually have been attempted').to.be.true;
    expect(
      ConfigRecovery.localStateIsLevelWithSwarm(ourNumber),
      'a partial answer is not a full one'
    ).to.be.false;
    expect(sendStub.called, 'must not re-store on incomplete knowledge of the swarm').to.be.false;
  });

  it('V22 (realistic shape): an empty swarm answers per namespace, and still recovers', async () => {
    // The production shape of "the swarm has nothing": every namespace answers 200 with an empty
    // message list, rather than the whole result being absent. Worth asserting separately because
    // it takes a different branch of pollOnceForKey from the bare-empty case above.
    retrieveStub.resolves([
      { code: 200, messages: { messages: [] }, namespace: SnodeNamespaces.UserProfile },
      { code: 200, messages: { messages: [] }, namespace: SnodeNamespaces.UserContacts },
      { code: 200, messages: { messages: [] }, namespace: SnodeNamespaces.Default },
    ] as any);

    ConfigRecovery.recordDetection(ourNumber, {
      status: 'conclusive',
      missingHashes: [missingHash],
    });

    await swarmPolling.pollOnceForKey([ourNumber, ConversationTypeEnum.PRIVATE]);

    expect(ConfigRecovery.localStateIsLevelWithSwarm(ourNumber)).to.be.true;
    expect(sendStub.called, 'this is the real expired-device path — it MUST recover').to.be.true;
  });

  it('V22c: a swallowed MERGE failure does NOT satisfy the guard, though the fetch succeeded', async () => {
    // The merge deliberately swallows and only logs, so its failure is neither a value nor an
    // exception. If the marker is reached anyway we assert "level with the swarm" over a config we
    // just failed to take in — and on Desktop that pairs with recovery to re-store stale state.
    retrieveStub.resolves([
      {
        code: 200,
        messages: { messages: [{ hash: 'h1', expiration: 1, data: 'x', timestamp: 1 }] },
        namespace: SnodeNamespaces.UserContacts,
      },
    ] as any);
    const mergeHandler = Sinon.stub(
      SwarmPollingUserConfig,
      'handleUserSharedConfigMessages'
    ).resolves(false);

    ConfigRecovery.recordDetection(ourNumber, {
      status: 'conclusive',
      missingHashes: [missingHash],
    });

    await swarmPolling.pollOnceForKey([ourNumber, ConversationTypeEnum.PRIVATE]);

    // Proves the path reached the decision rather than dying earlier. Without this the assertion
    // below passes over a dead harness, because a poll that never ran also leaves us "not level" —
    // confirmed by deleting a setup stub and watching this test stay green.
    expect(mergeHandler.callCount, 'the merge must actually have been reached').to.be.eq(1);
    expect(
      ConfigRecovery.localStateIsLevelWithSwarm(ourNumber),
      'a fetch we could not merge leaves us behind the swarm, not level with it'
    ).to.be.false;
    expect(sendStub.called, 'must not re-store over a config we failed to merge').to.be.false;
  });

  it('V22c positive counterpart: the same path DOES recover when the merge succeeds', async () => {
    // Without this, V22c cannot tell "the guard worked" from "nothing ran" — a negative test
    // cannot validate its own harness.
    retrieveStub.resolves([
      {
        code: 200,
        messages: { messages: [{ hash: 'h1', expiration: 1, data: 'x', timestamp: 1 }] },
        namespace: SnodeNamespaces.UserContacts,
      },
    ] as any);
    Sinon.stub(SwarmPollingUserConfig, 'handleUserSharedConfigMessages').resolves(true);

    ConfigRecovery.recordDetection(ourNumber, {
      status: 'conclusive',
      missingHashes: [missingHash],
    });

    await swarmPolling.pollOnceForKey([ourNumber, ConversationTypeEnum.PRIVATE]);

    expect(ConfigRecovery.localStateIsLevelWithSwarm(ourNumber)).to.be.true;
    expect(sendStub.called, 'proves the path in V22c actually runs').to.be.true;
  });

  it('V22c (lossy): a merge that took in 1 of 2 does NOT satisfy the guard, despite reporting success', async () => {
    // libSession skips what it cannot merge and carries on — correct, and it means a partial merge
    // raises no error. The only way to see it is to compare what came back against what went in.
    const twoMessages = [
      { hash: 'h1', expiration: 1, data: 'a', timestamp: 1, storedAt: 1 },
      { hash: 'h2', expiration: 1, data: 'b', timestamp: 2, storedAt: 2 },
    ];
    retrieveStub.resolves([
      {
        code: 200,
        messages: { messages: twoMessages },
        namespace: SnodeNamespaces.UserContacts,
      },
    ] as any);

    // exactly one of the two merges. Asserting "fewer than 2" would also pass if BOTH failed,
    // which is a different case and not the one this vector is about.
    const mergeStub = Sinon.stub(ContactsWrapperActions, 'merge').resolves(['h1']);

    ConfigRecovery.recordDetection(ourNumber, {
      status: 'conclusive',
      missingHashes: [missingHash],
    });

    await swarmPolling.pollOnceForKey([ourNumber, ConversationTypeEnum.PRIVATE]);

    expect(mergeStub.callCount, 'the merge must actually have been reached').to.be.eq(1);
    expect(
      mergeStub.firstCall.args[0].length,
      'the fixture must really be the partial case: 2 handed in'
    ).to.be.eq(2);
    expect(
      ConfigRecovery.localStateIsLevelWithSwarm(ourNumber),
      '1 of 2 merged is not "we took in what we fetched"'
    ).to.be.false;
    expect(sendStub.called, 'must not re-store having only partly caught up').to.be.false;
  });

  it('V22c (lossy) positive counterpart: merging BOTH does satisfy the guard', async () => {
    const twoMessages = [
      { hash: 'h1', expiration: 1, data: 'a', timestamp: 1, storedAt: 1 },
      { hash: 'h2', expiration: 1, data: 'b', timestamp: 2, storedAt: 2 },
    ];
    retrieveStub.resolves([
      {
        code: 200,
        messages: { messages: twoMessages },
        namespace: SnodeNamespaces.UserContacts,
      },
    ] as any);

    Sinon.stub(ContactsWrapperActions, 'merge').resolves(['h1', 'h2']);

    ConfigRecovery.recordDetection(ourNumber, {
      status: 'conclusive',
      missingHashes: [missingHash],
    });

    await swarmPolling.pollOnceForKey([ourNumber, ConversationTypeEnum.PRIVATE]);

    expect(ConfigRecovery.localStateIsLevelWithSwarm(ourNumber)).to.be.true;
    expect(sendStub.called, 'proves the partial case above is a real distinction').to.be.true;
  });

  it('V22d: a failed merge withdraws the swarm for the SESSION, not just for that poll', async () => {
    // The defeat this guards: lastHash advances when a message is FETCHED, before the merge is
    // attempted. So the message we failed to merge is never offered again, and poll N+1 comes back
    // empty — indistinguishable from a healthy empty swarm. Without a sticky verdict, the correct
    // refusal on poll N is undone by a poll that looks perfectly clean.
    retrieveStub.resolves([
      {
        code: 200,
        messages: { messages: [{ hash: 'h1', expiration: 1, data: 'x', timestamp: 1 }] },
        namespace: SnodeNamespaces.UserContacts,
      },
    ] as any);
    const mergeHandler = Sinon.stub(
      SwarmPollingUserConfig,
      'handleUserSharedConfigMessages'
    ).resolves(false);

    ConfigRecovery.recordDetection(ourNumber, {
      status: 'conclusive',
      missingHashes: [missingHash],
    });

    await swarmPolling.pollOnceForKey([ourNumber, ConversationTypeEnum.PRIVATE]);
    // Every other assertion in this test is satisfied by "nothing happened", so without this the
    // whole vector is a false green under any death that stops the poll early — found by reading
    // the SURVIVORS of a harness-death run rather than its failures.
    expect(mergeHandler.callCount, 'poll N must actually have reached the merge').to.be.eq(1);
    expect(ConfigRecovery.localStateIsLevelWithSwarm(ourNumber), 'poll N refuses').to.be.false;

    // poll N+1: the unmergeable message is behind the cursor, so the swarm has nothing for us and
    // there is now no error, no log and no state anywhere recording that anything was missed.
    retrieveStub.resolves([]);
    mergeHandler.resolves(true);

    await swarmPolling.pollOnceForKey([ourNumber, ConversationTypeEnum.PRIVATE]);

    expect(
      ConfigRecovery.localStateIsLevelWithSwarm(ourNumber),
      'a clean-looking later poll MUST NOT undo the earlier refusal'
    ).to.be.false;
    expect(sendStub.called, 'recovery stays withdrawn until the process restarts').to.be.false;
  });

  it('V22e: a failed FETCH does NOT stick — a later clean poll restores level', async () => {
    // Read as a pair with V22d, which pulls the opposite way. An incomplete MERGE is permanently
    // disqualifying because the cursor moved past what we could not take in; a failed FETCH loses
    // nothing, so withdrawing the swarm for the session over a network blip would be wrong.
    // Without this vector, "simplifying" the narrow scoping into an unconditional sticky passes
    // everything else in the suite.
    retrieveStub.rejects(new Error('every snode timed out'));

    ConfigRecovery.recordDetection(ourNumber, {
      status: 'conclusive',
      missingHashes: [missingHash],
    });

    await swarmPolling.pollOnceForKey([ourNumber, ConversationTypeEnum.PRIVATE]);
    expect(ConfigRecovery.localStateIsLevelWithSwarm(ourNumber), 'poll N failed').to.be.false;

    // the swarm comes back; nothing was lost, so this must recover
    retrieveStub.resolves([]);

    await swarmPolling.pollOnceForKey([ourNumber, ConversationTypeEnum.PRIVATE]);

    expect(
      ConfigRecovery.localStateIsLevelWithSwarm(ourNumber),
      'a transient fetch failure must not withdraw the swarm for the session'
    ).to.be.true;
    expect(sendStub.called, 'and recovery proceeds once we can see the swarm again').to.be.true;
  });

  it('V13f: a THROWING inspection must not fail the poll it rides on', async () => {
    // Recovery is a best-effort repair riding on the poll. If a throw escapes into pollOnceForKey it
    // fails the whole poll — no messages processed, no configs merged — and it recurs every poll,
    // because the condition that threw does not clear. That would make the repair destroy the
    // mechanism it depends on. libSession's push() throws for a config with no encryption keys,
    // and the inspection is the part that looks like a pure read, which is why it goes unwrapped.
    retrieveStub.resolves([
      {
        code: 200,
        messages: { messages: [{ hash: 'h1', expiration: 1, data: 'x', timestamp: 1 }] },
        namespace: SnodeNamespaces.UserContacts,
      },
    ] as any);
    const mergeHandler = Sinon.stub(
      SwarmPollingUserConfig,
      'handleUserSharedConfigMessages'
    ).resolves(true);

    (UserGenericWrapperActions.push as Sinon.SinonStub).rejects(
      new Error('Cannot push data without an encryption key!')
    );

    ConfigRecovery.recordDetection(ourNumber, {
      status: 'conclusive',
      missingHashes: [missingHash],
    });

    // the load-bearing half: the poll itself must complete
    await swarmPolling.pollOnceForKey([ourNumber, ConversationTypeEnum.PRIVATE]);

    expect(
      mergeHandler.callCount,
      'the poll did its real work — configs were still merged'
    ).to.be.eq(1);
    expect(
      ConfigRecovery.localStateIsLevelWithSwarm(ourNumber),
      'and the poll completed far enough to reach the §4.1 marker'
    ).to.be.true;

    // and the recovery half: nothing barred, nothing consumed, still retryable
    (UserGenericWrapperActions.push as Sinon.SinonStub).resolves({
      data: [new Uint8Array([1, 2, 3])],
      seqno: 7,
      hashes: [],
      namespace: SnodeNamespaces.UserContacts,
    });
    retrieveStub.resolves([]);

    await swarmPolling.pollOnceForKey([ourNumber, ConversationTypeEnum.PRIVATE]);

    expect(
      sendStub.called,
      'a thrown inspection consumed no backoff and barred nothing — the hash is still ours to fix'
    ).to.be.true;
  });

  it('being level is a precondition, not a trigger: nothing detected -> no re-store', async () => {
    await swarmPolling.pollOnceForKey([ourNumber, ConversationTypeEnum.PRIVATE]);

    expect(ConfigRecovery.localStateIsLevelWithSwarm(ourNumber)).to.be.true;
    expect(sendStub.called, 'being level is a precondition, not a trigger').to.be.false;
  });
});
