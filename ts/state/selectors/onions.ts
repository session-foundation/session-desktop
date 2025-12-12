import { createSelector } from '@reduxjs/toolkit';

import { useSelector } from 'react-redux';
import { OnionState } from '../ducks/onions';
import { SectionType } from '../ducks/section';
import { StateType } from '../reducer';

const getOnionPaths = (state: StateType): OnionState => state.onionPaths;

export const getOnionPathsCount = createSelector(
  getOnionPaths,
  (state: OnionState): SectionType => state.snodePaths.length
);

const getFirstOnionPath = createSelector(
  getOnionPaths,
  (state: OnionState): Array<{ ip: string }> => state.snodePaths?.[0] || []
);

export const getFirstOnionPathLength = createSelector(
  getFirstOnionPath,
  (state: Array<{ ip: string }>): number => state.length || 0
);

export const getIsOnline = createSelector(
  getOnionPaths,
  (state: OnionState): boolean => state.isOnline
);

export const useFirstOnionPath = () => {
  return useSelector(getFirstOnionPath);
};

// outside of redux
function isOnlineOutsideRedux() {
  if (!window.inboxStore) {
    return false;
  }
  return !!window.inboxStore?.getState()?.onionPaths.isOnline;
}

export const ReduxOnionSelectors = {
  isOnlineOutsideRedux,
};
