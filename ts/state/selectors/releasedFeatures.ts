import { useSelector } from 'react-redux';
import type { StateType } from '../reducer';

export const useUpdatedAt = (): number => {
  return useSelector((state: StateType) => {
    return state?.releasedFeatures.refreshedAt || 0;
  });
};
