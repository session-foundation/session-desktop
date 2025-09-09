/* eslint-disable no-unused-expressions */
import { expect } from 'chai';
import Sinon from 'sinon';

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
});
