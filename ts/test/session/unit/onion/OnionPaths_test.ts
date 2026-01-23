import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import _, { cloneDeep, range } from 'lodash';
import { describe } from 'mocha';
import Sinon from 'sinon';

import * as SNodeAPI from '../../../../session/apis/snode_api';
import { TestUtils } from '../../../test-utils';

import { GuardNode, Snode } from '../../../../data/types';
import * as OnionPaths from '../../../../session/onions/onionPath';
import {
  generateFakeSnodeWithDetails,
  generateFakeSnodes,
  stubData,
} from '../../../test-utils/utils';
import { SeedNodeAPI } from '../../../../session/apis/seed_node_api';
import { ServiceNodesList } from '../../../../session/apis/snode_api/getServiceNodesList';
import { SnodePool } from '../../../../session/apis/snode_api/snodePool';

chai.use(chaiAsPromised as any);
chai.should();

const { expect } = chai;

describe('OnionPaths', () => {
  // Initialize new stubbed cache
  let oldOnionPaths: Array<Array<Snode>>;
  const guard1ed = 'e3ec6fcc79e64c2af6a48a9865d4bf4b739ec7708d75f35acc3d478f9161534e';
  const guard2ed = 'e3ec6fcc79e64c2af6a48a9865d4bf4b739ec7708d75f35acc3d478f91615349';
  const guard3ed = 'e3ec6fcc79e64c2af6a48a9865d4bf4b739ec7708d75f35acc3d478f9161534a';

  const fakeSnodePool: Array<Snode> = [
    ...generateFakeSnodes(12),
    generateFakeSnodeWithDetails({ ed25519Pubkey: guard1ed, ip: null }),
    generateFakeSnodeWithDetails({ ed25519Pubkey: guard2ed, ip: null }),
    generateFakeSnodeWithDetails({ ed25519Pubkey: guard3ed, ip: null }),
    ...generateFakeSnodes(9),
  ];

  const fakeGuardNodesEd25519 = [guard1ed, guard2ed, guard3ed];
  const fakeGuardNodes = fakeSnodePool.filter(m =>
    fakeGuardNodesEd25519.includes(m.pubkey_ed25519)
  );
  const fakeGuardNodesFromDB: Array<GuardNode> = fakeGuardNodesEd25519.map(ed25519PubKey => {
    return {
      ed25519PubKey,
    };
  });

  describe('dropSnodeFromPath', () => {
    beforeEach(async () => {
      // Utils Stubs
      OnionPaths.clearTestOnionPath();
      TestUtils.stubWindowLog();
      SNodeAPI.Onions.resetSnodeFailureCount();
      OnionPaths.resetPathFailureCount();

      Sinon.stub(OnionPaths, 'selectGuardNodes').resolves(fakeGuardNodes);
      Sinon.stub(ServiceNodesList, 'getSnodePoolFromSnode').resolves(fakeGuardNodes);
      stubData('getSnodePoolFromDb').resolves(fakeSnodePool);

      TestUtils.stubData('getGuardNodes').resolves(fakeGuardNodesFromDB);
      TestUtils.stubData('createOrUpdateItem').resolves();
      TestUtils.stubWindow('getSeedNodeList', () => ['seednode1']);

      Sinon.stub(SeedNodeAPI, 'fetchSnodePoolFromSeedNodeWithRetries').resolves(fakeSnodePool);
      await OnionPaths.getOnionPath({}); // this triggers a path rebuild
      // get a copy of what old ones look like

      oldOnionPaths = OnionPaths.getTestOnionPath();
      if (oldOnionPaths.length !== 3) {
        throw new Error(`onion path length not enough ${oldOnionPaths.length}`);
      }
    });

    afterEach(() => Sinon.restore());

    describe('with valid snode pool', () => {
      it('rebuilds after removing last snode on path', async () => {
        await OnionPaths.dropSnodeFromPath(oldOnionPaths[2][2].pubkey_ed25519, 'unit test');
        const newOnionPath = OnionPaths.getTestOnionPath();

        // only the last snode should have been updated
        expect(newOnionPath).to.be.not.deep.equal(oldOnionPaths);
        expect(newOnionPath[0]).to.be.deep.equal(oldOnionPaths[0]);
        expect(newOnionPath[1]).to.be.deep.equal(oldOnionPaths[1]);
        expect(newOnionPath[2][0]).to.be.deep.equal(oldOnionPaths[2][0]);
        expect(newOnionPath[2][1]).to.be.deep.equal(oldOnionPaths[2][1]);
        expect(newOnionPath[2][2]).to.be.not.deep.equal(oldOnionPaths[2][2]);
      });

      it('rebuilds after removing middle snode on path', async () => {
        // stubWindowLog();
        // stubWindow('sessionFeatureFlags', { debugOnionPaths: true, debugSnodePool: true });

        const oldOnionPathsCopy = cloneDeep(oldOnionPaths);

        await OnionPaths.dropSnodeFromPath(oldOnionPathsCopy[2][1].pubkey_ed25519, 'unit test');
        const newOnionPath = OnionPaths.getTestOnionPath();

        const oldOnionPath2 = oldOnionPathsCopy[2];
        const allEd25519KeysOldOnionPath2 = _.flattenDeep(oldOnionPath2).map(m => m.pubkey_ed25519);

        // only the last snode should have been updated
        expect(newOnionPath).to.be.not.deep.equal(oldOnionPathsCopy);
        expect(newOnionPath[0]).to.be.deep.equal(oldOnionPathsCopy[0]);
        expect(newOnionPath[1]).to.be.deep.equal(oldOnionPathsCopy[1]);
        expect(newOnionPath[2][0]).to.be.deep.equal(oldOnionPath2[0]);
        // last item moved to the position one as we removed item 1 and happened one after it
        expect(newOnionPath[2][1]).to.be.deep.equal(oldOnionPath2[2]);
        // the last item we appended must not be any of the new path nodes.
        // actually, we remove the nodes causing issues from the snode pool so we shouldn't find this one neither

        expect(allEd25519KeysOldOnionPath2).to.not.include(newOnionPath[2][2].pubkey_ed25519);
      });
    });
  });

  describe('getRandomEdgeSnode', () => {
    it('random if multiple matches', () => {
      const originalSnodePool = generateFakeSnodes(5);
      const winner = OnionPaths.getRandomEdgeSnode(originalSnodePool);
      expect(originalSnodePool).to.deep.include(winner);
    });
  });

  describe('pick edge snode with at least storage server v2.8.0', () => {
    let fetchSnodePoolFromSeedNodeWithRetries: Sinon.SinonStub;
    beforeEach(async () => {
      // Utils Stubs
      Sinon.stub(OnionPaths, 'selectGuardNodes').resolves(fakeGuardNodes);
      Sinon.stub(ServiceNodesList, 'getSnodePoolFromSnode').resolves(fakeGuardNodes);
      // we can consider that nothing is in the DB for those tests
      stubData('getSnodePoolFromDb').resolves([]);

      TestUtils.stubData('getGuardNodes').resolves(fakeGuardNodesFromDB);
      TestUtils.stubData('createOrUpdateItem').resolves();
      TestUtils.stubWindow('getSeedNodeList', () => ['seednode1']);

      TestUtils.stubWindowLog();
      SnodePool.resetState();

      fetchSnodePoolFromSeedNodeWithRetries = Sinon.stub(
        SeedNodeAPI,
        'fetchSnodePoolFromSeedNodeWithRetries'
      );
      SNodeAPI.Onions.resetSnodeFailureCount();
      OnionPaths.resetPathFailureCount();
      OnionPaths.clearTestOnionPath();
      Sinon.stub(OnionPaths, 'getOnionPathMinTimeout').returns(1);
    });

    afterEach(() => {
      Sinon.restore();
    });

    it('builds a path correctly if no issues with input', async () => {
      fetchSnodePoolFromSeedNodeWithRetries.resolves(generateFakeSnodes(20));
      const newOnionPath = await OnionPaths.getOnionPath({});
      expect(newOnionPath.length).to.eq(3);
    });

    it('throws if we cannot find a valid edge snode', async () => {
      const badPool = generateFakeSnodes(0).map(m => {
        return { ...m };
      });
      fetchSnodePoolFromSeedNodeWithRetries.reset();
      fetchSnodePoolFromSeedNodeWithRetries.resolves(badPool);

      if (OnionPaths.getTestOnionPath().length) {
        throw new Error('expected this to be empty');
      }

      try {
        await OnionPaths.getOnionPath({});

        throw new Error('fake error');
      } catch (e) {
        expect(e.message).to.not.be.eq('fake error');
      }
    });

    it('throws if we cannot find a node without an ip on the same subnet /24 of one of our path node', async () => {
      fetchSnodePoolFromSeedNodeWithRetries.reset();
      // stubWindow('sessionFeatureFlags', { debugOnionPaths: true, debugSnodePool: true });

      if (OnionPaths.getTestOnionPath().length) {
        throw new Error('expected this to be empty');
      }
      fetchSnodePoolFromSeedNodeWithRetries.resolves(fakeSnodePool);
      await OnionPaths.getOnionPath({});

      if (OnionPaths.getTestOnionPath().length !== 3) {
        throw new Error('should have 3 valid onion paths');
      }
      const paths = OnionPaths.getTestOnionPath();
      const snodeToDrop = paths[2][1];
      const otherSnodeInPathOfSnodeDropped = paths[2][2];
      const subnet = otherSnodeInPathOfSnodeDropped.ip.slice(
        0,
        otherSnodeInPathOfSnodeDropped.ip.lastIndexOf('.')
      );
      // make the snode pool filled with snodes that have the same subnet /24 as the first snode of the path where we dropped a snode.
      const badPool = generateFakeSnodes(20).map((m, i) => {
        return { ...m, ip: `${subnet}.${50 + i}` };
      });
      fetchSnodePoolFromSeedNodeWithRetries.resolves(badPool);
      SnodePool.resetState(badPool);
      // drop a snode from the last path, only allowing snodes with an ip on the same subnet /24 of one of our first node
      const func = async () =>
        OnionPaths.dropSnodeFromPath(snodeToDrop.pubkey_ed25519, 'unit test');
      await expect(func()).rejectedWith('Not enough snodes with snodes to exclude length');
    });
  });
});

describe('OnionPaths selection', () => {
  const guardsEd = TestUtils.generateFakePubKeysStr(3);

  const fakeSnodePool: Array<Snode> = [
    generateFakeSnodeWithDetails({ ed25519Pubkey: guardsEd[0], ip: '127.0.0.54' }),
    generateFakeSnodeWithDetails({ ed25519Pubkey: guardsEd[1], ip: '127.0.0.55' }),
    generateFakeSnodeWithDetails({ ed25519Pubkey: guardsEd[2], ip: '127.0.0.56' }),
    ...range(57, 77).map(lastDigit =>
      generateFakeSnodeWithDetails({ ed25519Pubkey: null, ip: `127.0.0.${lastDigit}` })
    ),
  ];

  const fakeGuardNodes = fakeSnodePool.filter(m => guardsEd.includes(m.pubkey_ed25519 as string));
  const fakeGuardNodesFromDB: Array<GuardNode> = guardsEd.map(ed25519PubKey => {
    return {
      ed25519PubKey,
    };
  });

  describe('filtering by subnet', () => {
    beforeEach(async () => {
      OnionPaths.clearTestOnionPath();
      SNodeAPI.Onions.resetSnodeFailureCount();
      OnionPaths.resetPathFailureCount();
      TestUtils.stubWindowLog();
      Sinon.stub(OnionPaths, 'getOnionPathMinTimeout').returns(1);

      Sinon.stub(OnionPaths, 'selectGuardNodes').resolves(fakeGuardNodes);
      Sinon.stub(ServiceNodesList, 'getSnodePoolFromSnode').resolves(fakeGuardNodes);
      stubData('getSnodePoolFromDb').resolves(fakeSnodePool);

      TestUtils.stubData('getGuardNodes').resolves(fakeGuardNodesFromDB);
      TestUtils.stubData('createOrUpdateItem').resolves();
      TestUtils.stubWindow('getSeedNodeList', () => ['seednode1']);

      Sinon.stub(SeedNodeAPI, 'fetchSnodePoolFromSeedNodeWithRetries').resolves(fakeSnodePool);
    });

    afterEach(() => {
      Sinon.restore();
    });

    it('throws if we cannot build a path filtering with /24 subnet', async () => {
      TestUtils.stubWindowLog();
      const onStartOnionPaths = OnionPaths.getTestOnionPath();
      expect(onStartOnionPaths.length).to.eq(0);

      // generate a new set of path, this should fail
      const func = () => OnionPaths.getOnionPath({});
      await expect(func()).to.be.rejectedWith(
        'Failed to build enough onion paths, current count: 0'
      );
    });
  });
});
