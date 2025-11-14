import { useCallback, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { ProOriginatingPlatform } from 'libsession_util_nodejs';
import useUpdate from 'react-use/lib/useUpdate';
import {
  MockProAccessExpiryOptions,
  setDataFeatureFlag,
  useDataFeatureFlag,
  useFeatureFlag,
} from '../state/ducks/types/releasedFeaturesReduxTypes';
import { assertUnreachable } from '../types/sqlSharedTypes';
import { useIsProAvailable } from './useIsProAvailable';
import { useIsProUser } from './useParamSelector';
import {
  formatDateWithLocale,
  formatRoundedUpTimeUntilTimestamp,
} from '../util/i18n/formatting/generics';
import LIBSESSION_CONSTANTS from '../session/utils/libsession/libsession_constants';
import {
  useProBackendCurrentUserStatus,
  useProBackendProStatusData,
  useSetProBackendIsError,
  useSetProBackendIsLoading,
} from '../state/selectors/proBackendData';
import { proBackendDataActions } from '../state/ducks/proBackendData';
import { NetworkTime } from '../util/NetworkTime';
import {
  getProOriginatingPlatformFromProPaymentProvider,
  ProAccessVariant,
  ProPaymentProvider,
  ProStatus,
} from '../session/apis/pro_backend_api/types';
import { sleepFor } from '../session/utils/Promise';

function useCurrentUserProStatus() {
  const proBackendCurrentUserStatus = useProBackendCurrentUserStatus();
  const mockCurrentStatus = useDataFeatureFlag('mockProCurrentStatus');

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
  const isProAvailable = useIsProAvailable();
  const status = useCurrentUserProStatus();

  return isProAvailable && status === ProStatus.Active;
}

/**
 * Returns true if pro is available, and the current user has expired pro.
 */
export function useCurrentUserHasExpiredPro() {
  const isProAvailable = useIsProAvailable();
  const status = useCurrentUserProStatus();

  return isProAvailable && status === ProStatus.Expired;
}

/**
 * Returns true if pro is available, but the current user has never had pro.
 * (i.e. the user does not have pro currently and doesn't have an expired pro either)
 */
export function useCurrentNeverHadPro() {
  const isProAvailable = useIsProAvailable();
  const status = useCurrentUserProStatus();

  return isProAvailable && status === ProStatus.NeverBeenPro;
}

// TODO: we have a disconnect in what state we use where for if the current user is pro, this needs to be looked into
export function useUserHasPro(convoId?: string) {
  const isProAvailable = useIsProAvailable();
  const userIsPro = useIsProUser(convoId);

  return isProAvailable && userIsPro;
}

function proAccessVariantToString(variant: ProAccessVariant): string {
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

function useMockProAccessExpiry(): number | null {
  const variant = useDataFeatureFlag('mockProAccessExpiry');

  // NOTE: the mock expiry time should be pinned to x - 250ms after "now", the -250ms ensures the string
  // representation rounds up to the expected mock value and prevents render lag from changing the timestamp
  const now = variant !== null ? Date.now() - 250 : 0;
  switch (variant) {
    case MockProAccessExpiryOptions.P7D:
      return now + 7 * 24 * 60 * 60 * 1000;
    case MockProAccessExpiryOptions.P29D:
      return now + 29 * 24 * 60 * 60 * 1000;
    case MockProAccessExpiryOptions.P30D:
      return now + 30 * 24 * 60 * 60 * 1000;
    case MockProAccessExpiryOptions.P30DT1S:
      return now + 30 * 24 * 60 * 61 * 1000;
    case MockProAccessExpiryOptions.P90D:
      return now + 90 * 24 * 60 * 60 * 1000;
    case MockProAccessExpiryOptions.P300D:
      return now + 300 * 24 * 60 * 60 * 1000;
    case MockProAccessExpiryOptions.P365D:
      return now + 365 * 24 * 60 * 60 * 1000;
    case MockProAccessExpiryOptions.P24DT1M:
      return now + 24 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000;
    case MockProAccessExpiryOptions.PT24H1M:
      return now + 24 * 60 * 60 * 1000 + 60 * 60 * 1000;
    case MockProAccessExpiryOptions.PT23H59M:
      return now + 23 * 60 * 60 * 1000 + 59 * 60 * 1000;
    case MockProAccessExpiryOptions.PT33M:
      return now + 33 * 60 * 1000;
    case MockProAccessExpiryOptions.PT1M:
      return now + 1 * 60 * 1000;
    case MockProAccessExpiryOptions.PT10S:
      return now + 10 * 1000;
    default:
      return null;
  }
}

function getProProviderConstantsWithFallbacks(provider: ProPaymentProvider) {
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

type ProAccessDetailsSourceData = {
  currentStatus: ProStatus;
  autoRenew: boolean;
  inGracePeriod: boolean;
  variant: ProAccessVariant;
  expiryTimeMs: number;
  isPlatformRefundAvailable: boolean;
  provider: ProPaymentProvider;
  isLoading: boolean;
  isError: boolean;
};

type RequestHook<D = unknown> = {
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  refetch: () => Promise<void>;
  data: D;
  t: number;
};

type ProAccessDetails = {
  currentStatus: ProStatus;
  autoRenew: boolean;
  inGracePeriod: boolean;
  variant: ProAccessVariant;
  variantString: string;
  expiryTimeMs: number;
  expiryTimeDateString: string;
  expiryTimeRelativeString: string;
  isPlatformRefundAvailable: boolean;
  provider: ProPaymentProvider;
  providerConstants: (typeof LIBSESSION_CONSTANTS)['LIBSESSION_PRO_PROVIDERS'][ProOriginatingPlatform];
};

// These values are used if pro isnt available or if no data is available from the backend.
const defaultProAccessDetailsSourceData = {
  currentStatus: ProStatus.NeverBeenPro,
  autoRenew: true,
  inGracePeriod: false,
  variant: ProAccessVariant.Nil,
  expiryTimeMs: 0,
  isPlatformRefundAvailable: false,
  provider: ProPaymentProvider.Nil,
  isLoading: false,
  isError: false,
} satisfies ProAccessDetailsSourceData;

function useMockRecoverAccess() {
  const forceUpdate = useUpdate();
  const mockSuccess = useFeatureFlag('mockProRecoverButtonAlwaysSucceed');
  const mockFail = useFeatureFlag('mockProRecoverButtonAlwaysFail');

  const mockRecover = useCallback(() => {
    if (!mockSuccess || mockFail) {
      return;
    }
    setDataFeatureFlag('mockProCurrentStatus', ProStatus.Active);
    setDataFeatureFlag('mockProAccessVariant', ProAccessVariant.OneMonth);
    setDataFeatureFlag('mockProAccessExpiry', MockProAccessExpiryOptions.P7D);
    forceUpdate();
  }, [mockSuccess, mockFail, forceUpdate]);

  return {
    mockSuccess,
    mockFail,
    mockRecover,
  };
}

export function useProAccessDetails(): RequestHook<ProAccessDetails> {
  const dispatch = useDispatch();

  const setProBackendIsLoading = useSetProBackendIsLoading();
  const setProBackendIsError = useSetProBackendIsError();

  const status = useProBackendProStatusData();
  const currentUserProStatus = useCurrentUserProStatus();

  const mockIsLoading = useFeatureFlag('mockProBackendLoading');
  const mockIsError = useFeatureFlag('mockProBackendError');
  const mockRecoverAccess = useMockRecoverAccess();

  const mockVariant = useDataFeatureFlag('mockProAccessVariant');
  const mockPlatform = useDataFeatureFlag('mockProPaymentProvider');
  const mockCancelled = useFeatureFlag('mockCurrentUserHasProCancelled');
  const mockInGracePeriod = useFeatureFlag('mockCurrentUserHasProInGracePeriod');
  const mockIsPlatformRefundAvailable = !useFeatureFlag(
    'mockCurrentUserHasProPlatformRefundExpired'
  );
  const mockExpiry = useMockProAccessExpiry();

  const isLoading = mockIsLoading || status.isLoading;
  const isFetching = mockIsLoading || status.isFetching;
  const isError = mockIsLoading ? false : mockIsError || status.isError;

  const t = status.t ?? 0;

  const data = useMemo(() => {
    const now = NetworkTime.now();

    const expiryTimeMs =
      mockExpiry ??
      status.data?.expiry_unix_ts_ms ??
      defaultProAccessDetailsSourceData.expiryTimeMs;

    const latestAccess = status?.data?.items?.[0];
    const provider =
      mockPlatform ?? latestAccess?.payment_provider ?? defaultProAccessDetailsSourceData.provider;
    const variant = mockVariant ?? latestAccess?.plan ?? defaultProAccessDetailsSourceData.variant;
    const isPlatformRefundAvailable =
      mockIsPlatformRefundAvailable ||
      (latestAccess?.platform_refund_expiry_unix_ts_ms &&
        now < latestAccess.platform_refund_expiry_unix_ts_ms) ||
      defaultProAccessDetailsSourceData.isPlatformRefundAvailable;

    const autoRenew = mockCancelled
      ? !mockCancelled
      : (status.data?.auto_renewing ?? defaultProAccessDetailsSourceData.autoRenew);
    const inGracePeriod =
      mockInGracePeriod ||
      !!(
        status.data?.grace_period_duration_ms &&
        now < expiryTimeMs + status.data.grace_period_duration_ms
      );

    return {
      currentStatus: currentUserProStatus,
      autoRenew,
      inGracePeriod,
      variant,
      variantString: proAccessVariantToString(variant),
      expiryTimeMs,
      expiryTimeDateString: formatDateWithLocale({
        date: new Date(expiryTimeMs),
        formatStr: 'MMM d, yyyy',
      }),
      expiryTimeRelativeString: formatRoundedUpTimeUntilTimestamp(expiryTimeMs),
      isPlatformRefundAvailable,
      provider,
      providerConstants: getProProviderConstantsWithFallbacks(provider),
    };
  }, [
    status.data,
    currentUserProStatus,
    mockVariant,
    mockPlatform,
    mockCancelled,
    mockInGracePeriod,
    mockIsPlatformRefundAvailable,
    mockExpiry,
  ]);

  const refetch = useCallback(async () => {
    if (mockIsLoading) {
      return;
    }

    if (mockIsError || mockRecoverAccess.mockFail) {
      setProBackendIsLoading({ key: 'proStatus', result: true });
      setProBackendIsError({ key: 'proStatus', result: false });
      await sleepFor(5000);
      setProBackendIsError({ key: 'proStatus', result: true });
      setProBackendIsLoading({ key: 'proStatus', result: false });
      return;
    }

    if (mockRecoverAccess.mockSuccess) {
      setProBackendIsLoading({ key: 'proStatus', result: true });
      setProBackendIsError({ key: 'proStatus', result: false });
      await sleepFor(5000);
      mockRecoverAccess.mockRecover();
      setProBackendIsLoading({ key: 'proStatus', result: false });
      return;
    }

    dispatch(proBackendDataActions.refreshProStatusFromProBackend() as any);
  }, [
    dispatch,
    mockIsLoading,
    mockIsError,
    mockRecoverAccess,
    setProBackendIsError,
    setProBackendIsLoading,
  ]);

  return {
    isLoading,
    isFetching,
    isError,
    refetch,
    data,
    t,
  };
}
