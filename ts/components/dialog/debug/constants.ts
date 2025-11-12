import { isDebugMode } from '../../../shared/env_vars';
import type {
  SessionBooleanFeatureFlagKeys,
  SessionDataFeatureFlagKeys,
} from '../../../state/ducks/types/releasedFeaturesReduxTypes';

type DebugFeatureFlagsType = {
  DEV: Array<SessionBooleanFeatureFlagKeys | SessionDataFeatureFlagKeys>;
  UNSUPPORTED: Array<SessionBooleanFeatureFlagKeys | SessionDataFeatureFlagKeys>;
  UNTESTED: Array<SessionBooleanFeatureFlagKeys | SessionDataFeatureFlagKeys>;
};

export const DEBUG_FEATURE_FLAGS: DebugFeatureFlagsType = {
  // NOTE Put new feature flags in here during development so they are not available in production environments. Remove from here when they are ready for QA and production
  DEV: ['showPopoverAnchors', 'debugInputCommands', 'proAvailable', 'useTestProBackend'],
  UNSUPPORTED: ['useTestNet', 'useLocalDevNet', 'fsTTL30s', 'proGroupsAvailable'],
  UNTESTED: ['disableOnionRequests', 'replaceLocalizedStringsWithKeys'],
};

export function isProdAvailableFeatureFlag(
  v: SessionBooleanFeatureFlagKeys | SessionDataFeatureFlagKeys
): boolean {
  return (
    !DEBUG_FEATURE_FLAGS.DEV.includes(v) &&
    !DEBUG_FEATURE_FLAGS.UNSUPPORTED.includes(v) &&
    !DEBUG_FEATURE_FLAGS.UNTESTED.includes(v) &&
    !v.startsWith('mock')
  );
}

export function isFeatureFlagAvailable(
  v: SessionBooleanFeatureFlagKeys | SessionDataFeatureFlagKeys
): boolean {
  return isDebugMode() || isProdAvailableFeatureFlag(v);
}
