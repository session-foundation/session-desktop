import { useSelector } from 'react-redux';
import { getAppDispatch } from '../state/dispatch';
import {
  getDataFeatureFlagMemo,
  getFeatureFlagMemo,
} from '../state/ducks/types/releasedFeaturesReduxTypes';
import { assertUnreachable } from '../types/sqlSharedTypes';
import { getIsProAvailableMemo } from './useIsProAvailable';
import { useIsProUser } from './useParamSelector';
import LIBSESSION_CONSTANTS from '../session/utils/libsession/libsession_constants';
import {
  defaultProAccessDetailsSourceData,
  getProBackendProDetails,
  ProcessedProDetails,
  useProBackendCurrentUserStatus,
} from '../state/selectors/proBackendData';
import {
  proBackendDataActions,
  RequestActionArgs,
  WithCallerContext,
} from '../state/ducks/proBackendData';
import {
  getProOriginatingPlatformFromProPaymentProvider,
  ProAccessVariant,
  ProPaymentProvider,
  ProStatus,
} from '../session/apis/pro_backend_api/types';
import { sleepFor } from '../session/utils/Promise';

function useCurrentUserProStatus() {
  const proBackendCurrentUserStatus = useProBackendCurrentUserStatus();
  const mockCurrentStatus = getDataFeatureFlagMemo('mockProCurrentStatus');

  return (
    mockCurrentStatus ??
    proBackendCurrentUserStatus ??
    defaultProAccessDetailsSourceData.currentStatus
  );
}

/**
 * Returns true if pro is available, and the current user has pro (active, not expired)
 */
export function useCurrentUserHasPro() {
  const isProAvailable = getIsProAvailableMemo();
  const status = useCurrentUserProStatus();

  return isProAvailable && status === ProStatus.Active;
}

/**
 * Returns true if pro is available, and the current user has expired pro.
 */
export function useCurrentUserHasExpiredPro() {
  const isProAvailable = getIsProAvailableMemo();
  const status = useCurrentUserProStatus();

  return isProAvailable && status === ProStatus.Expired;
}

/**
 * Returns true if pro is available, but the current user has never had pro.
 * (i.e. the user does not have pro currently and doesn't have an expired pro either)
 */
export function useCurrentNeverHadPro() {
  const isProAvailable = getIsProAvailableMemo();
  const status = useCurrentUserProStatus();

  return isProAvailable && status === ProStatus.NeverBeenPro;
}

// TODO: we have a disconnect in what state we use where for if the current user is pro, this needs to be looked into
export function useUserHasPro(convoId?: string) {
  const isProAvailable = getIsProAvailableMemo();
  const userIsPro = useIsProUser(convoId);

  return isProAvailable && userIsPro;
}

export function proAccessVariantToString(variant: ProAccessVariant): string {
  switch (variant) {
    case ProAccessVariant.OneMonth:
      return '1 Month';
    case ProAccessVariant.ThreeMonth:
      return '3 Months';
    case ProAccessVariant.TwelveMonth:
      return '12 Months';
    case ProAccessVariant.Nil:
      return 'N/A';
    default:
      return assertUnreachable(variant, `Unknown pro access variant: ${variant}`);
  }
}

export function getProProviderConstantsWithFallbacks(provider: ProPaymentProvider) {
  const libsessionPaymentProvider = getProOriginatingPlatformFromProPaymentProvider(provider);
  const constants = LIBSESSION_CONSTANTS.LIBSESSION_PRO_PROVIDERS[libsessionPaymentProvider];

  if (!constants.store) {
    constants.store = LIBSESSION_CONSTANTS.LIBSESSION_PRO_PROVIDERS.Google.store;
  }

  if (!constants.store_other) {
    constants.store_other = LIBSESSION_CONSTANTS.LIBSESSION_PRO_PROVIDERS.Google.store_other;
  }

  return constants;
}

type RequestHook = ProcessedProDetails & {
  refetch: (args?: WithCallerContext) => void;
};

export const useProBackendProDetails = () => {
  return useSelector(getProBackendProDetails);
};

export function useProAccessDetails(): RequestHook {
  const dispatch = getAppDispatch();

  const details = useProBackendProDetails();

  const mockSuccess = getFeatureFlagMemo('mockProRecoverButtonAlwaysSucceed');
  const mockFail = getFeatureFlagMemo('mockProRecoverButtonAlwaysFail');

  const mockRefetchSuccess = async () => {
    const setProBackendIsLoading = (props: RequestActionArgs) =>
      dispatch(proBackendDataActions.setIsLoading(props));
    const setProBackendIsError = (props: RequestActionArgs) =>
      dispatch(proBackendDataActions.setIsError(props));

    if (details.isLoading) {
      return;
    }
    setProBackendIsLoading({ key: 'details', result: true });
    setProBackendIsError({ key: 'details', result: false });
    await sleepFor(5000);
    setProBackendIsLoading({ key: 'details', result: false });
  };

  const mockRefetchFail = async () => {
    const setProBackendIsLoading = (props: RequestActionArgs) =>
      dispatch(proBackendDataActions.setIsLoading(props));
    const setProBackendIsError = (props: RequestActionArgs) =>
      dispatch(proBackendDataActions.setIsError(props));
    if (details.isLoading) {
      return;
    }
    setProBackendIsLoading({ key: 'details', result: true });
    setProBackendIsError({ key: 'details', result: false });
    await sleepFor(5000);
    setProBackendIsError({ key: 'details', result: true });
    setProBackendIsLoading({ key: 'details', result: false });
  };

  const refetch = (args: WithCallerContext = {}) => {
    if (details.isError || mockFail) {
      void mockRefetchFail();
      return;
    }

    if (mockSuccess) {
      void mockRefetchSuccess();
      return;
    }
    dispatch(proBackendDataActions.refreshGetProDetailsFromProBackend(args) as any);
  };

  return {
    ...details,
    refetch,
  };
}
