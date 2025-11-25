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
          'd1f0da92e22df8f285da4fe0fc92322ef0155c0c5ed2586532458a5758995b9b7bf98a3a0772af11e162e78ceba13ab936041fee4a59f04b3d28a77d17b0b603',
        rotating_sig:
          'cb1a3a4e5037c30bf662be6e3b33025b64612edd668d4494c7190e93629c2c0591c2dbbb2e6930732eadbbb9b7fcf98df3d085fddfb7fed58c75901b50c12506',
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
        count: 10,
        master_pkey: '3ec4ff1928220d599cccbf8d76002e80191c286906bc18987f46fd9688418852',
        unix_ts_ms: 1761884113627,
        master_sig:
          'f9065b20b5162b58e5580e855f979521ff02826b25b72b68a1c6c44c4eeb74e5e626e783de4ae715d7ef4438827f858221eb06aae2e7c4eea6ef3cd31e0e1c0f',
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
