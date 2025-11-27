import { useFeatureFlag } from '../state/ducks/types/releasedFeaturesReduxTypes';

export function useIsProAvailable() {
  return !!useFeatureFlag('proAvailable');
}

export function useIsProGroupsAvailable() {
  return !!useFeatureFlag('proGroupsAvailable');
}
