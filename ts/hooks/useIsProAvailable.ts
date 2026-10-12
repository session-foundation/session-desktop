import { getFeatureFlagMemo } from '../state/ducks/types/releasedFeaturesReduxTypes';

export function getIsProAvailableMemo() {
  return !!getFeatureFlagMemo('proAvailable');
}

export function getIsProGroupsAvailableMemo() {
  return !!getFeatureFlagMemo('proGroupsAvailable');
}
