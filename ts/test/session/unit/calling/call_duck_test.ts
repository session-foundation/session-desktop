import { assert } from 'chai';
import Sinon from 'sinon';

import {
  callConnected,
  callReducer,
  endCall,
  initialCallState,
  setFullScreenCall,
  startingCallWith,
} from '../../../../state/ducks/call';
import { TestUtils } from '../../../test-utils';

const pubkey = '051234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

/**
 * Bring the state to an ongoing call the same way the app does, so the tests exercise the real
 * transitions rather than a hand-made state object.
 */
function ongoingCallState() {
  let state = callReducer(initialCallState, startingCallWith({ pubkey }));
  state = callReducer(state, callConnected({ pubkey }));
  return state;
}

describe('state/ducks/call', () => {
  let originalAudio: unknown;

  beforeEach(() => {
    TestUtils.stubWindowLog();
    // RingingManager constructs an Audio() on every call transition; jsdom has no media stack
    originalAudio = (global as any).Audio;
    (global as any).Audio = class {
      public loop = false;

      public volume = 0;

      public srcObject: unknown = null;

      public play() {
        return Promise.resolve();
      }

      public pause() {
        /* nothing to pause in a test */
      }
    };
  });

  afterEach(() => {
    (global as any).Audio = originalAudio;
    Sinon.restore();
  });

  describe('setFullScreenCall', () => {
    it('goes full screen when a call is ongoing', () => {
      const state = callReducer(ongoingCallState(), setFullScreenCall(true));
      assert.isTrue(state.callIsInFullScreen);
    });

    it('refuses to go full screen when there is no ongoing call', () => {
      const state = callReducer(initialCallState, setFullScreenCall(true));
      assert.isFalse(state.callIsInFullScreen);
    });

    it('refuses to go full screen while the call is still connecting', () => {
      const connecting = callReducer(initialCallState, startingCallWith({ pubkey }));
      const state = callReducer(connecting, setFullScreenCall(true));
      assert.isFalse(state.callIsInFullScreen);
    });

    it('leaves full screen when asked to', () => {
      const inFullScreen = callReducer(ongoingCallState(), setFullScreenCall(true));
      const state = callReducer(inFullScreen, setFullScreenCall(false));
      assert.isFalse(state.callIsInFullScreen);
    });

    /**
     * The full screen overlay is the only thing rendering the remote video once it is up, so a
     * call which ends while in full screen must not leave the overlay behind.
     */
    it('leaves full screen when the call ends', () => {
      const inFullScreen = callReducer(ongoingCallState(), setFullScreenCall(true));
      const state = callReducer(callReducer(inFullScreen, endCall()), setFullScreenCall(true));
      assert.isFalse(state.callIsInFullScreen);
      assert.isUndefined(state.ongoingWith);
    });

    /**
     * Staying in full screen is the whole point of being able to share a screen from it: nothing
     * about the call's own state may drop us out of it while it is ongoing.
     */
    it('stays in full screen across repeated set-true dispatches', () => {
      let state = callReducer(ongoingCallState(), setFullScreenCall(true));
      state = callReducer(state, setFullScreenCall(true));
      assert.isTrue(state.callIsInFullScreen);
    });
  });
});
