import { useCallback, useMemo } from 'react';
import { UserUtils } from '../session/utils';
import {
  MockProAccessExpiryOptions,
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

/**
 * Returns true if pro is available, and the current user has pro (active, not expired)
 */
export function useCurrentUserHasPro() {
  const isProAvailable = useIsProAvailable();
  const weArePro = useIsProUser(UserUtils.getOurPubKeyStrFromCache());

  return isProAvailable && weArePro;
}

/**
 * Returns true if pro is available, and the current user has expired pro.
 */
export function useCurrentUserHasExpiredPro() {
  const isProAvailable = useIsProAvailable();
  // FIXME: we will need to have this coming from libsession (and stored in redux I guess)

  return isProAvailable && window.sessionFeatureFlags.mockCurrentUserHasProExpired;
}

/**
 * Returns true if pro is available, but the current user has never had pro.
 * (i.e. the user does not have pro currently and doesn't have an expired pro either)
 */
export function useCurrentNeverHadPro() {
  const isProAvailable = useIsProAvailable();
  const currentUserHasPro = useCurrentUserHasPro();
  const currentUserHasExpiredPro = useCurrentUserHasExpiredPro();
  return isProAvailable && !currentUserHasPro && !currentUserHasExpiredPro;
}

export function useUserHasPro(convoId?: string) {
  const isProAvailable = useIsProAvailable();
  const userIsPro = useIsProUser(convoId);

  return isProAvailable && userIsPro;
}

// Mirrors backend enum
export enum ProAccessVariant {
  Nil = 0,
  OneMonth = 1,
  ThreeMonth = 2,
  TwelveMonth = 3,
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

// Mirrors backend enum -- matched with libsession-util-nodejs/types/pro/pro.d.ts
export enum ProOriginatingPlatform {
  Nil = 'Nil',
  GooglePlayStore = 'Google',
  iOSAppStore = 'iOS',
}

function useMockProAccessExpiry() {
  const variant = useDataFeatureFlag('mockProAccessExpiry') ?? MockProAccessExpiryOptions.MONTH;

  // NOTE: for testing the expiry time should be pinned to x time after "now"
  const now = variant ? Date.now() : 0;
  switch (variant) {
    case MockProAccessExpiryOptions.SOON:
      return now + 600 * 1000;
    case MockProAccessExpiryOptions.TODAY:
      return now + 12 * 60 * 60 * 1000;
    case MockProAccessExpiryOptions.TOMORROW:
      return now + 26 * 60 * 60 * 1000;
    case MockProAccessExpiryOptions.WEEK:
      return now + 8 * 24 * 60 * 60 * 1000;
    case MockProAccessExpiryOptions.MONTH:
      return now + 30 * 24 * 60 * 60 * 1000;
    case MockProAccessExpiryOptions.THREE_MONTH:
      return now + 90 * 24 * 60 * 60 * 1000;
    case MockProAccessExpiryOptions.YEAR:
      return now + 12 * 30 * 24 * 60 * 60 * 1000;
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
      return 0;
  }
}

// TODO: implement real deta fetching and move this to an appropriate place
export function useProAccessDetails() {
  const mockIsLoading = useFeatureFlag('mockProBackendLoading');
  const mockIsError = useFeatureFlag('mockProBackendError');

  // FIXME: These should not have defaults, but we need them for now as its the only way to get data
  const mockVariant = useDataFeatureFlag('mockProAccessVariant') ?? ProAccessVariant.OneMonth;
  const mockPlatform =
    useDataFeatureFlag('mockProOriginatingPlatform') ?? ProOriginatingPlatform.GooglePlayStore;
  const mockCancelled = useFeatureFlag('mockCurrentUserHasProCancelled') ?? false;
  const mockInGracePeriod = useFeatureFlag('mockCurrentUserHasProInGracePeriod') ?? false;
  const mockIsPlatformRefundAvailable = !useFeatureFlag(
    'mockCurrentUserHasProPlatformRefundExpired'
  );
  const mockExpiry = useMockProAccessExpiry();

  const isLoading = mockIsLoading;

  const data = useMemo(() => {
    // FIXME: implement non-mock data fetching and parsing here
    const variant = mockVariant;
    const expiryTimeMs = mockExpiry;
    const provider = mockPlatform;
    return {
      autoRenew: !mockCancelled,
      inGracePeriod: mockInGracePeriod,
      variant,
      variantString: proAccessVariantToString(variant),
      expiryTimeMs,
      expiryTimeDateString: formatDateWithLocale({
        date: new Date(expiryTimeMs),
        formatStr: 'MMM d, yyyy',
      }),
      expiryTimeRelativeString: formatRoundedUpTimeUntilTimestamp(expiryTimeMs),
      isPlatformRefundAvailable: mockIsPlatformRefundAvailable,
      provider,
      providerConstants: LIBSESSION_CONSTANTS.LIBSESSION_PRO_PROVIDERS[provider],
    };
  }, [
    mockVariant,
    mockPlatform,
    mockCancelled,
    mockInGracePeriod,
    mockIsPlatformRefundAvailable,
    mockExpiry,
  ]);

  const refetch = useCallback(() => {
    if (isLoading) {
      return;
    }
    if (mockIsError) {
      window.sessionFeatureFlags.mockProBackendLoading = true;
      window.sessionFeatureFlags.mockProBackendError = false;
      setTimeout(() => {
        window.sessionFeatureFlags.mockProBackendError = true;
        window.sessionFeatureFlags.mockProBackendLoading = false;
      }, 5000);
    }
    // TODO: Add non-mock pro backend refetch logic
  }, [mockIsError, isLoading]);

  return {
    isLoading,
    isError: mockIsError,
    refetch,
    data,
  };
}
