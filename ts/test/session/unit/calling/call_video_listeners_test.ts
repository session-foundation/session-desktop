import { assert } from 'chai';
import Sinon from 'sinon';

import {
  addVideoEventsListener,
  CallManagerOptionsType,
  removeVideoEventsListener,
} from '../../../../session/utils/calling/CallManager';
import { TestUtils } from '../../../test-utils';

/**
 * Regression test for `removeVideoEventsListener`, which used to call
 * `Array.prototype.splice(index)` with a single argument. That removes every element from `index`
 * onwards, so unmounting one call component silently detached the listeners of every component
 * registered after it — the in-conversation view would stop updating as soon as the full screen
 * overlay was closed.
 */
describe('CallManager video events listeners', () => {
  beforeEach(() => {
    TestUtils.stubWindowLog();
  });

  afterEach(() => {
    removeVideoEventsListener('listener-a');
    removeVideoEventsListener('listener-b');
    removeVideoEventsListener('listener-c');
    Sinon.restore();
  });

  it('removes only the listener it was asked to remove', () => {
    const calledA = Sinon.spy();
    const calledB = Sinon.spy();
    const calledC = Sinon.spy();

    addVideoEventsListener('listener-a', calledA);
    addVideoEventsListener('listener-b', calledB);
    addVideoEventsListener('listener-c', calledC);

    const countCBeforeRemoval = calledC.callCount;

    // removing the middle one used to take 'listener-c' with it
    removeVideoEventsListener('listener-b');

    assert.isAbove(
      calledC.callCount,
      countCBeforeRemoval,
      'listener-c must still be notified after an unrelated listener was removed'
    );

    const countAAfter = calledA.callCount;
    const countBAfter = calledB.callCount;
    const countCAfter = calledC.callCount;

    // any subsequent fan-out reaches a and c, never b
    addVideoEventsListener('listener-a', calledA);

    assert.isAbove(calledA.callCount, countAAfter);
    assert.isAbove(calledC.callCount, countCAfter);
    assert.strictEqual(calledB.callCount, countBAfter);
  });

  it('reports the screen sharing state to its listeners', () => {
    const seen: Array<CallManagerOptionsType> = [];

    addVideoEventsListener('listener-a', options => {
      seen.push(options);
    });

    assert.isNotEmpty(seen, 'adding a listener notifies it immediately');
    const lastOptions = seen[seen.length - 1];
    assert.isFalse(lastOptions.isScreenSharing, 'no call, so we are not sharing anything');
    assert.isFalse(lastOptions.isRemoteScreenSharing);
  });
});
