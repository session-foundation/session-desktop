import { useDispatch, useSelector } from 'react-redux';
import { useCallback } from 'react';
import type { StateType } from '../reducer';
import {
  proBackendDataActions,
  RequestActionArgs,
  type ProBackendDataState,
} from '../ducks/proBackendData';
import { SettingsKey } from '../../data/settings-key';
import { Storage } from '../../util/storage';
import { ProDetailsResultSchema } from '../../session/apis/pro_backend_api/schemas';

export const getProBackendData = (state: StateType): ProBackendDataState => {
  return state.proBackendData;
};

export function getProDetailsFromStorage() {
  const response = Storage.get(SettingsKey.proDetails);
  if (!response) {
    return null;
  }
  const result = ProDetailsResultSchema.safeParse(response);
  if (result.success) {
    return result.data;
  }
  void Storage.remove(SettingsKey.proDetails);
  window?.log?.error(
    'failed to parse pro details from storage, removing item. error:',
    result.error
  );
  return null;
}

export const getProBackendProDetails = (state: StateType): ProBackendDataState['details'] => {
  const details = getProBackendData(state).details;

  if (!details.data) {
    return {
      ...details,
      data: getProDetailsFromStorage(),
    };
  }

  return details;
};

export const getProBackendCurrentUserStatus = (state: StateType) => {
  return getProBackendProDetails(state).data?.status;
};

export const useProBackendProDetails = (): ProBackendDataState['details'] => {
  return useSelector(getProBackendProDetails);
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
