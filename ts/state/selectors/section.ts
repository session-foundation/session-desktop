import { createSelector } from '@reduxjs/toolkit';

import { useSelector } from 'react-redux';
import { LeftOverlayMode, LeftOverlayType, SectionStateType } from '../ducks/section';
import { StateType } from '../reducer';

export const getSection = (state: StateType): SectionStateType => state.section;

export const getIsAppFocused = createSelector(
  getSection,
  (state: SectionStateType): boolean => state.isAppFocused
);

const getLeftOverlayMode = createSelector(
  getSection,
  (state: SectionStateType): LeftOverlayMode | undefined => state.leftOverlayMode
);

export const getLeftOverlayModeType = createSelector(
  getSection,
  (state: SectionStateType): LeftOverlayType | undefined => state.leftOverlayMode?.type
);

export const useLeftOverlayModeType = () => {
  return useSelector(getLeftOverlayModeType);
};

export const useLeftOverlayMode = () => {
  return useSelector(getLeftOverlayMode);
};

export const getRightOverlayMode = (state: StateType) => {
  return state.section.rightOverlayMode;
};

const getIsMessageRequestOverlayShown = (state: StateType) => {
  const leftOverlayMode = getLeftOverlayModeType(state);

  return leftOverlayMode === 'message-requests';
};

export function useIsMessageRequestOverlayShown() {
  return useSelector(getIsMessageRequestOverlayShown);
}
