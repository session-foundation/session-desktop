import { expect } from 'chai';
import { beforeEach, afterEach, describe, it } from 'mocha';
import Sinon from 'sinon';

import { resolvePubkeyOrOns } from '../../../../session/utils/resolvePubkeyOrOns';
import { ONSResolve } from '../../../../session/apis/snode_api/onsResolve';
import { NotFoundError, SnodeResponseError } from '../../../../session/utils/errors';
import { tr } from '../../../../localization/localeTools';
import { initI18n } from './i18n/util';

const validPubkey = `05${'0'.repeat(64)}`; // 66-char, 05-prefixed, hex
const blinded15Pubkey = `15${'0'.repeat(64)}`;
const group03Pubkey = `03${'0'.repeat(64)}`;

describe('resolvePubkeyOrOns', () => {
  let onsStub: Sinon.SinonStub;

  beforeEach(() => {
    initI18n();
    onsStub = Sinon.stub(ONSResolve, 'getSessionIDForOnsName');
  });

  afterEach(() => {
    Sinon.restore();
  });

  describe('Account IDs (no ONS lookup)', () => {
    it('passes through a valid non-blinded 05 Account ID without resolving', async () => {
      const result = await resolvePubkeyOrOns(validPubkey);

      expect(result).to.deep.equal({ type: 'resolved', pubkey: validPubkey });
      expect(onsStub.called).to.equal(false);
    });

    it('trims surrounding whitespace before validating', async () => {
      const result = await resolvePubkeyOrOns(`   ${validPubkey}   `);

      expect(result).to.deep.equal({ type: 'resolved', pubkey: validPubkey });
      expect(onsStub.called).to.equal(false);
    });

    it('rejects a blinded (15) key without attempting an ONS lookup', async () => {
      const result = await resolvePubkeyOrOns(blinded15Pubkey);

      expect(result).to.deep.equal({ type: 'error', error: tr('accountIdErrorInvalid') });
      expect(onsStub.called).to.equal(false);
    });

    it('rejects a 03-group key without attempting an ONS lookup', async () => {
      const result = await resolvePubkeyOrOns(group03Pubkey);

      expect(result).to.deep.equal({ type: 'error', error: tr('accountIdErrorInvalid') });
      expect(onsStub.called).to.equal(false);
    });

    it('rejects empty / whitespace-only input as an invalid Account ID', async () => {
      const result = await resolvePubkeyOrOns('   ');

      expect(result).to.deep.equal({ type: 'error', error: tr('accountIdErrorInvalid') });
      expect(onsStub.called).to.equal(false);
    });
  });

  describe('ONS names', () => {
    it('resolves a valid ONS name to its Account ID', async () => {
      onsStub.resolves(validPubkey);

      const result = await resolvePubkeyOrOns('testname');

      expect(result).to.deep.equal({ type: 'resolved', pubkey: validPubkey });
      expect(onsStub.calledOnceWithExactly('testname')).to.equal(true);
    });

    it('rejects a dotted name (e.g. testname.bdx) as an unrecognized ONS, no lookup', async () => {
      const result = await resolvePubkeyOrOns('testname.bdx');

      expect(result).to.deep.equal({ type: 'error', error: tr('onsErrorNotRecognized') });
      expect(onsStub.called).to.equal(false);
    });

    it('maps an unregistered ONS (NotFoundError) to onsErrorNotRecognized', async () => {
      onsStub.rejects(new NotFoundError('no encrypted_value'));

      const result = await resolvePubkeyOrOns('testname');

      expect(result).to.deep.equal({ type: 'error', error: tr('onsErrorNotRecognized') });
    });

    it('maps a snode failure (SnodeResponseError) to onsErrorUnableToSearch', async () => {
      onsStub.rejects(new SnodeResponseError());

      const result = await resolvePubkeyOrOns('testname');

      expect(result).to.deep.equal({ type: 'error', error: tr('onsErrorUnableToSearch') });
    });

    it('maps an unexpected error to onsErrorUnableToSearch', async () => {
      onsStub.rejects(new Error('boom'));

      const result = await resolvePubkeyOrOns('testname');

      expect(result).to.deep.equal({ type: 'error', error: tr('onsErrorUnableToSearch') });
    });

    it('rejects when the resolved id is not a valid Account ID', async () => {
      onsStub.resolves('deadbeef'); // resolves to something that fails validation

      const result = await resolvePubkeyOrOns('testname');

      expect(result).to.deep.equal({ type: 'error', error: tr('onsErrorNotRecognized') });
    });
  });
});
