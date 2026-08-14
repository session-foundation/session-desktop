import { NetworkTime } from '../../util/NetworkTime';
import { proAccessWithMock } from '../../state/ducks/types/proMocks';
import { ProRevocationCache } from '../revocation_list/pro_revocation_list';
import { getCachedUserConfig } from '../../webworker/workers/browser/libsession/libsession_worker_userconfig_interface';

/**
 * ACCESS: what this device may currently do — the single answer to "is our Pro usable right now".
 *
 * Derived from the proof in synced config, and validated on EVERY call against both the proof's own
 * expiry and the cached revocation list (which honours each item's effective timestamp). Deliberately
 * not memoized, cached or projected into redux: a value that is only correct when re-read is only
 * correct if callers actually re-read it.
 *
 * This governs features AND what we attach when sending. It is NOT the value that decides what the Pro
 * settings screen or the menu row show — that is DISPLAY ("what state is the plan in"), which comes
 * from the backend status and may legitimately disagree. A plan that has lapsed while the proof still
 * has time left displays as expired while the features keep working; that overhang is intended.
 *
 * Answers only for ourselves. Other people's proofs travel on their messages and are checked against
 * the same revocation list in `ConversationModel.hasValidCurrentProProof`.
 *
 * The status mock is applied HERE rather than at each caller, so rendering and enforcement can never
 * disagree about what a mocked run is entitled to. See `proAccessWithMock` for why a mock has to reach
 * ACCESS at all. Unmocked — which is every real client — this is the proof and nothing else.
 */
export function currentUserProofIsValid(): boolean {
  return proAccessWithMock(realProofIsValid());
}

function realProofIsValid(): boolean {
  let proProof;
  try {
    proProof = getCachedUserConfig().proConfig?.proProof;
  } catch {
    // user config not initialised yet (e.g. pre-login): no proof, so nothing is unlocked.
    return false;
  }

  if (!proProof) {
    return false;
  }

  // Revocation before expiry: a revoked proof is unusable however much time is left on it.
  if (ProRevocationCache.isB64HashEffectivelyRevoked(proProof.revocationTagB64)) {
    return false;
  }

  return NetworkTime.nowTs().isBeforeMs({ ms: proProof.expiryMs });
}
