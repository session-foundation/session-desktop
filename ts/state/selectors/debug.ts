import { useSelector } from 'react-redux';
import type { StateType } from '../reducer';

const getDebugMode = (state: StateType): boolean => {
  return window.sessionFeatureFlags?.debug?.debugLogging || state?.debug?.debugMode || false;
};

export const useDebugMode = (): boolean => {
  return useSelector(getDebugMode);
};
