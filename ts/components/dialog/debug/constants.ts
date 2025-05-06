import type { SessionFeatureFlagsKeys } from '../../../window';

type DebugFeatureFlagsType = {
  DEV: Array<SessionFeatureFlagsKeys>;
  UNSUPPORTED: Array<SessionFeatureFlagsKeys>;
  UNTESTED: Array<SessionFeatureFlagsKeys>;
};

export const DEBUG_FEATURE_FLAGS: DebugFeatureFlagsType = {
  // NOTE Put new feature flags in here during development so they are not available in production environments. Remove from here when they are ready for QA and production
  DEV: [],
  UNSUPPORTED: ['useTestNet'],
  UNTESTED: ['useOnionRequests', 'replaceLocalizedStringsWithKeys'],
};
