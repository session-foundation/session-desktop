import type { ProMessageFeature } from '../../../models/proMessageFeature';
import {
  ProAccessVariant,
  ProPaymentProvider,
  ProStatus,
} from '../../../session/apis/pro_backend_api/types';
import { DURATION } from '../../../session/constants';

type SessionBaseBooleanFeatureFlags = {
  replaceLocalizedStringsWithKeys: boolean;
  disableOnionRequests: boolean;
  useDeterministicEncryption: boolean;
  useTestNet: boolean;
  useClosedGroupV2QAButtons: boolean;
  alwaysShowRemainingChars: boolean;
  showPopoverAnchors: boolean;
  debugInputCommands: boolean;
  proAvailable: boolean;
  proGroupsAvailable: boolean;
  mockCurrentUserHasProPlatformRefundExpired: boolean;
  mockCurrentUserHasProCancelled: boolean;
  mockCurrentUserHasProInGracePeriod: boolean;
  mockProRecoverButtonAlwaysSucceed: boolean;
  mockProRecoverButtonAlwaysFail: boolean;
  mockOthersHavePro: boolean;
  mockProBackendLoading: boolean;
  mockProBackendError: boolean;
  fsTTL30s: boolean;
};

export type SessionDebugBooleanFeatureFlags = {
  debugLogging: boolean;
  debugLibsessionDumps: boolean;
  debugBuiltSnodeRequests: boolean;
  debugSwarmPolling: boolean;
  debugServerRequests: boolean;
  debugNonSnodeRequests: boolean;
  debugOnionRequests: boolean;
};

export type SessionBooleanFeatureFlags = SessionBaseBooleanFeatureFlags &
  SessionDebugBooleanFeatureFlags;

// ISO8601 duration format
export enum MockProAccessExpiryOptions {
  P7D = 0,
  P29D = 1,
  P30D = 2,
  P30DT1S = 3,
  P90D = 4,
  P300D = 5,
  P365D = 6,
  // The following are test cases from the PRD
  P24DT1M = 7,
  PT24H1M = 8,
  PT23H59M = 9,
  PT33M = 10,
  PT1M = 11,
  PT10S = 12,
}

export type SessionDataFeatureFlags = {
  useLocalDevNet: string | null;
  mockMessageProFeatures: Array<ProMessageFeature> | null;
  mockProCurrentStatus: ProStatus | null;
  mockProPaymentProvider: ProPaymentProvider | null;
  mockProAccessVariant: ProAccessVariant | null;
  mockProAccessExpiry: MockProAccessExpiryOptions | null;
  mockProLongerMessagesSent: number | null;
  mockProPinnedConversations: number | null;
  mockProBadgesSent: number | null;
  mockProGroupsUpgraded: number | null;
};

export type SessionBooleanFeatureFlagKeys = keyof SessionBooleanFeatureFlags;
export type SessionDataFeatureFlagKeys = keyof SessionDataFeatureFlags;

/**
 * Check if the given flag is a Feature flag.
 * @note debug flags are not included in this check
 * @note data flags are not included in this check
 */
export const isSessionFeatureFlag = (flag: unknown): flag is SessionBooleanFeatureFlagKeys => {
  const strFlag = flag as string;
  return (
    !strFlag.startsWith('debug') && Object.keys(window.sessionBooleanFeatureFlags).includes(strFlag)
  );
};

export const getFeatureFlag = <T extends SessionBooleanFeatureFlagKeys>(flag: T) =>
  !!window?.sessionBooleanFeatureFlags?.[flag];

export const useFeatureFlag = <T extends SessionBooleanFeatureFlagKeys>(flag: T) =>
  getFeatureFlag<T>(flag);

export const setFeatureFlag = <T extends SessionBooleanFeatureFlagKeys>(
  flag: T,
  value: boolean
) => {
  if (window?.sessionBooleanFeatureFlags && flag in window.sessionBooleanFeatureFlags) {
    window.sessionBooleanFeatureFlags[flag] = value;
  }
};

/**
 * Check if the given flag is a Feature flag with data.
 * @note debug flags are not included in this check
 * @note boolean flags are not included in this check
 */
export const isSessionDataFeatureFlag = (flag: unknown): flag is SessionDataFeatureFlagKeys => {
  const strFlag = flag as string;
  return (
    !strFlag.startsWith('debug') && Object.keys(window.sessionDataFeatureFlags).includes(strFlag)
  );
};
export const getDataFeatureFlag = <T extends SessionDataFeatureFlagKeys>(
  flag: T
): SessionDataFeatureFlags[T] | null => window?.sessionDataFeatureFlags?.[flag] ?? null;
export const useDataFeatureFlag = <T extends SessionDataFeatureFlagKeys>(
  flag: T
): SessionDataFeatureFlags[T] | null => getDataFeatureFlag<T>(flag);

export const setDataFeatureFlag = <T extends SessionDataFeatureFlagKeys>(
  flag: T,
  value: SessionDataFeatureFlags[T]
) => {
  if (window?.sessionDataFeatureFlags && flag in window.sessionDataFeatureFlags) {
    window.sessionDataFeatureFlags[flag] = value;
  }
};

/**
 * 1 second in milliseconds
 */
export const FEATURE_RELEASE_CHECK_INTERVAL = 1 * DURATION.SECONDS;
