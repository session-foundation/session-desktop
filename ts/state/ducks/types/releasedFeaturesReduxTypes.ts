import { DURATION } from '../../../session/constants';
import type { RecursiveKeys } from '../../../types/Util';

export type SessionFeatureFlags = {
  replaceLocalizedStringsWithKeys: boolean;
  // Hooks
  useOnionRequests: boolean;
  useTestNet: boolean;
  useClosedGroupV2QAButtons: boolean;
  useReleaseChannels: boolean;
  useSESH101: boolean;
};

export type SessionFeatureFlagKeys = RecursiveKeys<SessionFeatureFlags>;

/**
 * Check if the given flag is a Feature flag.
 * @note debug flags are not included in this check
 */
export const isSessionFeatureFlag = (flag: unknown): flag is SessionFeatureFlagKeys => {
  const strFlag = flag as string;
  return !strFlag.startsWith('debug') && Object.keys(window.sessionFeatureFlags).includes(strFlag);
};

export type SessionFlags = SessionFeatureFlags & {
  debug: {
    debugLogging: boolean;
    debugLibsessionDumps: boolean;
    debugBuiltSnodeRequests: boolean;
    debugSwarmPolling: boolean;
    debugServerRequests: boolean;
    debugNonSnodeRequests: boolean;
    debugOnionRequests: boolean;
  };
};

export type SessionFlagsKeys = RecursiveKeys<SessionFlags>;

/**
 * 1 second in milliseconds
 */
export const FEATURE_RELEASE_CHECK_INTERVAL = 1 * DURATION.SECONDS;
