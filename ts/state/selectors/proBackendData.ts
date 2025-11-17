import { useDispatch, useSelector } from 'react-redux';
import { useCallback } from 'react';
import type { StateType } from '../reducer';
import {
  proBackendDataActions,
  RequestActionArgs,
  type ProBackendDataState,
} from '../ducks/proBackendData';

export const getProBackendData = (state: StateType): ProBackendDataState => {
  return state.proBackendData;
};

export const getProBackendProofData = (state: StateType): ProBackendDataState['proof'] => {
  return getProBackendData(state).proof;
};

export const getProBackendProDetailsData = (state: StateType): ProBackendDataState['details'] => {
  return getProBackendData(state).details;
};

export const getProBackendCurrentUserStatus = (state: StateType) => {
  return getProBackendData(state).details.data?.status;
};

export const useProBackendData = (): ProBackendDataState => {
  return useSelector(getProBackendData);
};

export const useProBackendProofData = (): ProBackendDataState['proof'] => {
  return useSelector(getProBackendProofData);
};

export const useProBackendProDetailsData = (): ProBackendDataState['details'] => {
  return useSelector(getProBackendProDetailsData);
};

export const useProBackendCurrentUserStatus = () => {
  return useSelector(getProBackendCurrentUserStatus);
};

export const useSetProBackendIsLoading = () => {
  const dispatch = useDispatch();
  return useCallback(
    (props: RequestActionArgs) => dispatch(proBackendDataActions.setIsLoading(props)),
    [dispatch]
  );
};

export const useSetProBackendIsError = () => {
  const dispatch = useDispatch();
  return useCallback(
    (props: RequestActionArgs) => dispatch(proBackendDataActions.setIsError(props)),
    [dispatch]
  );
};
