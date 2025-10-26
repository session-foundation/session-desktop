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
  return !!window.sessionFeatureFlags.useClosedGroupV2QAButtons;
}

export function isUnitTest() {
  return !!process.env.IS_UNIT_TEST;
}

export function isDebugMode() {
  return !!process.env.SESSION_DEV;
}

/**
 * Returns true when any kind of avatars/attachments should not be downloaded.
 * This is for our users with an issue with sharp that makes the app crashes.
 */
export function skipAttachmentsDownloads() {
  return !!process.env.SESSION_SKIP_ATTACHMENTS_DOWNLOADS;
}
