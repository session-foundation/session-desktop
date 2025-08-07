import type { ProMessageFeature } from '../../../models/proMessageFeature';
import { DURATION } from '../../../session/constants';

export type SessionFeatureFlags = {
  replaceLocalizedStringsWithKeys: boolean;
  // Hooks
  useOnionRequests: boolean;
  useTestNet: boolean;
  useLocalDevNet: string;
  useClosedGroupV2QAButtons: boolean;
  alwaysShowRemainingChars: boolean;
  showPopoverAnchors: boolean;
  debugInputCommands: boolean;
  proAvailable: boolean;
  mockCurrentUserHasPro: boolean;
  mockOthersHavePro: boolean;
  mockMessageProFeatures: Array<ProMessageFeature>;
  fsTTL30s: boolean;
};

export type SessionFeatureFlagKeys = keyof SessionFeatureFlags;

/**
 * Check if the given flag is a Feature flag.
 * @note debug flags are not included in this check
 */
export const isSessionFeatureFlag = (flag: unknown): flag is SessionFeatureFlagKeys => {
  const strFlag = flag as string;
  return !strFlag.startsWith('debug') && Object.keys(window.sessionFeatureFlags).includes(strFlag);
};

export const getFeatureFlag = <T extends SessionFeatureFlagKeys>(flag: T) =>
  window.sessionFeatureFlags[flag];
export const useFeatureFlag = <T extends SessionFeatureFlagKeys>(flag: T) => getFeatureFlag(flag);

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
