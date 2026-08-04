import { getFeatureFlagMemo } from '../state/ducks/types/releasedFeaturesReduxTypes';

export function getIsProGroupsAvailableMemo() {
  return !!getFeatureFlagMemo('proGroupsAvailable');
}
