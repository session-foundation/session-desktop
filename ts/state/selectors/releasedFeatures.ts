import { useSelector } from 'react-redux';
import type { StateType } from '../reducer';

const areGroupsCreatedAsNewGroupsYet = (): boolean => {
  const shouldCreateNewGroups = !!window.inboxStore?.getState()?.releasedFeatures.canCreateGroupV2;

  return window.sessionFeatureFlags.useClosedGroupV2 || shouldCreateNewGroups;
};

export const areLegacyGroupsReadOnly = (): boolean => {
  const theyAre = !!window.inboxStore?.getState()?.releasedFeatures.legacyGroupsReadOnly;

  return window.sessionFeatureFlags.forceLegacyGroupsDeprecated || theyAre;
};

export function useAreGroupsCreatedAsNewGroupsYet() {
  useSelector((state: StateType) => state.releasedFeatures.canCreateGroupV2);
  return useSelector(areGroupsCreatedAsNewGroupsYet);
}

/**
 * @returns true if legacy groups should not be polled anymore
 */
export function areLegacyGroupsReadOnlyOutsideRedux() {
  if (!window.inboxStore) {
    return false;
  }
  return areLegacyGroupsReadOnly();
}
