import chai from 'chai';
import { describe } from 'mocha';
import Sinon, * as sinon from 'sinon';

import chaiAsPromised from 'chai-as-promised';
import { getSwarmPollingInstance } from '../../../../session/apis/snode_api';
import { resetHardForkCachedValues } from '../../../../session/apis/snode_api/hfHandling';
import { SnodeAPIRetrieve } from '../../../../session/apis/snode_api/retrieveRequest';
import { SwarmPolling } from '../../../../session/apis/snode_api/swarmPolling';
import { SWARM_POLLING_TIMEOUT } from '../../../../session/constants';
import { PubKey } from '../../../../session/types';
import { UserUtils } from '../../../../session/utils';
import { UserSync } from '../../../../session/utils/job_runners/jobs/UserSyncJob';
import { TestUtils } from '../../../test-utils';
import { generateFakeSnodes, stubData } from '../../../test-utils/utils';
import { ConversationTypeEnum } from '../../../../models/types';
import { ConvoHub } from '../../../../session/conversations';
import { SnodePool } from '../../../../session/apis/snode_api/snodePool';
import { ReduxOnionSelectors } from '../../../../state/selectors/onions';

chai.use(chaiAsPromised as any);
chai.should();

const { expect } = chai;

describe('SwarmPolling', () => {
  // Initialize new stubbed cache
  const ourNumber = TestUtils.generateFakePubKeyStr();
  const ourPubkey = PubKey.cast(ourNumber);

  let swarmPolling: SwarmPolling;
  let clock: Sinon.SinonFakeTimers;
  beforeEach(async () => {
    ConvoHub.use().reset();
    TestUtils.stubWindowFeatureFlags();
    Sinon.stub(UserSync, 'queueNewJobIfNeeded').resolves();

    // Utils Stubs
    Sinon.stub(UserUtils, 'getOurPubKeyStrFromCache').returns(ourNumber);

    stubData('getAllConversations').resolves([]);
    stubData('saveConversation').resolves();
    stubData('getSwarmNodesForPubkey').resolves();
    stubData('getLastHashBySnode').resolves();

    Sinon.stub(SnodePool, 'getSwarmFor').resolves(generateFakeSnodes(5));
    Sinon.stub(SnodeAPIRetrieve, 'retrieveNextMessagesNoRetries').resolves([]);
    Sinon.stub(ReduxOnionSelectors, 'isOnlineOutsideRedux').returns(true);

    TestUtils.stubWindow('inboxStore', undefined);
    TestUtils.stubWindow('isOnline', true);
    TestUtils.stubWindowLog();

    const convoController = ConvoHub.use();
    await convoController.load();
    ConvoHub.use().getOrCreate(ourPubkey.key, ConversationTypeEnum.PRIVATE);

    swarmPolling = getSwarmPollingInstance();
    swarmPolling.resetSwarmPolling();

    clock = sinon.useFakeTimers({ now: Date.now(), shouldAdvanceTime: true });
  });

  afterEach(() => {
    Sinon.restore();
    ConvoHub.use().reset();
    clock.restore();
    resetHardForkCachedValues();
  });

  describe('getPollingTimeout', () => {
    beforeEach(() => {
      TestUtils.stubLibSessionWorker(undefined);
    });
    it('returns INACTIVE for non existing convo', () => {
      const fakeConvo = TestUtils.generateFakePubKey();

      expect(swarmPolling.getPollingTimeout(fakeConvo)).to.eq(SWARM_POLLING_TIMEOUT.INACTIVE);
    });

    describe('legacy groups', () => {
      it('returns ACTIVE for convo with less than two days old activeAt', () => {
        const convo = ConvoHub.use().getOrCreate(
          TestUtils.generateFakePubKeyStr(),
          ConversationTypeEnum.GROUP
        );
        convo.setKey('active_at', Date.now() - 2 * 23 * 3600 * 1000); // 23 * 2 = 46 hours old
        expect(swarmPolling.getPollingTimeout(PubKey.cast(convo.id))).to.eq(
          SWARM_POLLING_TIMEOUT.ACTIVE
        );
      });

      it('returns INACTIVE for convo with undefined activeAt', () => {
        const convo = ConvoHub.use().getOrCreate(
          TestUtils.generateFakePubKeyStr(),
          ConversationTypeEnum.GROUP
        );
        convo.setKey('active_at', undefined);
        expect(swarmPolling.getPollingTimeout(PubKey.cast(convo.id))).to.eq(
          SWARM_POLLING_TIMEOUT.INACTIVE
        );
      });

      it('returns MEDIUM_ACTIVE for convo with activeAt of more than 2 days but less than a week old', () => {
        const convo = ConvoHub.use().getOrCreate(
          TestUtils.generateFakePubKeyStr(),
          ConversationTypeEnum.GROUP
        );
        convo.setKey('active_at', Date.now() - 1000 * 3600 * 25 * 2); // 25 hours x 2 = 50 hours old
        expect(swarmPolling.getPollingTimeout(PubKey.cast(convo.id))).to.eq(
          SWARM_POLLING_TIMEOUT.MEDIUM_ACTIVE
        );

        convo.setKey('active_at', Date.now() - 1000 * 3600 * 24 * 7 + 3600); // a week minus an hour old
        expect(swarmPolling.getPollingTimeout(PubKey.cast(convo.id))).to.eq(
          SWARM_POLLING_TIMEOUT.MEDIUM_ACTIVE
        );
      });

      it('returns INACTIVE for convo with  activeAt of more than a week', () => {
        const convo = ConvoHub.use().getOrCreate(
          TestUtils.generateFakePubKeyStr(),
          ConversationTypeEnum.GROUP
        );
        convo.setKey('active_at', Date.now() - 1000 * 3600 * 24 * 8); // 8 days
        expect(swarmPolling.getPollingTimeout(PubKey.cast(convo.id))).to.eq(
          SWARM_POLLING_TIMEOUT.INACTIVE
        );
      });
    });

    describe('groupv2', () => {
      it('returns ACTIVE for convo with less than two days old activeAt', () => {
        const convo = ConvoHub.use().getOrCreate(
          TestUtils.generateFakeClosedGroupV2PkStr(),
          ConversationTypeEnum.GROUPV2
        );
        convo.setKey('active_at', Date.now() - 2 * 23 * 3600 * 1000); // 23 * 2 = 46 hours old
        expect(swarmPolling.getPollingTimeout(PubKey.cast(convo.id))).to.eq(
          SWARM_POLLING_TIMEOUT.ACTIVE
        );
      });

      it('returns INACTIVE for convo with undefined activeAt', () => {
        const convo = ConvoHub.use().getOrCreate(
          TestUtils.generateFakeClosedGroupV2PkStr(),
          ConversationTypeEnum.GROUPV2
        );
        convo.setKey('active_at', undefined);
        expect(swarmPolling.getPollingTimeout(PubKey.cast(convo.id))).to.eq(
          SWARM_POLLING_TIMEOUT.INACTIVE
        );
      });

      it('returns MEDIUM_ACTIVE for convo with activeAt of more than 2 days but less than a week old', () => {
        const convo = ConvoHub.use().getOrCreate(
          TestUtils.generateFakeClosedGroupV2PkStr(),
          ConversationTypeEnum.GROUPV2
        );
        convo.setKey('active_at', Date.now() - 1000 * 3600 * 25 * 2); // 25 hours x 2 = 50 hours old
        expect(swarmPolling.getPollingTimeout(PubKey.cast(convo.id))).to.eq(
          SWARM_POLLING_TIMEOUT.MEDIUM_ACTIVE
        );

        convo.setKey('active_at', Date.now() - 1000 * 3600 * 24 * 7 + 3600); // a week minus an hour old
        expect(swarmPolling.getPollingTimeout(PubKey.cast(convo.id))).to.eq(
          SWARM_POLLING_TIMEOUT.MEDIUM_ACTIVE
        );
      });

      it('returns INACTIVE for convo with  activeAt of more than a week', () => {
        const convo = ConvoHub.use().getOrCreate(
          TestUtils.generateFakeClosedGroupV2PkStr(),
          ConversationTypeEnum.GROUPV2
        );
        convo.setKey('active_at', Date.now() - 1000 * 3600 * 24 * 8); // 8 days
        expect(swarmPolling.getPollingTimeout(PubKey.cast(convo.id))).to.eq(
          SWARM_POLLING_TIMEOUT.INACTIVE
        );
      });
    });
  });
});
