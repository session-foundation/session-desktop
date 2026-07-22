import { useSelector } from 'react-redux';
import type { StateType } from '../reducer';
import {
  proBackendDataActions,
  PRO_DETAILS_CACHE_VERSION,
  RequestActionArgs,
  WithCallerContext,
  type ProBackendDataState,
} from '../ducks/proBackendData';
import { SettingsKey } from '../../data/settings-key';
import { Storage } from '../../util/storage';
import type { ProDetailsResultType } from '../../session/apis/pro_backend_api/schemas';
import {
  getDataFeatureFlag,
  getFeatureFlag,
  getFeatureFlagMemo,
  MockProAccessExpiryOptions,
} from '../ducks/types/releasedFeaturesReduxTypes';
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
import { isSimpleTokenNoArgs, tr } from '../../localization/localeTools';
import { getAppDispatch } from '../dispatch';
import { sleepFor } from '../../session/utils/Promise';

const getProBackendData = (state: StateType): ProBackendDataState => {
  return state.proBackendData;
};

function getProDetailsFromStorage(): ProDetailsResultType | null {
  const stored = Storage.get(SettingsKey.proDetails) as
    | { version?: number; data?: ProDetailsResultType }
    | null
    | undefined;
  if (!stored) {
    return null;
  }
  // We persist the libsession-parsed struct verbatim (see putProDetailsInStorage), wrapped with a
  // version. There's no hand-rolled schema to validate against, so we only drop a cache whose version
  // doesn't match the current shape (an older client's stale shape — e.g. missing a newly-required
  // field — must not be mis-read against the current type) or that is obviously malformed. Anything
  // dropped is re-fetched on the next poll. (The pre-versioning format has no `version` and is dropped
  // here too.)
  const data = stored.version === PRO_DETAILS_CACHE_VERSION ? stored.data : undefined;
  if (data && typeof data === 'object' && Array.isArray(data.items)) {
    return data;
  }
  void Storage.remove(SettingsKey.proDetails);
  window?.log?.error('pro details in storage were stale/malformed; removing.');
  return null;
}

export function proAccessVariantToString(variant: ProAccessVariant): string {
  switch (variant) {
    case ProAccessVariant.OneMonth:
      return '1 Month';
    case ProAccessVariant.ThreeMonth:
      return '3 Months';
    case ProAccessVariant.TwelveMonth:
      return '12 Months';
    default:
      // '' (none) or an unrecognized/future billing-period slug.
      return 'N/A';
  }
}

/**
 * Per-provider display strings. Client-owned i18n now (Delta #10) — libsession no longer supplies them.
 * URLs are NOT here: they're only needed for link clicks and are fetched on demand via
 * ProWrapperActions.providerUrls(slug). Resolved dynamically from `pro_provider_<slug>_<suffix>` tokens
 * (a temporary stopgap injected into the generated localization; wiped by the next Crowdin sync, so
 * upstream them first), so a new provider needs only translations, not a code change.
 */
export type ProviderDisplayConstants = {
  store: string;
  platform: string;
  device: string;
  platform_account: string;
};

/**
 * Resolve one provider display field for [slug]: the localized `pro_provider_<slug>_<suffix>` if that token
 * exists, else the raw slug (an unknown/untranslated provider degrades to its slug — the same
 * "gate on the translation existing" rule used by the {pro_stores} list).
 */
function providerDisplay(slug: string, suffix: 'platform' | 'store' | 'device' | 'account'): string {
  const token = `pro_provider_${slug}_${suffix}`;
  return isSimpleTokenNoArgs(token) ? tr(token) : slug;
}

export function getProProviderConstantsWithFallbacks(
  provider: ProPaymentProvider
): ProviderDisplayConstants {
  return {
    store: providerDisplay(provider, 'store'),
    platform: providerDisplay(provider, 'platform'),
    device: providerDisplay(provider, 'device'),
    platform_account: providerDisplay(provider, 'account'),
  };
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
  isProcessingRefund: boolean;
  variant: ProAccessVariant;
  variantString: string;
  expiryTimeMs: number;
  expiryTimeDateString: string;
  expiryTimeRelativeString: string;
  isPlatformRefundAvailable: boolean;
  provider: ProPaymentProvider;
  providerConstants: ProviderDisplayConstants;
};

// These values are used if pro isnt available or if no data is available from the backend.
export const defaultProAccessDetailsSourceData = {
  currentStatus: ProStatus.NeverBeenPro,
  autoRenew: true,
  inGracePeriod: false,
  variant: '',
  expiryTimeMs: 0,
  isPlatformRefundAvailable: false,
  provider: '',
  isLoading: false,
  isError: false,
} satisfies ProAccessDetailsSourceData;

export type ProcessedProDetails = {
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  data: ProAccessDetails;
};

function processProBackendData({
  isLoading: _isLoading,
  isFetching: _isFetching,
  isError: _isError,
  data,
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
    mockExpiry ?? data?.expiryMs ?? defaultProAccessDetailsSourceData.expiryTimeMs;

  const latestAccess = data?.items?.[0];
  const provider =
    mockPlatform ?? latestAccess?.paymentProvider ?? defaultProAccessDetailsSourceData.provider;
  const variant = mockVariant ?? latestAccess?.plan ?? defaultProAccessDetailsSourceData.variant;
  const isPlatformRefundAvailable =
    mockIsPlatformRefundAvailable ||
    (latestAccess?.platformRefundExpiryTsMs &&
      now < latestAccess.platformRefundExpiryTsMs) ||
    defaultProAccessDetailsSourceData.isPlatformRefundAvailable;

  const autoRenew = mockCancelled
    ? !mockCancelled
    : (data?.autoRenewing ?? defaultProAccessDetailsSourceData.autoRenew);

  let beginAutoRenew = 0;
  if (data) {
    beginAutoRenew = data.expiryMs - data.gracePeriodDurationMs;
  }

  let inGracePeriod = mockInGracePeriod;
  if (beginAutoRenew && !mockInGracePeriod) {
    inGracePeriod = autoRenew && now >= beginAutoRenew && now < expiryTimeMs;
  }

  const isProcessingRefund = !!data?.refundRequestedTsMs;

  return {
    data: {
      currentStatus: data?.userStatus ?? defaultProAccessDetailsSourceData.currentStatus,
      autoRenew,
      inGracePeriod,
      isProcessingRefund,
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

export const useProBackendProDetails = () => {
  return useSelector(getProBackendProDetails);
};

export const useProBackendCurrentUserStatus = () => {
  return useSelector(getProBackendCurrentUserStatus);
};

export function useProBackendRefetch() {
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

  return refetch;
}
