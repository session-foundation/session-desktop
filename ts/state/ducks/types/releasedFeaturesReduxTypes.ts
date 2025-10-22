import { ProAccessVariant, ProOriginatingPlatform } from '../../../hooks/useHasPro';
import type { ProMessageFeature } from '../../../models/proMessageFeature';
import { DURATION } from '../../../session/constants';

export type SessionFeatureFlags = {
  replaceLocalizedStringsWithKeys: boolean;
  // Hooks
  useOnionRequests: boolean;
  useDeterministicEncryption: boolean;
  useTestNet: boolean;
  useLocalDevNet: string;
  useClosedGroupV2QAButtons: boolean;
  alwaysShowRemainingChars: boolean;
  showPopoverAnchors: boolean;
  debugInputCommands: boolean;
  proAvailable: boolean;
  proGroupsAvailable: boolean;
  mockCurrentUserHasPro: boolean;
  mockCurrentUserHasProExpired: boolean;
  mockCurrentUserHasProPlatformRefundExpired: boolean;
  mockCurrentUserHasProCancelled: boolean;
  mockCurrentUserHasProInGracePeriod: boolean;
  mockProRecoverButtonAlwaysSucceed: boolean;
  mockProRecoverButtonAlwaysFail: boolean;
  mockOthersHavePro: boolean;
  mockMessageProFeatures: Array<ProMessageFeature>;
  mockProBackendLoading: boolean;
  mockProBackendError: boolean;
  fsTTL30s: boolean;
};

export enum MockProAccessExpiryOptions {
  SOON = 0,
  TODAY = 1,
  TOMORROW = 2,
  WEEK = 3,
  MONTH = 4,
  THREE_MONTH = 5,
  YEAR = 6,
  // The following are test cases from the PRD in ISO8601 duration format
  P24DT1M = 7,
  PT24H1M = 8,
  PT23H59M = 9,
  PT33M = 10,
  PT1M = 11,
  PT10S = 12,
}

export type SessionFeatureFlagsWithData = {
  mockProOriginatingPlatform: ProOriginatingPlatform | null;
  mockProAccessVariant: ProAccessVariant | null;
  mockProAccessExpiry: MockProAccessExpiryOptions | null;
};

export type SessionFeatureFlagKeys = keyof SessionFeatureFlags;
export type SessionFeatureFlagWithDataKeys = keyof SessionFeatureFlagsWithData;

/**
 * Check if the given flag is a Feature flag.
 * @note debug flags are not included in this check
 * @note data flags are not included in this check
 */
export const isSessionFeatureFlag = (flag: unknown): flag is SessionFeatureFlagKeys => {
  const strFlag = flag as string;
  return !strFlag.startsWith('debug') && Object.keys(window.sessionFeatureFlags).includes(strFlag);
};

export const getFeatureFlag = <T extends SessionFeatureFlagKeys>(flag: T) =>
  window.sessionFeatureFlags[flag];
export const useFeatureFlag = <T extends SessionFeatureFlagKeys>(flag: T) => getFeatureFlag(flag);

/**
 * Check if the given flag is a Feature flag with data.
 * @note debug flags are not included in this check
 * @node boolean flags are not included in this check
 */
export const isSessionFeatureFlagWithData = (
  flag: unknown
): flag is SessionFeatureFlagWithDataKeys => {
  const strFlag = flag as string;
  return !strFlag.startsWith('debug') && Object.keys(window.sessionFeatureFlags).includes(strFlag);
};
export const getDataFeatureFlag = <T extends SessionFeatureFlagWithDataKeys>(flag: T) =>
  window.sessionFeatureFlagsWithData[flag];
export const useDataFeatureFlag = <T extends SessionFeatureFlagWithDataKeys>(flag: T) =>
  getDataFeatureFlag(flag);

export type SessionFlags = SessionFeatureFlags & {
  debugLogging: boolean;
  debugLibsessionDumps: boolean;
  debugBuiltSnodeRequests: boolean;
  debugSwarmPolling: boolean;
  debugServerRequests: boolean;
  debugNonSnodeRequests: boolean;
  debugOnionRequests: boolean;
};

export type SessionFlagsKeys = keyof SessionFlags;

/**
 * 1 second in milliseconds
 */
export const FEATURE_RELEASE_CHECK_INTERVAL = 1 * DURATION.SECONDS;
