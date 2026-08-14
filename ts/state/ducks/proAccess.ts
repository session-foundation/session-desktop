import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { currentUserProofIsValid } from '../../session/utils/ProAccess';
import { getCachedUserConfig } from '../../webworker/workers/browser/libsession/libsession_worker_userconfig_interface';
import { NetworkTime } from '../../util/NetworkTime';
import { ProRevocationCache } from '../../session/revocation_list/pro_revocation_list';

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
 * The next instant at which our access could stop being valid with no event to announce it, or null if
 * there is no such instant.
 *
 * Two of them, and both are silent — nothing arrives, a moment simply passes:
 *   - the proof's own expiry;
 *   - a revocation already in our list whose effective timestamp is still in the future. The list has
 *     landed, so no further fetch is coming; the tag just starts biting.
 * Whichever comes first is the one to wake for.
 */
function nextSilentAccessChangeMs(): number | null {
  let proProof;
  try {
    proProof = getCachedUserConfig().proConfig?.proProof;
  } catch {
    return null;
  }
  if (!proProof) {
    return null;
  }

  const pendingRevocationMs = ProRevocationCache.pendingRevocationMsForB64Hash(
    proProof.revocationTagB64
  );

  if (!proProof.expiryMs) {
    return pendingRevocationMs;
  }
  return pendingRevocationMs ? Math.min(proProof.expiryMs, pendingRevocationMs) : proProof.expiryMs;
}

/**
 * Recompute the rendered ACCESS value, and arm a timer for the next instant it could change on its own.
 *
 * Call this from every source that can change the answer: a config change carrying a new proof, a
 * revocation list update, and app startup. The two silent instants get the timer instead — without it a
 * session left open would keep rendering Pro surfaces after the entitlement had gone, while the
 * enforcement paths (which call the function directly) were already refusing.
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

  const nextChangeMs = nextSilentAccessChangeMs();
  if (!nextChangeMs) {
    return;
  }

  // `setTimeout` is clamped to a signed 32-bit delay, and a proof can legitimately sit further out than
  // that (~24.9 days), so re-arm at the ceiling instead of firing immediately on overflow.
  const untilChangeMs = Math.max(0, nextChangeMs - NetworkTime.now());
  const maxDelayMs = 2 ** 31 - 1;
  expiryTimer = setTimeout(refreshProAccess, Math.min(untilChangeMs, maxDelayMs));
}
