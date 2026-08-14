import { useSelector } from 'react-redux';
import { proStatusWithMock } from '../state/ducks/types/proMocks';
import { getDataFeatureFlagMemo } from '../state/ducks/types/releasedFeaturesReduxTypes';
import {
  defaultProAccessDetailsSourceData,
  getProBackendCurrentUserStatus,
} from '../state/selectors/proBackendData';
import { ProStatus } from '../session/apis/pro_backend_api/types';
import { UserUtils } from '../session/utils';
import type { StateType } from '../state/reducer';

export function selectOurProStatus(state: StateType) {
  const proBackendCurrentUserStatus = getProBackendCurrentUserStatus(state);

  return proStatusWithMock(
    proBackendCurrentUserStatus ?? defaultProAccessDetailsSourceData.currentStatus
  );
}

export function selectWeAreProUser(state: StateType) {
  return selectOurProStatus(state) === ProStatus.Active;
}

/**
 * ACCESS, for rendering: whether our proof currently entitles us to use Pro features.
 *
 * This subscribes to the value recomputed at each change source (config change, revocation update,
 * proof expiry). Anything that GRANTS rather than renders — the send path, the compose limit — must
 * call `currentUserProofIsValid()` directly instead, so the decision is made at the moment it matters.
 *
 * Distinct from `selectWeAreProUser`, which is DISPLAY. They are meant to disagree: during the overhang
 * on a proof that outlives its plan, this stays true while the plan reads expired.
 */
export function selectWeHaveProAccess(state: StateType) {
  // Already mock-adjusted: `refreshProAccess` stores the output of `currentUserProofIsValid()`, which
  // applies the mock itself. Do not re-apply it here.
  return state.proAccess.valid;
}

function useCurrentUserProStatus() {
  return useSelector(selectOurProStatus);
}

/**
 * DISPLAY: returns true if pro is available and the plan currently reads as active.
 *
 * For "may we use a Pro feature", use {@link useCurrentUserHasProAccess} instead — this one goes false
 * the moment the plan reads expired, even while a valid proof is still entitling the user to the
 * features.
 */
export function useCurrentUserHasPro() {
  const status = useCurrentUserProStatus();

  return status === ProStatus.Active;
}

/**
 * ACCESS: returns true if pro is available and our proof currently entitles us to Pro features.
 *
 * The right hook for any surface that represents a capability — a badge we assert to others, an
 * animated avatar, a gate on a Pro-only action.
 */
export function useCurrentUserHasProAccess() {
  const haveAccess = useSelector(selectWeHaveProAccess);

  return isProAvailable && haveAccess;
}

/**
 * Returns true if pro is available, and the current user has expired pro.
 */
export function useCurrentUserHasExpiredPro() {
  const status = useCurrentUserProStatus();

  return status === ProStatus.Expired;
}

/**
 * Returns true if pro is available, but the current user has never had pro.
 * (i.e. the user does not have pro currently and doesn't have an expired pro either)
 */
export function useCurrentNeverHadPro() {
  const status = useCurrentUserProStatus();

  return status === ProStatus.Never;
}

/**
 * Returns true if the corresponding user has a valid and pro proof and pro badge feature enabled.
 * Note: Only used for the other users and not ourselves
 */
function useShowProBadgeForOther(convoId?: string) {
  return useSelector((state: StateType) =>
    convoId ? (state.conversations.conversationLookup[convoId]?.showProBadgeOthers ?? false) : false
  );
}

export function useShowProBadgeFor(convoId?: string) {
  // Our own badge is ACCESS, not DISPLAY: it asserts to other people something they will verify against
  // the proof we attach. Showing it off the plan's status would badge us during the window where the
  // plan reads active but no usable proof exists, and hide it during the overhang where one does.
  const currentUserHasPro = useCurrentUserHasProAccess();
  // the other user pro badge is shown if they have a valid pro proof and pro badge feature enabled
  const otherUserHasPro = useShowProBadgeForOther(convoId);

  if (UserUtils.isUsFromCache(convoId)) {
    return currentUserHasPro;
  }

  return otherUserHasPro;
}
