import { expect } from 'chai';
import { ProWrapperNode } from 'libsession_util_nodejs';
import Sinon from 'sinon';

describe('libsession_pro', () => {
  afterEach(() => {
    Sinon.restore();
  });

  describe('proFeaturesForMessage', () => {
    it('expects feature to be forwarded as is if no need for 10k limit', async () => {
      expect(
        ProWrapperNode.proFeaturesForMessage({
          proFeatures: [],
          utf16: 'hello',
        })
      ).to.deep.eq({
        proFeatures: [],
        success: true,
        error: null,
        codePointCount: 5,
      });
    });
  });
});
