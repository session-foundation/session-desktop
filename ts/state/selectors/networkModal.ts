import { useSelector } from 'react-redux';
import type { StateType } from '../reducer';
import type { NetworkModalState } from '../ducks/networkModal';
import type { LocalizerProps } from '../../components/basic/Localizer';

const getNetworkModal = (state: StateType): NetworkModalState => {
  return state.networkModal;
};

// #region - Hooks
export const useInfoLoading = (): boolean => {
  return useSelector((state: StateType) => getNetworkModal(state).infoLoading);
};

export const useInfoFakeRefreshing = () => {
  return useSelector((state: StateType) => getNetworkModal(state).infoFakeRefreshing);
};

export const useLastRefreshedTimestamp = (): number => {
  return useSelector((state: StateType) => getNetworkModal(state).lastRefreshedTimestamp);
};

export const useErrorMessage = (): LocalizerProps | null => {
  return useSelector((state: StateType) => getNetworkModal(state).errorMessage);
};

// #endregion
