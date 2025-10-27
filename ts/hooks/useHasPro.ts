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

// Mirrors backend enum
export enum ProOriginatingPlatform {
  Nil = 0,
  GooglePlayStore = 1,
  iOSAppStore = 2,
}

type OriginatingPlatformStrings = {
  platform: string;
  platform_store: string;
  platform_account: string;
  device_type: string;
  platform_store_other: string;
  platform_link_manage: string;
  platform_link_cancel: string;
  platform_link_refund: string;
  session_support_link_refund: string;
};

// TODO: This should all be set by libsession
const platformStoreGoogle = 'Google Play Store';
const platformStoreApple = 'Apple App Store';
const refundLinkSessionSupport = 'https://getsession.org/android-refund';

function proAccessOriginatingPlatformToStrings(
  platform: ProOriginatingPlatform
): OriginatingPlatformStrings {
  switch (platform) {
    case ProOriginatingPlatform.GooglePlayStore:
      return {
        platform: 'Google',
        platform_account: 'Google account',
        platform_store: platformStoreGoogle,
        platform_store_other: platformStoreApple,
        device_type: 'Android',
        platform_link_manage:
          'https://play.google.com/store/account/subscriptions?package=network.loki.messenger',
        // FIXME: set the sku dynamically if we dont use libsession
        platform_link_cancel:
          'https://play.google.com/store/account/subscriptions?package=network.loki.messenger&sku=SESSION_PRO_MONTHLY',
        platform_link_refund: 'https://support.google.com/googleplay/workflow/9813244?',
        session_support_link_refund: refundLinkSessionSupport,
      };
    case ProOriginatingPlatform.iOSAppStore:
      return {
        platform: 'Apple',
        platform_account: 'Apple account',
        platform_store: platformStoreApple,
        platform_store_other: platformStoreGoogle,
        device_type: 'iOS',
        platform_link_manage: 'https://apps.apple.com/account/subscriptions',
        platform_link_cancel: 'https://account.apple.com/account/manage/section/subscriptions',
        platform_link_refund: 'https://support.apple.com/118223',
        session_support_link_refund: refundLinkSessionSupport,
      };
    case ProOriginatingPlatform.Nil:
      return {
        platform: '',
        platform_account: '',
        platform_store: platformStoreGoogle,
        platform_store_other: platformStoreApple,
        device_type: '',
        platform_link_manage: '',
        platform_link_refund: '',
        platform_link_cancel: '',
        session_support_link_refund: refundLinkSessionSupport,
      };
    default:
      return assertUnreachable(platform, `Unknown pro originating platform: ${platform}`);
  }
}

function useMockProAccessExpiry() {
  const variant = useDataFeatureFlag('mockProAccessExpiry') ?? MockProAccessExpiryOptions.P30D;

  // NOTE: for testing the expiry time should be pinned to x + 250ms after "now", the +250ms prevents render lag from changing the timestamp
  const now = variant ? Date.now() + 250 : 0;
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
    const platform = mockPlatform;
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
      platform,
      platformStrings: proAccessOriginatingPlatformToStrings(platform),
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
