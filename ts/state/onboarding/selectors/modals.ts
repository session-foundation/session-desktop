import { createSelector } from '@reduxjs/toolkit';
import { ModalsState } from '../ducks/modals';
import { OnboardingStoreState } from '../store';

const getModals = (state: OnboardingStoreState): ModalsState => {
  return state.modals;
};

export const getQuitModalState = createSelector(
  getModals,
  (state: ModalsState) => state.quitModalState
);

export const getTermsOfServicePrivacyModalState = createSelector(
  getModals,
  (state: ModalsState) => state.termsOfServicePrivacyModalState
);
