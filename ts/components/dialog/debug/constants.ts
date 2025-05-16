import type { SessionFlagsKeys } from '../../../state/ducks/types/releasedFeaturesReduxTypes';

type DebugFeatureFlagsType = {
  DEV: Array<SessionFlagsKeys>;
  UNSUPPORTED: Array<SessionFlagsKeys>;
  UNTESTED: Array<SessionFlagsKeys>;
};

export const DEBUG_FEATURE_FLAGS: DebugFeatureFlagsType = {
  // NOTE Put new feature flags in here during development so they are not available in production environments. Remove from here when they are ready for QA and production
  DEV: [],
  UNSUPPORTED: ['useTestNet'],
  UNTESTED: ['useOnionRequests', 'replaceLocalizedStringsWithKeys'],
};
