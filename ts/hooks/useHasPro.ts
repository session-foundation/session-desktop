import { UserUtils } from '../session/utils';
import { useIsProAvailable } from './useIsProAvailable';
import { useIsProUser } from './useParamSelector';

/**
 * Returns true if pro is available, and the current user has pro (active, not expired)
 */
export function useCurrentUserHasPro() {
  const isProAvailable = useIsProAvailable();
  const weArePro = useIsProUser(UserUtils.getOurPubKeyStrFromCache());

  return isProAvailable && weArePro;
}

/**
 * Returns true if pro is available, and the current user has expired pro.
 */
export function useCurrentUserHasExpiredPro() {
  const isProAvailable = useIsProAvailable();
  // FIXME: we will need to have this coming from libsession (and stored in redux I guess)

  return isProAvailable && window.sessionFeatureFlags.mockCurrentUserHasProExpired;
}

/**
 * Returns true if pro is available, but the current user has never had pro.
 * (i.e. the user does not have pro currently and doesn't have an expired pro either)
 */
export function useCurrentNeverHadPro() {
  const isProAvailable = useIsProAvailable();
  const currentUserHasPro = useCurrentUserHasPro();
  const currentUserHasExpiredPro = useCurrentUserHasExpiredPro();
  return isProAvailable && !currentUserHasPro && !currentUserHasExpiredPro;
}

export function useUserHasPro(convoId?: string) {
  const isProAvailable = useIsProAvailable();
  const userIsPro = useIsProUser(convoId);

  return isProAvailable && userIsPro;
}
