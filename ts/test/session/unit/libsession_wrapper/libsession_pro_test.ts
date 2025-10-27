import { expect } from 'chai';
import { ProWrapperNode } from 'libsession_util_nodejs';
import Sinon from 'sinon';

describe('libsession_pro', () => {
  afterEach(() => {
    Sinon.restore();
  });

  describe('proFeaturesForMessage', () => {
    it('no need for 10k limit', async () => {
      expect(
        ProWrapperNode.proFeaturesForMessage({
          proFeatures: [],
          utf16: 'hello',
        })
      ).to.deep.eq({
        proFeatures: [],
        success: true,
        error: null,
        codepointCount: 5,
      });
    });
    it('expects ANIMATED_AVATAR to be forwarded as no need for 10k limit', async () => {
      expect(
        ProWrapperNode.proFeaturesForMessage({
          proFeatures: ['ANIMATED_AVATAR'],
          utf16: 'hellohello',
        })
      ).to.deep.eq({
        proFeatures: ['ANIMATED_AVATAR'],
        success: true,
        error: null,
        codepointCount: 10,
      });
    });
    it('expects 10K_CHARACTER_LIMIT to be ignored if requested as no need for 10k limit', async () => {
      expect(
        ProWrapperNode.proFeaturesForMessage({
          proFeatures: ['10K_CHARACTER_LIMIT', 'ANIMATED_AVATAR'], // 10k should be ignored
          utf16: 'hellohello',
        })
      ).to.deep.eq({
        proFeatures: ['ANIMATED_AVATAR'],
        success: true,
        error: null,
        codepointCount: 10,
      });
    });
    it('expects 10K_CHARACTER_LIMIT to be added if need for 10k limit', async () => {
      expect(
        ProWrapperNode.proFeaturesForMessage({
          proFeatures: [], // 10k should be added
          utf16: '01234567891'.repeat(1000), // 1000 * 11 chars = 11000 codepoints
        })
      ).to.deep.eq({
        proFeatures: ['10K_CHARACTER_LIMIT'],
        success: true,
        error: null,
        codepointCount: 11000,
      });
    });
    it('expects 10K_CHARACTER_LIMIT to be added if need for 10k limit (and extra feature requested)', async () => {
      expect(
        ProWrapperNode.proFeaturesForMessage({
          proFeatures: ['ANIMATED_AVATAR'], // 10k should be added
          utf16: '01234567891'.repeat(1000), // 1000 * 11 chars = 11000 codepoints
        })
      ).to.deep.eq({
        proFeatures: ['10K_CHARACTER_LIMIT', 'ANIMATED_AVATAR'],
        success: true,
        error: null,
        codepointCount: 11000,
      });
    });
  });
});
