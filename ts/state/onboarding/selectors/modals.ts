import { useSelector } from 'react-redux';
import { ModalsState } from '../ducks/modals';
import { OnboardingStoreState } from '../store';

const getModals = (state: OnboardingStoreState): ModalsState => {
  return state.modals;
};

export function useQuitModalState() {
  return useSelector((state: OnboardingStoreState) => getModals(state).quitModalState);
}

export function useTermsOfServicePrivacyModalState() {
  return useSelector(
    (state: OnboardingStoreState) => getModals(state).termsOfServicePrivacyModalState
  );
}
