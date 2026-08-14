import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { currentUserProofIsValid } from '../../session/utils/ProAccess';
import { getCachedUserConfig } from '../../webworker/workers/browser/libsession/libsession_worker_userconfig_interface';
import { NetworkTime } from '../../util/NetworkTime';

export type ProAccessState = {
  /**
   * Whether our Pro proof is currently usable — the rendered mirror of `currentUserProofIsValid()`.
   *
   * Rendering subscribes to this; anything that GRANTS calls the function directly instead. The two
   * must not drift, which is why nothing writes here except `refreshProAccess` below.
   */
  valid: boolean;
};

export const initialProAccessState: ProAccessState = {
  valid: false,
};

export const proAccessSlice = createSlice({
  name: 'proAccess',
  initialState: initialProAccessState,
  reducers: {
    setProAccessValid(state, action: PayloadAction<boolean>) {
      state.valid = action.payload;
      return state;
    },
  },
});

export const proAccessActions = { ...proAccessSlice.actions };
export default proAccessSlice.reducer;

let expiryTimer: NodeJS.Timeout | null = null;

/**
 * Recompute the rendered ACCESS value, and arm a timer for the next instant it could change on its own.
 *
 * Call this from every source that can change the answer: a config change carrying a new proof, a
 * revocation list update, and app startup. The proof's own expiry needs no external event, so it gets
 * the timer — without it a session left open would keep rendering Pro surfaces past the expiry, and the
 * enforcement paths (which call the function directly) would already be refusing.
 */
export function refreshProAccess() {
  const valid = currentUserProofIsValid();
  window.inboxStore?.dispatch(proAccessActions.setProAccessValid(valid));

  if (expiryTimer) {
    clearTimeout(expiryTimer);
    expiryTimer = null;
  }

  if (!valid) {
    // Nothing to wait for: an invalid proof only becomes valid again through one of the event sources
    // above, which will call back in here.
    return;
  }

  let expiryMs: number | undefined;
  try {
    expiryMs = getCachedUserConfig().proConfig?.proProof.expiryMs;
  } catch {
    return;
  }
  if (!expiryMs) {
    return;
  }

  // `setTimeout` is clamped to a signed 32-bit delay, and a proof can legitimately sit further out than
  // that (~24.9 days), so re-arm at the ceiling instead of firing immediately on overflow.
  const untilExpiryMs = Math.max(0, expiryMs - NetworkTime.now());
  const maxDelayMs = 2 ** 31 - 1;
  expiryTimer = setTimeout(refreshProAccess, Math.min(untilExpiryMs, maxDelayMs));
}
