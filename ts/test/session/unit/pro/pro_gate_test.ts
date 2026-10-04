import Sinon from 'sinon';
import { expect } from 'chai';

import { TestUtils } from '../../../test-utils';
import { currentUserProofIsValid } from '../../../../session/utils/ProAccess';
import { getOutgoingProMessageDetails } from '../../../../session/utils/User';
import { UserConfigWrapperActions } from '../../../../webworker/workers/browser/libsession/libsession_worker_userconfig_interface';
import { MockProProofOptions } from '../../../../state/ducks/types/releasedFeaturesReduxTypes';

// Flag off, this account gets no Pro and nothing is restricted for lacking it; flag on, the Pro rules apply.
describe('the proAvailable gate', () => {
  function setProAvailable(proAvailable: boolean) {
    TestUtils.stubWindow('sessionBooleanFeatureFlags', { proAvailable, debug: {} } as any);
    // Grants access on its own when the gate lets it through, so a leak shows without a real proof
    TestUtils.stubWindow('sessionDataFeatureFlags', {
      mockProProof: MockProProofOptions.Valid,
    } as any);
  }

  beforeEach(() => {
    TestUtils.stubWindowLog();
  });

  afterEach(() => {
    Sinon.restore();
  });

  describe('currentUserProofIsValid', () => {
    it('grants no access when Pro is off, even to a mocked valid proof', () => {
      setProAvailable(false);

      expect(currentUserProofIsValid()).to.eq(false);
    });

    it('grants access to a mocked valid proof when Pro is on', () => {
      setProAvailable(true);

      expect(currentUserProofIsValid()).to.eq(true);
    });
  });

  describe('getOutgoingProMessageDetails', () => {
    let getProConfig: Sinon.SinonStub;

    beforeEach(() => {
      getProConfig = Sinon.stub(UserConfigWrapperActions, 'getProConfig').resolves(null as any);
      Sinon.stub(UserConfigWrapperActions, 'getProProfileBitset').resolves(null as any);
    });

    it('attaches nothing, and does not read our proof, when Pro is off', async () => {
      setProAvailable(false);

      expect(await getOutgoingProMessageDetails({ utf16: 'hello' })).to.eq(null);
      expect(getProConfig.callCount).to.eq(0);
    });

    it('reads our proof when Pro is on', async () => {
      // The control for the test above: "not read" would also pass if nothing ever read it
      setProAvailable(true);

      try {
        await getOutgoingProMessageDetails({ utf16: 'hello' });
      } catch {
        // Nothing downstream is stubbed; reaching the read is what this asserts
      }
      expect(getProConfig.callCount).to.eq(1);
    });
  });
});
