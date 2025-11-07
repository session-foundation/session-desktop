import { getFeatureFlag } from '../state/ducks/types/releasedFeaturesReduxTypes';

function envAppInstanceIncludes(toInclude: string) {
  if (!process.env.NODE_APP_INSTANCE) {
    return false;
  }
  return !!process.env.NODE_APP_INSTANCE.includes(toInclude);
}

export function isDevProd() {
  return envAppInstanceIncludes('devprod');
}

export function isTestNet() {
  return envAppInstanceIncludes('testnet');
}

export function isProd() {
  return !process.env.NODE_APP_INSTANCE;
}

export function isTestIntegration() {
  return envAppInstanceIncludes('test-integration');
}

export function hasClosedGroupV2QAButtons() {
  return getFeatureFlag('useClosedGroupV2QAButtons');
}

export function isUnitTest() {
  return !!process.env.IS_UNIT_TEST;
}

export function isDebugMode() {
  return !!process.env.SESSION_DEV;
}
