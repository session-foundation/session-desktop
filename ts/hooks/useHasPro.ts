import { useSelector } from 'react-redux';
import { getDataFeatureFlagMemo } from '../state/ducks/types/releasedFeaturesReduxTypes';
import { getIsProAvailableMemo } from './useIsProAvailable';
import {
  defaultProAccessDetailsSourceData,
  getProBackendCurrentUserStatus,
} from '../state/selectors/proBackendData';
import { ProStatus } from '../session/apis/pro_backend_api/types';
import { UserUtils } from '../session/utils';
import type { StateType } from '../state/reducer';

export function selectOurProStatus(state: StateType) {
  const proBackendCurrentUserStatus = getProBackendCurrentUserStatus(state);
  const mockCurrentStatus = getDataFeatureFlagMemo('mockProCurrentStatus');

  return (
    mockCurrentStatus ??
    proBackendCurrentUserStatus ??
    defaultProAccessDetailsSourceData.currentStatus
  );
}

export function selectWeAreProUser(state: StateType) {
  return selectOurProStatus(state) === ProStatus.Active;
}

function useCurrentUserProStatus() {
  return useSelector((state: StateType) => selectOurProStatus(state));
}

/**
 * Returns true if pro is available, and the current user has pro (active, not expired)
 */
export function useCurrentUserHasPro() {
  const isProAvailable = getIsProAvailableMemo();
  const status = useCurrentUserProStatus();

  return isProAvailable && status === ProStatus.Active;
}

/**
 * Returns true if pro is available, and the current user has expired pro.
 */
export function useCurrentUserHasExpiredPro() {
  const isProAvailable = getIsProAvailableMemo();
  const status = useCurrentUserProStatus();

  return isProAvailable && status === ProStatus.Expired;
}

/**
 * Returns true if pro is available, but the current user has never had pro.
 * (i.e. the user does not have pro currently and doesn't have an expired pro either)
 */
export function useCurrentNeverHadPro() {
  const isProAvailable = getIsProAvailableMemo();
  const status = useCurrentUserProStatus();

  return isProAvailable && status === ProStatus.NeverBeenPro;
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
  const isProAvailable = getIsProAvailableMemo();
  // the current user pro badge is always shown if we have a valid pro
  const currentUserHasPro = useCurrentUserHasPro();
  // the other user pro badge is shown if they have a valid pro proof and pro badge feature enabled
  const otherUserHasPro = useShowProBadgeForOther(convoId);

  if (!isProAvailable) {
    return false;
  }

  if (UserUtils.isUsFromCache(convoId)) {
    return currentUserHasPro;
  }

  return otherUserHasPro;
}
