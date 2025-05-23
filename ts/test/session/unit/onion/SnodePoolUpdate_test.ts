import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { describe } from 'mocha';
import Sinon, * as sinon from 'sinon';

import { Onions } from '../../../../session/apis/snode_api';
import { TestUtils } from '../../../test-utils';

import { SeedNodeAPI } from '../../../../session/apis/seed_node_api';
import { SnodePool } from '../../../../session/apis/snode_api/snodePool';
import { Snode } from '../../../../data/types';

import * as OnionPaths from '../../../../session/onions/onionPath';
import {
  generateFakeSnodes,
  generateFakeSnodeWithEdKey,
  stubData,
} from '../../../test-utils/utils';

chai.use(chaiAsPromised as any);
chai.should();

const { expect } = chai;

const guard1ed = 'e3ec6fcc79e64c2af6a48a9865d4bf4b739ec7708d75f35acc3d478f9161534e';
const guard2ed = 'e3ec6fcc79e64c2af6a48a9865d4bf4b739ec7708d75f35acc3d478f91615349';
const guard3ed = 'e3ec6fcc79e64c2af6a48a9865d4bf4b739ec7708d75f35acc3d478f9161534a';

const fakeSnodePool: Array<Snode> = [
  ...generateFakeSnodes(12),
  generateFakeSnodeWithEdKey(guard1ed),
  generateFakeSnodeWithEdKey(guard2ed),
  generateFakeSnodeWithEdKey(guard3ed),
  ...generateFakeSnodes(3),
];

describe('OnionPaths', () => {
  describe('getSnodePoolFromDBOrFetchFromSeed', () => {
    let getSnodePoolFromDb: sinon.SinonStub;
    let fetchFromSeedWithRetriesAndWriteToDb: sinon.SinonStub;
    let fetchSnodePoolFromSeedNodeWithRetries: sinon.SinonStub;

    beforeEach(() => {
      // Utils Stubs
      OnionPaths.clearTestOnionPath();

      TestUtils.stubWindow('getSeedNodeList', () => ['seednode1']);
      TestUtils.stubWindowLog();

      Onions.resetSnodeFailureCount();
      OnionPaths.resetPathFailureCount();
      SnodePool.TEST_resetState();
    });

    afterEach(() => {
      Sinon.restore();
    });
    it('if the cached snode pool has at least 12 snodes, just return it without fetching from seed', async () => {
      getSnodePoolFromDb = stubData('getSnodePoolFromDb').resolves(fakeSnodePool);
      fetchFromSeedWithRetriesAndWriteToDb = Sinon.stub(
        SnodePool,
        'TEST_fetchFromSeedWithRetriesAndWriteToDb'
      );

      const fetched = await SnodePool.getSnodePoolFromDBOrFetchFromSeed();
      expect(getSnodePoolFromDb.callCount).to.be.eq(1);
      expect(fetchFromSeedWithRetriesAndWriteToDb.callCount).to.be.eq(0);

      expect(fetched).to.deep.equal(fakeSnodePool);
    });

    it('if the cached snode pool is 8 or less snodes, trigger a fetch from the seed nodes', async () => {
      const length8 = fakeSnodePool.slice(0, 8);
      expect(length8.length).to.eq(8);
      getSnodePoolFromDb = stubData('getSnodePoolFromDb').resolves(length8);

      stubData('updateSnodePoolOnDb').resolves();
      fetchFromSeedWithRetriesAndWriteToDb = Sinon.stub(
        SnodePool,
        'TEST_fetchFromSeedWithRetriesAndWriteToDb'
      ).callThrough();
      fetchSnodePoolFromSeedNodeWithRetries = Sinon.stub(
        SeedNodeAPI,
        'fetchSnodePoolFromSeedNodeWithRetries'
      ).resolves(fakeSnodePool);

      // run the command
      const fetched = await SnodePool.getSnodePoolFromDBOrFetchFromSeed();
      expect(getSnodePoolFromDb.callCount).to.be.eq(1);
      expect(
        fetchFromSeedWithRetriesAndWriteToDb.callCount,
        'fetchFromSeedWithRetriesAndWriteToDb eq 1'
      ).to.be.eq(1);
      expect(
        fetchSnodePoolFromSeedNodeWithRetries.callCount,
        'fetchSnodePoolFromSeedNodeWithRetries eq 1'
      ).to.be.eq(1);
      expect(fetched).to.deep.equal(fakeSnodePool);
    });
  });
});
