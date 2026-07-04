import path from 'path';

import { readFileSync } from 'fs-extra';
import { isEmpty } from 'lodash';
import { expect } from 'chai';
import { enableLogRedirect } from '../../../test-utils/utils';
import { DURATION } from '../../../../session/constants';
import { fetchLatestRelease } from '../../../../session/fetch_latest_release';

describe('Updater', () => {
  it('package.json target is correct', () => {
    const content = readFileSync(
      path.join(__dirname, '..', '..', '..', '..', '..', '..', 'package.json')
    );

    // the CI for building release relies on this being set to build the different targets.
    if (!content || isEmpty(content) || !content.includes('"target": "deb",')) {
      throw new Error(
        'Content empty or does not contain the target on a single line. They have to be for the linux CI builds to pass.'
      );
    }
  });

  it('stubWindowLog is set to false before pushing', () => {
    expect(enableLogRedirect).to.be.eq(
      false,
      'If you see this message, just set `enableLogRedirect` to false in `ts/test/test-utils/utils/stubbing.ts'
    );
  });

  it('checks the file server on the same cadence as the update throttle', () => {
    expect(fetchLatestRelease.fetchReleaseFromFileServerInterval).to.equal(30 * DURATION.MINUTES);
  });
});
