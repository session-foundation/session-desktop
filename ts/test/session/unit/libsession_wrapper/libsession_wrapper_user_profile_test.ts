/* eslint-disable no-unused-expressions */
import { expect } from 'chai';
import Sinon from 'sinon';
import { UserConfigWrapperNode, type ProConfig } from 'libsession_util_nodejs';
import { base64_variants, randombytes_buf, to_base64, to_hex } from 'libsodium-wrappers-sumo';

import { UserUtils } from '../../../../session/utils';
import { SessionUtilUserProfile } from '../../../../session/utils/libsession/libsession_utils_user_profile';
import { TestUtils } from '../../../test-utils';
import { stubWindowLog } from '../../../test-utils/utils';
import { NetworkTime } from '../../../../util/NetworkTime';

describe('libsession_user_profile', () => {
  stubWindowLog();

  const getLatestTimestampOffset = 200000;
  const ourNumber = TestUtils.generateFakePubKeyStr();

  beforeEach(() => {
    Sinon.stub(NetworkTime, 'getLatestTimestampOffset').returns(getLatestTimestampOffset);
    Sinon.stub(UserUtils, 'getOurPubKeyStrFromCache').returns(ourNumber);
    TestUtils.stubLibSessionWorker(undefined);
  });

  afterEach(() => {
    Sinon.restore();
  });

  describe('isUserProfileToStoreInWrapper', () => {
    it('returns true if thats our convo', () => {
      expect(SessionUtilUserProfile.isUserProfileToStoreInWrapper(ourNumber)).to.be.true;
    });

    it('returns false if thats NOT our convo', () => {
      const notUs = TestUtils.generateFakePubKeyStr();
      expect(SessionUtilUserProfile.isUserProfileToStoreInWrapper(notUs)).to.be.false;
    });
  });

  describe('generateProMasterKey', () => {
    it('can generate pro master key and regenerate the same key', async () => {
      const userKeys = await TestUtils.generateUserKeyPairs();
      const ed25519Seed = userKeys.ed25519KeyPair.privateKey.slice(0, 32);

      const wrapper = new UserConfigWrapperNode(userKeys.ed25519KeyPair.privKeyBytes, null);

      const generated = wrapper.generateProMasterKey({ ed25519SeedHex: to_hex(ed25519Seed) });
      expect(generated.proMasterKeyHex.length).to.equal(128);

      const generatedAgain = wrapper.generateProMasterKey({ ed25519SeedHex: to_hex(ed25519Seed) });

      expect(generatedAgain).to.be.deep.eq(generated);
    });
  });

  describe('proConfig', () => {
    it('can set, get & remove pro config', async () => {
      const userKeys = await TestUtils.generateUserKeyPairs();
      const ed25519Seed = userKeys.ed25519KeyPair.privateKey.slice(0, 32);

      const wrapper = new UserConfigWrapperNode(userKeys.ed25519KeyPair.privKeyBytes, null);
      expect(wrapper.getProConfig()).to.be.null;

      const proConfig: ProConfig = {
        rotatingPrivKeyHex: to_hex(randombytes_buf(64)),
        proProof: {
          expiryMs: Date.now() + 1000,
          genIndexHashB64: to_base64(ed25519Seed, base64_variants.ORIGINAL),
          rotatingPubkeyHex: to_hex(randombytes_buf(32)),
          version: 132,
          signatureHex: to_hex(randombytes_buf(64)),
        },
      };

      wrapper.setProConfig(proConfig);

      const proConfigFromWrapper = wrapper.getProConfig();
      if (!proConfigFromWrapper) {
        throw new Error('proConfigFromWrapper is null');
      }
      expect(proConfigFromWrapper).to.be.deep.eq(proConfig);

      wrapper.removeProConfig();

      expect(wrapper.getProConfig()).to.be.deep.eq(null);
    });
  });

  describe('setProBadge', () => {
    it('can set & get setProBadge', async () => {
      const userKeys = await TestUtils.generateUserKeyPairs();

      const wrapper = new UserConfigWrapperNode(userKeys.ed25519KeyPair.privKeyBytes, null);
      expect(wrapper.getProFeaturesBitset()).to.be.deep.eq(0n);

      wrapper.setProBadge(true);

      expect(wrapper.getProFeaturesBitset()).to.be.deep.eq(2n);
    });
  });

  describe('setAnimatedAvatar', () => {
    it('can set & get setAnimatedAvatar', async () => {
      const userKeys = await TestUtils.generateUserKeyPairs();

      const wrapper = new UserConfigWrapperNode(userKeys.ed25519KeyPair.privKeyBytes, null);
      expect(wrapper.getProFeaturesBitset()).to.be.deep.eq(0n);

      wrapper.setAnimatedAvatar(true);

      expect(wrapper.getProFeaturesBitset()).to.be.deep.eq(4n);
    });
  });
});
