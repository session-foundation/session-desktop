import type { SessionFeatureFlagsKeys } from '../../../window';

type DebugFeatureFlagsType = {
  DEV: Array<SessionFeatureFlagsKeys>;
  UNSUPPORTED: Array<SessionFeatureFlagsKeys>;
  UNTESTED: Array<SessionFeatureFlagsKeys>;
};

export const DEBUG_FEATURE_FLAGS: DebugFeatureFlagsType = {
  DEV: ['useReleaseChannels'],
  UNSUPPORTED: ['useTestNet'],
  UNTESTED: ['useOnionRequests', 'useClosedGroupV3', 'replaceLocalizedStringsWithKeys'],
};
