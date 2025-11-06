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
  DEV: ['showPopoverAnchors', 'debugInputCommands'],
  UNSUPPORTED: ['useTestNet', 'useLocalDevNet', 'fsTTL30s'],
  UNTESTED: ['disableOnionRequests', 'replaceLocalizedStringsWithKeys'],
};
