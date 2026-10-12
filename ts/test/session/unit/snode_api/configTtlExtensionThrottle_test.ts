import chai from 'chai';
import { afterEach, beforeEach, describe } from 'mocha';
import Sinon from 'sinon';

import { GroupPubkeyType, PubkeyType, UserGroupsGet } from 'libsession_util_nodejs';
import { Snode } from '../../../../data/types';
import { BatchRequests } from '../../../../session/apis/snode_api/batchRequest';
import { ConfigTtlExtensionThrottle } from '../../../../session/apis/snode_api/configTtlExtensionThrottle';
import { SnodeNamespaces } from '../../../../session/apis/snode_api/namespaces';
import { SnodeAPIRetrieve } from '../../../../session/apis/snode_api/retrieveRequest';
import { DURATION } from '../../../../session/constants';
import { TestUtils } from '../../../test-utils';
import { generateFakeSnodes, stubLibSessionWorker } from '../../../test-utils/utils';

const { expect } = chai;

describe('ConfigTtlExtensionThrottle via retrieveNextMessagesNoRetries', () => {
  let us: PubkeyType;
  let group: GroupPubkeyType;
  let otherGroup: GroupPubkeyType;
  let snode: Snode;
  let clock: Sinon.SinonFakeTimers;
  let sentBatches: Array<Array<{ method: string }>>;
  let expireResultCode: number;

  const extensionsSent = () =>
    sentBatches.filter(batch => batch.some(request => request.method === 'expire')).length;

  const poll = async (swarm: string) =>
    SnodeAPIRetrieve.retrieveNextMessagesNoRetries(
      snode,
      swarm,
      [
        {
          lastHash: null,
          namespace: swarm === us ? SnodeNamespaces.UserProfile : SnodeNamespaces.ClosedGroupInfo,
        },
      ],
      us,
      ['confighash1', 'confighash2'],
      false
    );

  beforeEach(() => {
    TestUtils.stubWindowLog();
    stubLibSessionWorker({});
    TestUtils.stubUserGroupWrapper('getGroup', { whatever: '' } as any as UserGroupsGet);
    ConfigTtlExtensionThrottle.resetForTesting();
    clock = Sinon.useFakeTimers({ now: Date.now(), shouldAdvanceTime: false });

    us = TestUtils.generateFakePubKeyStr();
    group = TestUtils.generateFakeClosedGroupV2PkStr();
    otherGroup = TestUtils.generateFakeClosedGroupV2PkStr();
    snode = generateFakeSnodes(1)[0];
    sentBatches = [];
    expireResultCode = 200;

    Sinon.stub(BatchRequests, 'doUnsignedSnodeBatchRequestNoRetries').callsFake(
      async ({ unsignedSubRequests }) => {
        const requests = unsignedSubRequests as Array<{ method: string }>;
        sentBatches.push(requests);
        return requests.map(request =>
          request.method === 'expire'
            ? { code: expireResultCode, body: {} }
            : { code: 200, body: { messages: [], more: false } }
        ) as any;
      }
    );
  });

  afterEach(() => {
    clock.restore();
    Sinon.restore();
  });

  it('sends one extension for two polls inside the cooldown', async () => {
    await poll(us);
    clock.tick(30 * DURATION.MINUTES);
    await poll(us);

    expect(sentBatches.length).to.be.eq(2);
    expect(extensionsSent()).to.be.eq(1);
  });

  it('sends another extension once the cooldown has passed', async () => {
    await poll(us);
    clock.tick(ConfigTtlExtensionThrottle.COOLDOWN_MS - 1);
    await poll(us);
    clock.tick(1);
    await poll(us);

    expect(sentBatches.length).to.be.eq(3);
    expect(extensionsSent()).to.be.eq(2);
  });

  it('does not start the cooldown when the extension fails', async () => {
    expireResultCode = 500;
    await poll(us);
    clock.tick(DURATION.SECONDS);
    await poll(us);
    expect(extensionsSent()).to.be.eq(2);

    // Positive control: once one succeeds the next poll is throttled, so the retries above are
    // retries rather than a throttle that never engages.
    expireResultCode = 200;
    await poll(us);
    await poll(us);
    expect(extensionsSent()).to.be.eq(3);
  });

  it('does not start the cooldown when the whole request fails', async () => {
    (BatchRequests.doUnsignedSnodeBatchRequestNoRetries as Sinon.SinonStub)
      .onFirstCall()
      .rejects(new Error('snode unreachable'));

    let threw = false;
    try {
      await poll(us);
    } catch {
      threw = true;
    }
    expect(threw).to.be.eq(true);

    await poll(us);
    expect(extensionsSent()).to.be.eq(1);
  });

  it('does not hold the cooldown open when the clock moves backwards', async () => {
    await poll(us);
    clock.setSystemTime(Date.now() - DURATION.DAYS);
    await poll(us);

    expect(extensionsSent()).to.be.eq(2);
  });

  it('tracks the cooldown per swarm', async () => {
    await poll(group);
    await poll(otherGroup);
    await poll(us);
    await poll(group);

    expect(sentBatches.length).to.be.eq(4);
    expect(extensionsSent()).to.be.eq(3);
  });
});
