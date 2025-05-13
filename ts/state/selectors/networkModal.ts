import { useSelector } from 'react-redux';
import type { StateType } from '../reducer';
import type { NetworkModalState } from '../ducks/networkModal';
import type { LocalizerProps } from '../../components/basic/Localizer';

export const getNetworkModal = (state: StateType): NetworkModalState => {
  return state.networkModal;
};

// #region - Getters
const getInfoLoading = (state: StateType) => getNetworkModal(state).infoLoading;

const getNodesLoading = (state: StateType) => getNetworkModal(state).nodesLoading;

const getLastRefreshedTimestamp = (state: StateType) =>
  getNetworkModal(state).lastRefreshedTimestamp;

const getErrorMessage = (state: StateType) => getNetworkModal(state).errorMessage;

// #endregion

// #region - Hooks
export const useInfoLoading = (): boolean => {
  return useSelector(getInfoLoading);
};

export const useNodesLoading = (): boolean => {
  return useSelector(getNodesLoading);
};

export const useLastRefreshedTimestamp = (): number => {
  return useSelector(getLastRefreshedTimestamp);
};

export const useErrorMessage = (): LocalizerProps | null => {
  return useSelector(getErrorMessage);
};

// #endregion
