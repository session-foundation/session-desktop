import Sinon from 'sinon';
import { expect } from 'chai';

import { TestUtils } from '../../../test-utils';
import { ProRevocationCache } from '../../../../session/revocation_list/pro_revocation_list';
import type { Storage } from '../../../../util/storage';
import { DURATION } from '../../../../session/constants';

const validItemEffective = {
  effective_unix_ts_ms: Date.now() - 2 * DURATION.DAYS, // this one is effective already
  expiry_unix_ts_ms: Date.now() + 2 * DURATION.DAYS, // and not expired
  gen_index_hash_b64: 'QJGEFg4+FQkDzqeoWW5ghObbGB0IR/TTs4ve1MHzL9I=',
};
const validItemDelayed = {
  effective_unix_ts_ms: Date.now() + 2 * DURATION.DAYS, // this one is delayed (not effective yet)
  expiry_unix_ts_ms: Date.now() + 6 * DURATION.DAYS, // and not expired
  gen_index_hash_b64: 'b2ArHxhrhbSrV6/aVqOF5RYG55l74doHcB935pZyFxo=',
};
const validItemExpired = {
  effective_unix_ts_ms: Date.now() - 6 * DURATION.DAYS, // this one is effective
  expiry_unix_ts_ms: Date.now() - 2 * DURATION.DAYS, // and expired
  gen_index_hash_b64: 'dfL3b6/G//0jNGOZDwOGVY4CWUOjoNkoR5tDTGeJtI4=',
};

// loadFromDbIfNeeded makes a few setup calls to get/put/remove, so we need to reset them
function resetHistories(...stubs: Array<Sinon.SinonStub<any>>) {
  stubs.forEach(stub => {
    stub.resetHistory();
  });
}

describe('ProRevocationCache', () => {
  let put: Sinon.SinonStub<Parameters<(typeof Storage)['put']>>;
  let get: Sinon.SinonStub<Parameters<(typeof Storage)['get']>>;

  beforeEach(() => {
    TestUtils.stubWindowLog();
    put = TestUtils.stubStorage('put');
    get = TestUtils.stubStorage('get');
  });

  afterEach(() => {
    Sinon.restore();
    ProRevocationCache.clear();
  });

  describe('getListItems', () => {
    it('can get from a fresh DB with 0 entries', async () => {
      put.resolves();
      get.returns([]);
      await ProRevocationCache.loadFromDbIfNeeded();
      resetHistories(put, get);

      const items = await ProRevocationCache.getListItems();
      expect(items).to.be.deep.equal([]);
      expect(put.callCount).to.eq(0);
      expect(get.callCount).to.eq(0);
    });

    it('can get from a fresh DB with null', async () => {
      put.resolves();
      get.returns(null);
      await ProRevocationCache.loadFromDbIfNeeded();
      resetHistories(put, get);

      const items = await ProRevocationCache.getListItems();
      expect(items).to.be.deep.equal([]);
      expect(put.callCount).to.eq(0);
      expect(get.callCount).to.eq(0);
    });

    it('can get from a fresh DB with existing entries', async () => {
      put.resolves();
      get.returns(JSON.stringify([validItemEffective, validItemDelayed]));
      await ProRevocationCache.loadFromDbIfNeeded();
      resetHistories(put, get);

      const items = await ProRevocationCache.getListItems();
      expect(items).to.be.deep.equal([validItemEffective, validItemDelayed]);
      expect(put.callCount).to.eq(0);
      expect(get.callCount).to.eq(0);
    });
  });

  describe('setListItems', () => {
    it('can get and retrieve entries', async () => {
      put.resolves();
      await ProRevocationCache.loadFromDbIfNeeded();
      resetHistories(put, get);

      await ProRevocationCache.setListItems([validItemEffective]);
      const itemsRetrieved = await ProRevocationCache.getListItems();
      expect(itemsRetrieved).to.be.deep.equal([validItemEffective]);
      expect(put.callCount).to.eq(1);
      expect(get.callCount).to.eq(0); // entry should been cached, so no get should be done

      // then empty the cache
      await ProRevocationCache.setListItems([]);
      const itemsRetrieved2 = await ProRevocationCache.getListItems();
      expect(put.callCount).to.eq(2);
      expect(itemsRetrieved2).to.be.deep.equal([]);
      expect(get.callCount).to.eq(0);

      // then add 2 entries
      await ProRevocationCache.setListItems([
        validItemEffective,
        validItemDelayed,
        validItemExpired,
      ]);
      const itemsRetrieved3 = await ProRevocationCache.getListItems(); // as there is no data in the DB, this will call get & put once more
      expect(itemsRetrieved3).to.be.deep.equal([
        validItemEffective,
        validItemDelayed,
        validItemExpired,
      ]);
      expect(put.callCount).to.eq(3);
      expect(get.callCount).to.eq(0);
    });
  });

  describe('isRevoked', () => {
    it('marked as revoked hash returns true', async () => {
      put.resolves();
      await ProRevocationCache.loadFromDbIfNeeded();

      await ProRevocationCache.setListItems([validItemEffective]);
      expect(
        ProRevocationCache.isB64HashEffectivelyRevoked(validItemEffective.gen_index_hash_b64)
      ).to.eq(true);
    });
    it('non-present hash returns false', async () => {
      put.resolves();
      await ProRevocationCache.loadFromDbIfNeeded();

      await ProRevocationCache.setListItems([validItemEffective]);
      expect(
        ProRevocationCache.isB64HashEffectivelyRevoked(validItemDelayed.gen_index_hash_b64)
      ).to.eq(false);
    });
    it('present but non effective hash returns false', async () => {
      put.resolves();
      await ProRevocationCache.loadFromDbIfNeeded();

      await ProRevocationCache.setListItems([validItemDelayed]);
      expect(
        ProRevocationCache.isB64HashEffectivelyRevoked(validItemDelayed.gen_index_hash_b64)
      ).to.eq(false);
    });

    it('present but expired hash returns true when it is effective', async () => {
      put.resolves();
      await ProRevocationCache.loadFromDbIfNeeded();

      await ProRevocationCache.setListItems([validItemExpired]);
      expect(
        ProRevocationCache.isB64HashEffectivelyRevoked(validItemExpired.gen_index_hash_b64)
      ).to.eq(true);
    });
  });
});
