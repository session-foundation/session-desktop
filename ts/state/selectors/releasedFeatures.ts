import { useSelector } from 'react-redux';
import type { StateType } from '../reducer';

export const useReleasedFeaturesRefreshedAt = (): number => {
  return useSelector((state: StateType) => {
    return state?.releasedFeatures.refreshedAt || 0;
  });
};

export function useIsSesh101Ready() {
  const sesh101 = useSelector((state: StateType) => state.releasedFeatures.sesh101Ready);
  return window.sessionFeatureFlags.useSESH101 || sesh101;
}

export function useSesh101NotificationAt() {
  const sesh101NotificationAt = useSelector(
    (state: StateType) => state.releasedFeatures.sesh101NotificationAt
  );
  return sesh101NotificationAt;
}

// outside of redux

export function isSesh101ReadyOutsideRedux() {
  if (!window.inboxStore) {
    return false;
  }
  const sesh101 = !!window.inboxStore?.getState()?.releasedFeatures.sesh101;
  return window.sessionFeatureFlags.useSESH101 || sesh101;
}
