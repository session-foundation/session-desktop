import { useSelector } from 'react-redux';
import type { StateType } from '../reducer';
import type { ProBackendDataState } from '../ducks/proBackendData';

export const getProBackendData = (state: StateType): ProBackendDataState => {
  return state.proBackendData;
};

export const getProBackendProofData = (state: StateType): ProBackendDataState['proof'] => {
  return getProBackendData(state).proof;
};

export const getProBackendRevocationsData = (
  state: StateType
): ProBackendDataState['revocations'] => {
  return getProBackendData(state).revocations;
};

export const getProBackendProStatusData = (state: StateType): ProBackendDataState['proStatus'] => {
  return getProBackendData(state).proStatus;
};

export const getProBackendCurrentUserStatus = (state: StateType) => {
  return getProBackendData(state).proStatus.data?.status;
};

export const useProBackendData = (): ProBackendDataState => {
  return useSelector(getProBackendData);
};

export const useProBackendProofData = (): ProBackendDataState['proof'] => {
  return useSelector(getProBackendProofData);
};

export const useProBackendRevocationsData = (): ProBackendDataState['revocations'] => {
  return useSelector(getProBackendRevocationsData);
};

export const useProBackendProStatusData = (): ProBackendDataState['proStatus'] => {
  return useSelector(getProBackendProStatusData);
};

export const useProBackendCurrentUserStatus = () => {
  return useSelector(getProBackendCurrentUserStatus);
};
