import { useSelector } from 'react-redux';
import type { StateType } from '../reducer';

export const useReleasedFeaturesRefreshedAt = (): number => {
  return useSelector((state: StateType) => {
    return state?.releasedFeatures.refreshedAt || 0;
  });
};



export function useSesh101NotificationAt() {
  const sesh101NotificationAt = useSelector(
    (state: StateType) => state.releasedFeatures.sesh101NotificationAt
  );
  return sesh101NotificationAt;
}

