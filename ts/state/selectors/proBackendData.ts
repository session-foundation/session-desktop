import { useSelector } from 'react-redux';
import { ProOriginatingPlatform } from 'libsession_util_nodejs';
import { zodSafeParse } from '../../util/zod';
import type { StateType } from '../reducer';
import { type ProBackendDataState } from '../ducks/proBackendData';
import { SettingsKey } from '../../data/settings-key';
import { Storage } from '../../util/storage';
import { ProDetailsResultSchema } from '../../session/apis/pro_backend_api/schemas';
import {
  getDataFeatureFlag,
  getFeatureFlag,
  MockProAccessExpiryOptions,
} from '../ducks/types/releasedFeaturesReduxTypes';
import {
  getProProviderConstantsWithFallbacks,
  proAccessVariantToString,
} from '../../hooks/useHasPro';
import { NetworkTime } from '../../util/NetworkTime';
import {
  formatDateWithLocale,
  formatRoundedUpTimeUntilTimestamp,
} from '../../util/i18n/formatting/generics';
import {
  ProAccessVariant,
  ProPaymentProvider,
  ProStatus,
} from '../../session/apis/pro_backend_api/types';
import LIBSESSION_CONSTANTS from '../../session/utils/libsession/libsession_constants';

export const getProBackendData = (state: StateType): ProBackendDataState => {
  return state.proBackendData;
};

export function getProDetailsFromStorage() {
  const response = Storage.get(SettingsKey.proDetails);
  if (!response) {
    return null;
  }
  const result = zodSafeParse(ProDetailsResultSchema, response);
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

function getMockedProAccessExpiry(variant: MockProAccessExpiryOptions): number | null {
  switch (variant) {
    case MockProAccessExpiryOptions.P7D:
      return 7 * 24 * 60 * 60 * 1000;
    case MockProAccessExpiryOptions.P29D:
      return 29 * 24 * 60 * 60 * 1000;
    case MockProAccessExpiryOptions.P30D:
      return 30 * 24 * 60 * 60 * 1000;
    case MockProAccessExpiryOptions.P30DT1S:
      return 30 * 24 * 60 * 61 * 1000;
    case MockProAccessExpiryOptions.P90D:
      return 90 * 24 * 60 * 60 * 1000;
    case MockProAccessExpiryOptions.P300D:
      return 300 * 24 * 60 * 60 * 1000;
    case MockProAccessExpiryOptions.P365D:
      return 365 * 24 * 60 * 60 * 1000;
    case MockProAccessExpiryOptions.P24DT1M:
      return 24 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000;
    case MockProAccessExpiryOptions.PT24H1M:
      return 24 * 60 * 60 * 1000 + 60 * 60 * 1000;
    case MockProAccessExpiryOptions.PT23H59M:
      return 23 * 60 * 60 * 1000 + 59 * 60 * 1000;
    case MockProAccessExpiryOptions.PT33M:
      return 33 * 60 * 1000;
    case MockProAccessExpiryOptions.PT1M:
      return 1 * 60 * 1000;
    case MockProAccessExpiryOptions.PT10S:
      return 10 * 1000;
    default:
      return null;
  }
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
export const defaultProAccessDetailsSourceData = {
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

export type ProcessedProDetails = {
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  data: ProAccessDetails;
  t: number;
};

function processProBackendData({
  isLoading: _isLoading,
  isFetching: _isFetching,
  isError: _isError,
  data,
  t,
}: ProBackendDataState['details']): ProcessedProDetails {
  const mockIsLoading = getFeatureFlag('mockProBackendLoading');
  const mockIsError = getFeatureFlag('mockProBackendError');

  const mockVariant = getDataFeatureFlag('mockProAccessVariant');
  const mockPlatform = getDataFeatureFlag('mockProPaymentProvider');
  const mockCancelled = getFeatureFlag('mockCurrentUserHasProCancelled');
  const mockInGracePeriod = getFeatureFlag('mockCurrentUserHasProInGracePeriod');
  const mockIsPlatformRefundAvailable = !getFeatureFlag(
    'mockCurrentUserHasProPlatformRefundExpired'
  );
  const expiryVariant = getDataFeatureFlag('mockProAccessExpiry');
  const mockedExpiryDuration =
    expiryVariant !== null ? getMockedProAccessExpiry(expiryVariant) : null;
  let mockExpiry = null;
  if (mockedExpiryDuration !== null) {
    // NOTE: the mock expiry time should be pinned to x - 250ms after "now", the -250ms ensures the string
    // representation rounds up to the expected mock value and prevents render lag from changing the timestamp
    const now = Date.now() - 250;
    mockExpiry = now + mockedExpiryDuration;
  }

  const isLoading = mockIsLoading || _isLoading;
  const isFetching = mockIsLoading || _isFetching;
  const isError = mockIsLoading ? false : mockIsError || _isError;

  const now = NetworkTime.now();

  const expiryTimeMs =
    mockExpiry ?? data?.expiry_unix_ts_ms ?? defaultProAccessDetailsSourceData.expiryTimeMs;

  const latestAccess = data?.items?.[0];
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
    : (data?.auto_renewing ?? defaultProAccessDetailsSourceData.autoRenew);

  let beginAutoRenew = 0;
  if (data) {
    beginAutoRenew = data.expiry_unix_ts_ms - data.grace_period_duration_ms;
  }

  let inGracePeriod = mockInGracePeriod;
  if (beginAutoRenew && !mockInGracePeriod) {
    inGracePeriod = autoRenew && now >= beginAutoRenew && now < expiryTimeMs;
  }

  return {
    data: {
      currentStatus: data?.status ?? defaultProAccessDetailsSourceData.currentStatus,
      autoRenew,
      inGracePeriod,
      variant,
      variantString: proAccessVariantToString(variant),
      expiryTimeMs,
      expiryTimeDateString: formatDateWithLocale({
        date: new Date(beginAutoRenew),
        formatStr: 'MMM d, yyyy',
      }),
      expiryTimeRelativeString: formatRoundedUpTimeUntilTimestamp(beginAutoRenew),
      isPlatformRefundAvailable,
      provider,
      providerConstants: getProProviderConstantsWithFallbacks(provider),
    },
    isLoading,
    isFetching,
    isError,
    t,
  };
}

export const getProBackendProDetails = (state: StateType): ProcessedProDetails => {
  const details = getProBackendData(state).details;
  const mergedDetails = details.data ? details : { ...details, data: getProDetailsFromStorage() };

  return processProBackendData(mergedDetails);
};

export const getProBackendCurrentUserStatus = (state: StateType) => {
  return getProBackendProDetails(state).data?.currentStatus;
};

export const useProBackendCurrentUserStatus = () => {
  return useSelector(getProBackendCurrentUserStatus);
};
