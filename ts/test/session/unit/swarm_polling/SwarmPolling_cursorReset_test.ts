import chai from 'chai';
import { describe } from 'mocha';
import Sinon from 'sinon';

import { getSwarmPollingInstance } from '../../../../session/apis/snode_api';
import { SnodeAPIRetrieve } from '../../../../session/apis/snode_api/retrieveRequest';
import { SwarmPolling } from '../../../../session/apis/snode_api/swarmPolling';
import { SnodeNamespaces } from '../../../../session/apis/snode_api/namespaces';
import { SnodePool } from '../../../../session/apis/snode_api/snodePool';
import { PubKey } from '../../../../session/types';
import { UserUtils } from '../../../../session/utils';
import { UserSync } from '../../../../session/utils/job_runners/jobs/UserSyncJob';
import { ConvoHub } from '../../../../session/conversations';
import { ConversationTypeEnum } from '../../../../models/types';
import { ReduxOnionSelectors } from '../../../../state/selectors/onions';
import { TestUtils } from '../../../test-utils';
import { generateFakeSnodes, stubData } from '../../../test-utils/utils';

const { expect } = chai;

/**
 * A cursor reset that happens while a poll of the same swarm is in flight must not be undone by
 * that poll: once it completes, the next poll fetches from the beginning.
 *
 * Everything from pollOnceForKey down to the cursor write is production code. The retrieve is held
 * open so the reset can land inside the window, and answers the way the real one does: one result
 * per namespace asked about, in order.
 */
describe('SwarmPolling: a cursor reset during an in-flight poll', () => {
  const ourNumber = TestUtils.generateFakePubKeyStr();
  const newestHash = 'newesthash';

  let swarmPolling: SwarmPolling;
  let retrieveStub: Sinon.SinonStub;
  let updateLastHashStub: Sinon.SinonStub;
  /** what the database holds as our cursor; the reset clears it */
  let storedCursor: string | undefined;

  function answerWithNewMessage(
    _node: unknown,
    _pubkey: unknown,
    namespacesAndLastHashes: Array<{ namespace: SnodeNamespaces }>
  ) {
    return namespacesAndLastHashes.map(({ namespace }) => ({
      code: 200,
      namespace,
      messages: {
        messages:
          namespace === SnodeNamespaces.Default
            ? [{ hash: newestHash, data: 'AQID', timestamp: 1, expiration: Date.now() + 60_000 }]
            : [],
        more: false,
        t: 1,
      },
    })) as any;
  }

  /** a retrieve that does not answer until `release` is called */
  function holdRetrieveOpen() {
    let release: () => void = () => {};
    const released = new Promise<void>(resolve => {
      release = resolve;
    });
    retrieveStub.callsFake(async (...args: Parameters<typeof answerWithNewMessage>) => {
      await released;
      return answerWithNewMessage(...args);
    });
    return () => release();
  }

  async function untilRetrieveCalls(count: number) {
    while (retrieveStub.callCount < count) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise(resolve => {
        setImmediate(resolve);
      });
    }
  }

  /** the cursor the NEXT poll asks the Default namespace from */
  async function cursorTheNextPollUses() {
    retrieveStub.resetHistory();
    retrieveStub.callsFake(answerWithNewMessage);
    await swarmPolling.pollOnceForKey([ourNumber, ConversationTypeEnum.PRIVATE]);
    const asked = retrieveStub.firstCall.args[2] as Array<{ namespace: number; lastHash: string }>;
    return asked.find(n => n.namespace === SnodeNamespaces.Default)?.lastHash;
  }

  beforeEach(async () => {
    TestUtils.stubWindowFeatureFlags();
    TestUtils.stubWindowLog();
    ConvoHub.use().reset();
    Sinon.stub(UserSync, 'queueNewJobIfNeeded').resolves();
    Sinon.stub(UserUtils, 'getOurPubKeyStrFromCache').returns(ourNumber);
    // read by pollOnceForKey once a poll returns messages
    Sinon.stub(UserUtils, 'getUserED25519KeyPairBytes').resolves({
      pubKeyBytes: new Uint8Array(32),
      privKeyBytes: new Uint8Array(64),
    });
    TestUtils.stubLibSessionWorker(undefined);
    TestUtils.stubUserGroupWrapper('getAllGroups', []);
    TestUtils.stubUserGroupWrapper('getAllLegacyGroups', []);

    stubData('getAllConversations').resolves([]);
    stubData('saveConversation').resolves();
    stubData('getSwarmNodesForPubkey').resolves();
    storedCursor = undefined;
    stubData('getLastHashBySnode').callsFake(async () => storedCursor);
    stubData('clearLastHashesForConvoId').callsFake(async () => {
      storedCursor = undefined;
    });
    updateLastHashStub = stubData('updateLastHash').callsFake(async ({ hash }: any) => {
      storedCursor = hash;
    });
    // everything fetched is already seen, so nothing past the cursor write is exercised
    stubData('getSeenMessagesByHashList').callsFake(async (hashes: Array<string>) => hashes);

    Sinon.stub(SnodePool, 'getSwarmFor').resolves(generateFakeSnodes(5));
    Sinon.stub(ReduxOnionSelectors, 'isOnlineOutsideRedux').returns(true);
    TestUtils.stubWindow('inboxStore', undefined);
    TestUtils.stubWindow('isOnline', true);
    retrieveStub = Sinon.stub(SnodeAPIRetrieve, 'retrieveNextMessagesNoRetries');

    await ConvoHub.use().load();
    ConvoHub.use().getOrCreate(PubKey.cast(ourNumber).key, ConversationTypeEnum.PRIVATE);

    swarmPolling = getSwarmPollingInstance();
    swarmPolling.resetSwarmPolling();
    // the cursor cache lives on the shared instance, so start every test without one
    await swarmPolling.resetLastHashesForConversation(ourNumber);
  });

  afterEach(() => {
    ConvoHub.use().reset();
    Sinon.restore();
  });

  it('control: with no reset, the poll writes its newest hash as the cursor', async () => {
    retrieveStub.callsFake(answerWithNewMessage);

    await swarmPolling.pollOnceForKey([ourNumber, ConversationTypeEnum.PRIVATE]);

    expect(updateLastHashStub.calledWithMatch({ hash: newestHash })).to.be.true;
    expect(await cursorTheNextPollUses()).to.be.eq(newestHash);
  });

  it('a reset of a cursor that was already EMPTY is not undone', async () => {
    // The case a before/after comparison of the cursor values cannot see: both read empty.
    const release = holdRetrieveOpen();
    const poll = swarmPolling.pollOnceForKey([ourNumber, ConversationTypeEnum.PRIVATE]);
    await untilRetrieveCalls(2);

    await swarmPolling.resetLastHashesForConversation(ourNumber);
    release();
    await poll;

    expect(updateLastHashStub.called, 'the in-flight poll wrote no cursor').to.be.false;
    expect(await cursorTheNextPollUses(), 'the next poll starts from the beginning').to.be.eq('');
  });

  it('a reset of a cursor that was SET is not undone', async () => {
    storedCursor = 'oldhash';
    const release = holdRetrieveOpen();
    const poll = swarmPolling.pollOnceForKey([ourNumber, ConversationTypeEnum.PRIVATE]);
    await untilRetrieveCalls(2);
    expect(
      (retrieveStub.firstCall.args[2] as Array<{ lastHash: string }>).some(
        n => n.lastHash === 'oldhash'
      ),
      'PREMISE: the in-flight poll asked from the old cursor'
    ).to.be.true;

    await swarmPolling.resetLastHashesForConversation(ourNumber);
    release();
    await poll;

    expect(updateLastHashStub.called).to.be.false;
    expect(await cursorTheNextPollUses()).to.be.eq('');
  });

  it('a reset that lands while the cursor write is in progress is not undone', async () => {
    retrieveStub.callsFake(answerWithNewMessage);
    let reset: Promise<void> | undefined;
    updateLastHashStub.callsFake(async ({ hash }: any) => {
      storedCursor = hash;
      reset ??= swarmPolling.resetLastHashesForConversation(ourNumber);
      await reset;
    });

    await swarmPolling.pollOnceForKey([ourNumber, ConversationTypeEnum.PRIVATE]);

    expect(reset, 'PREMISE: the reset happened inside the write').to.not.be.eq(undefined);
    updateLastHashStub.callsFake(async ({ hash }: any) => {
      storedCursor = hash;
    });
    expect(await cursorTheNextPollUses(), 'the cached cursor was not written back').to.be.eq('');
  });
});
