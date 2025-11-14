import { expect } from 'chai';
import { ProWrapperNode } from 'libsession_util_nodejs';
import Sinon from 'sinon';
import { getSodiumNode } from '../../../../node/sodiumNode';
import { ProFeatures, ProMessageFeature } from '../../../../models/proMessageFeature';

const masterPrivKey = '4d3ffd1e98982ee64b86990901a73d3627536b4103ce8d006cb836d45a525c51';
const rotatingPrivKey = '3e6933de326f5647769f7b3e6db2ca6469c768141be9384276a3692ea04cbee7';

describe('libsession_pro', () => {
  afterEach(() => {
    Sinon.restore();
  });

  describe('proFeaturesForMessage', () => {
    it('no need for 10k limit', async () => {
      expect(
        ProWrapperNode.proFeaturesForMessage({
          proFeaturesBitset: 0n,
          utf16: 'hello',
        })
      ).to.deep.eq({
        proFeaturesBitset: 0n,
        status: 'SUCCESS',
        error: null,
        codepointCount: 5,
      });
    });
    it('expects ANIMATED_AVATAR to be forwarded as no need for 10k limit', async () => {
      expect(
        ProWrapperNode.proFeaturesForMessage({
          proFeaturesBitset: ProFeatures.addProFeature(
            0n,
            ProMessageFeature.PRO_ANIMATED_DISPLAY_PICTURE
          ),
          utf16: 'hellohello',
        })
      ).to.deep.eq({
        proFeaturesBitset: 4n,
        status: 'SUCCESS',
        error: null,
        codepointCount: 10,
      });
    });
    it('expects 10K_CHARACTER_LIMIT to be ignored if requested as no need for 10k limit', async () => {
      const withAnimatedAvatar = ProFeatures.addProFeature(
        0n,
        ProMessageFeature.PRO_ANIMATED_DISPLAY_PICTURE
      );

      const withAnimatedAvatarAnd10k = ProFeatures.addProFeature(
        withAnimatedAvatar,
        ProMessageFeature.PRO_INCREASED_MESSAGE_LENGTH // 10k should be ignored
      );
      expect(
        ProWrapperNode.proFeaturesForMessage({
          proFeaturesBitset: withAnimatedAvatarAnd10k,
          utf16: 'hellohello',
        })
      ).to.deep.eq({
        proFeaturesBitset: 4n,
        status: 'SUCCESS',
        error: null,
        codepointCount: 10,
      });
    });
    it('expects 10K_CHARACTER_LIMIT to be added if need for 10k limit', async () => {
      expect(
        ProWrapperNode.proFeaturesForMessage({
          proFeaturesBitset: 0n, // 10k should be added
          utf16: '012345678'.repeat(1000), // 1000 * 9 chars = 9000 codepoints
        })
      ).to.deep.eq({
        proFeaturesBitset: 1n,
        status: 'SUCCESS',
        error: null,
        codepointCount: 9000,
      });
    });
    it('expects 10K_CHARACTER_LIMIT to be added if need for 10k limit (and extra feature requested)', async () => {
      expect(
        ProWrapperNode.proFeaturesForMessage({
          proFeaturesBitset: ProFeatures.addProFeature(
            0n,
            ProMessageFeature.PRO_ANIMATED_DISPLAY_PICTURE
          ), // 10k should be added
          utf16: '012345678'.repeat(1000), // 1000 * 9 chars = 9000 codepoints
        })
      ).to.deep.eq({
        proFeaturesBitset: 5n,
        status: 'SUCCESS',
        error: null,
        codepointCount: 9000,
      });
    });
  });

  describe('proRevocationsRequestBody', () => {
    it('throws if invalid input', async () => {
      expect(() =>
        ProWrapperNode.proRevocationsRequestBody({
          requestVersion: 0,
          ticket: 'randomstr' as any as number,
        })
      ).to.throw;

      expect(() =>
        ProWrapperNode.proRevocationsRequestBody({
          requestVersion: 'randomstr' as any as number,
          ticket: 0,
        })
      ).to.throw;
    });

    it('passes if valid input', async () => {
      expect(
        ProWrapperNode.proRevocationsRequestBody({
          ticket: 0,
          requestVersion: 0,
        })
      ).to.be.deep.eq('{"ticket":0,"version":0}');

      expect(
        ProWrapperNode.proRevocationsRequestBody({
          ticket: 1234,
          requestVersion: 255,
        })
      ).to.be.deep.eq('{"ticket":1234,"version":255}');

      expect(
        ProWrapperNode.proRevocationsRequestBody({
          ticket: 1265893200,
          requestVersion: 123,
        })
      ).to.be.deep.eq('{"ticket":1265893200,"version":123}');
    });
  });

  describe('proProofRequestBody', () => {
    it('generates a valid request body', async () => {
      const validContent = {
        version: 0,
        master_pkey: '3ec4ff1928220d599cccbf8d76002e80191c286906bc18987f46fd9688418852',
        rotating_pkey: '574b0063d782e6b56beac6c1b67766f0f81ecacf66ab7efefd2c9a65d6c8de88',
        unix_ts_ms: 1761884113627,
        master_sig:
          '1bf719cc278d63e66ca89e4fabba8d8e0730995058ef3082ec90213449ab5c991eb3de6f757834a154accd308cf9fc4b086cc98586c9bd265d0b14aeeed0960b',
        rotating_sig:
          'c5e6a469d9210b0483cfc306b96b986147d95b59893a66ddc7ce5123c070246243660f76f34dc728dbdd75eb28707f4bb69a659e458c2587a55b9cfccc48030f',
      };

      await getSodiumNode();
      expect(
        JSON.parse(
          ProWrapperNode.proProofRequestBody({
            requestVersion: 0,
            masterPrivKeyHex: masterPrivKey,
            rotatingPrivKeyHex: rotatingPrivKey,
            unixTsMs: 1761884113627,
          })
        )
      ).to.deep.eq(validContent);
    });
  });

  describe('proStatusRequestBody', () => {
    it('generates a valid request body', async () => {
      const validContent = {
        version: 0,
        count: 0,
        master_pkey: '3ec4ff1928220d599cccbf8d76002e80191c286906bc18987f46fd9688418852',
        unix_ts_ms: 1761884113627,
        master_sig:
          '713421ad79e4710d87b292f07332601c4946f52b284b3bfbe2d61016d91432755f3713d05b83c36387032b97a40ddb7581a8e9852cf722dc7641c773ddde990b',
      };

      await getSodiumNode();
      expect(
        JSON.parse(
          ProWrapperNode.proStatusRequestBody({
            requestVersion: 0,
            masterPrivKeyHex: masterPrivKey,
            unixTsMs: 1761884113627,
            count: 10,
          })
        )
      ).to.deep.eq(validContent);
    });
  });

  describe('proRevocationsRequestBody', () => {
    it('generates a valid request body', async () => {
      const validContent = {
        version: 0,
        ticket: 0,
      };

      await getSodiumNode();
      expect(
        JSON.parse(
          ProWrapperNode.proRevocationsRequestBody({
            requestVersion: 0,
            ticket: 0,
          })
        )
      ).to.deep.eq(validContent);
    });
  });
});
