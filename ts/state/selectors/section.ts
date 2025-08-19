import { createSelector } from '@reduxjs/toolkit';

import { useSelector } from 'react-redux';
import { LeftOverlayMode, SectionStateType, SectionType } from '../ducks/section';
import { StateType } from '../reducer';

export const getSection = (state: StateType): SectionStateType => state.section;

export const getFocusedSection = createSelector(
  getSection,
  (state: SectionStateType): SectionType => state.focusedSection
);

export const getIsMessageSection = (state: StateType) => {
  return state.section.focusedSection === SectionType.Message;
};

export function useIsMessageSection() {
  return useSelector(getIsMessageSection);
}

export const getIsAppFocused = createSelector(
  getSection,
  (state: SectionStateType): boolean => state.isAppFocused
);

const getLeftOverlayMode = createSelector(
  getSection,
  (state: SectionStateType): LeftOverlayMode | undefined => state.leftOverlayMode
);

export const useLeftOverlayMode = () => {
  return useSelector(getLeftOverlayMode);
};

export const getRightOverlayMode = (state: StateType) => {
  return state.section.rightOverlayMode;
};

const getIsMessageRequestOverlayShown = (state: StateType) => {
  const focusedSection = getFocusedSection(state);
  const leftOverlayMode = getLeftOverlayMode(state);

  return focusedSection === SectionType.Message && leftOverlayMode === 'message-requests';
};

export function useIsMessageRequestOverlayShown() {
  return useSelector(getIsMessageRequestOverlayShown);
}
