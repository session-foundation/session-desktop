import { useSelector } from 'react-redux';
import type { StateType } from '../reducer';

export const useReleasedFeaturesRefreshedAt = (): number => {
  return useSelector((state: StateType) => {
    return state?.releasedFeatures.refreshedAt || 0;
  });
};
