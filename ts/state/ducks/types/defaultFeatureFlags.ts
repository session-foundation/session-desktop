import { isEmpty } from 'lodash';
import { isTestIntegration, isTestNet } from '../../../shared/env_vars';
import { ProStatus } from '../../../session/apis/pro_backend_api/types';
import {
  MockProAccessExpiryOptions,
  type SessionBooleanFeatureFlags,
  type SessionDataFeatureFlags,
} from './releasedFeaturesReduxTypes';

export const defaultProBooleanFeatureFlags = {
  proAvailable: !isEmpty(process.env.SESSION_PRO),
  proGroupsAvailable: !isEmpty(process.env.SESSION_PRO_GROUPS),
  useTestProBackend: !isEmpty(process.env.TEST_PRO_BACKEND),
  mockCurrentUserHasProPlatformRefundExpired: !isEmpty(
    process.env.SESSION_USER_HAS_PRO_PLATFORM_REFUND_EXPIRED
  ),
  mockCurrentUserHasProCancelled: !isEmpty(process.env.SESSION_USER_HAS_PRO_CANCELLED),
  mockCurrentUserHasProInGracePeriod: !isEmpty(process.env.SESSION_USER_HAS_PRO_IN_GRACE),
  mockProRecoverButtonAlwaysSucceed: !isEmpty(process.env.SESSION_PRO_RECOVER_ALWAYS_SUCCEED),
  mockProRecoverButtonAlwaysFail: !isEmpty(process.env.SESSION_PRO_RECOVER_ALWAYS_FAIL),
  mockProBackendLoading: !isEmpty(process.env.SESSION_PRO_BACKEND_LOADING),
  mockProBackendError: !isEmpty(process.env.SESSION_PRO_BACKEND_ERROR),
} as const;

export const defaultBooleanFeatureFlags = {
  ...defaultProBooleanFeatureFlags,
  replaceLocalizedStringsWithKeys: false,
  useClosedGroupV2QAButtons: !isEmpty(process.env.GROUPV2_QA_BUTTONS),
  useDeterministicEncryption: !isEmpty(process.env.SESSION_ATTACH_DETERMINISTIC_ENCRYPTION),
  disableOnionRequests: false,
  disableImageProcessor: !isEmpty(process.env.SESSION_DISABLE_IMAGE_PROCESSOR),
  disableLocalAttachmentEncryption: !isEmpty(
    process.env.SESSION_DISABLE_LOCAL_ATTACHMENT_ENCRYPTION
  ),
  canToggleGiphy: !isEmpty(process.env.SESSION_CAN_TOGGLE_GIPHY),
  useTestNet: isTestNet() || isTestIntegration(),
  debugInputCommands: !isEmpty(process.env.SESSION_DEBUG),
  alwaysShowRemainingChars: false,
  showPopoverAnchors: !isEmpty(process.env.SESSION_SHOW_POPOVER_ANCHORS),
  // Note: some stuff are init when the app starts, so fsTTL30s should only be set from the env itself (before app starts)
  fsTTL30s: !isEmpty(process.env.FILE_SERVER_TTL_30S),
  debugLogging: !isEmpty(process.env.SESSION_DEBUG),
  debugLibsessionDumps: !isEmpty(process.env.SESSION_DEBUG_LIBSESSION_DUMPS),
  debugBuiltSnodeRequests: !isEmpty(process.env.SESSION_DEBUG_BUILT_SNODE_REQUEST),
  debugSwarmPolling: !isEmpty(process.env.SESSION_DEBUG_SWARM_POLLING),
  debugServerRequests: !isEmpty(process.env.SESSION_DEBUG_SERVER_REQUESTS),
  debugNonSnodeRequests: !isEmpty(process.env.SESSION_DEBUG_NON_SNODE_REQUESTS),
  debugOnionRequests: false,
  debugOnionPaths: !isEmpty(process.env.SESSION_DEBUG_ONION_PATHS),
  debugSnodePool: !isEmpty(process.env.SESSION_DEBUG_SNODE_POOL),
  debugInsecureNodeFetch: !isEmpty(process.env.SESSION_DEBUG_INSECURE_NODE_FETCH),
  debugOnlineState: !isEmpty(process.env.SESSION_DEBUG_ONLINE_STATE),
  debugForceSeedNodeFailure: !isEmpty(process.env.SESSION_DEBUG_FORCE_SEED_NODE_FAILURE),
  debugKeyboardShortcuts: !isEmpty(process.env.SESSION_DEBUG_KEYBOARD_SHORTCUTS),
  debugFocusScope: !isEmpty(process.env.SESSION_DEBUG_FOCUS_SCOPE),
  debugFocusTrap: !isEmpty(process.env.SESSION_DEBUG_FOCUS_TRAP),
} satisfies SessionBooleanFeatureFlags;

function getMockNetworkPageNodeCount() {
  try {
    const envVar = process.env.SESSION_MOCK_NETWORK_PAGE_NODE_COUNT;
    if (!envVar) {
      return null;
    }
    const num = Number.parseInt(envVar, 10);
    if (Number.isFinite(num) && num > 0 && num < 11) {
      return num;
    }
    throw new Error(`Value is invalid for mock node count: ${num}`);
  } catch (e) {
    window.log.error('getMockNetworkPageNodeCount:', e);
    return null;
  }
}

/**
 * An unrecognised value for a mock env var must not degrade to "no override". A typo would then
 * surface as a failed assertion about the app, several steps from its cause, rather than as a
 * setup error — so these throw.
 */
function invalidMockEnvVar(name: string, value: string, allowed: Array<string>): never {
  const message = `${name}: "${value}" is not one of ${allowed.join(' | ')}`;
  // eslint-disable-next-line no-console
  console.error(message);
  window?.log?.error(message);
  throw new Error(message);
}

/**
 * The Pro status the app should project, from the environment.
 *
 * The slugs are libsession's own (`ProStatus`) plus `useactual`, which is the shared vocabulary the
 * iOS and Android harnesses also take, so one value in a cross-platform test config drives all
 * three clients. `useactual` is spelled out rather than left to an unset variable so a config can
 * say "no override" explicitly.
 *
 * Note for whoever maps the shared `active` token onto Desktop: on all three clients `active` means
 * active *and not auto-renewing*, so the harness must pass SESSION_USER_HAS_PRO_CANCELLED alongside
 * this. Deliberately not coupled here — this flag projects the status and nothing else, and having
 * it silently move autoRenew would surprise every non-test reader of `mockProCurrentStatus`.
 */
function getMockProCurrentStatus(): ProStatus | null {
  const envVar = process.env.SESSION_PRO_CURRENT_STATUS?.trim();
  if (!envVar) {
    return null;
  }
  const known = [ProStatus.Never, ProStatus.Active, ProStatus.Expired] as Array<ProStatus>;
  if (known.includes(envVar)) {
    return envVar;
  }
  if (envVar === 'useactual') {
    return null;
  }
  return invalidMockEnvVar('SESSION_PRO_CURRENT_STATUS', envVar, [...known, 'useactual']);
}

/**
 * Named rather than numeric, because the enum's numbering is an implementation detail that
 * reorders whenever a case is inserted — an environment pinned to `2` would silently start
 * meaning a different duration.
 */
function getMockProAccessExpiry(): MockProAccessExpiryOptions | null {
  const envVar = process.env.SESSION_PRO_ACCESS_EXPIRY?.trim();
  if (!envVar) {
    return null;
  }
  const option = MockProAccessExpiryOptions[envVar as keyof typeof MockProAccessExpiryOptions];
  if (typeof option === 'number') {
    return option;
  }
  return invalidMockEnvVar(
    'SESSION_PRO_ACCESS_EXPIRY',
    envVar,
    Object.keys(MockProAccessExpiryOptions).filter(k => Number.isNaN(Number(k)))
  );
}

/**
 * Path to an image for the test-integration avatar picker to return.
 *
 * Only emptiness is checked here — whether the file exists and is a usable image is settled in
 * `pickFileForTestIntegration`, which owns the accepted-extension list. Duplicating that list here
 * would give two sources of truth for one rule, and the picker's error is raised the moment a test
 * uploads, which is loud enough.
 */
function getFakeAvatarPickerFile(): string | null {
  return process.env.SESSION_FAKE_AVATAR_PICKER_FILE?.trim() || null;
}

export const defaultAvatarPickerColor = '#0000ff'; // defaults to blue

export const defaultProDataFeatureFlags = {
  mockMessageProFeatures: null,
  mockProCurrentStatus: getMockProCurrentStatus(),
  mockProPaymentProvider: null,
  mockProAccessVariant: null,
  mockProAccessExpiry: getMockProAccessExpiry(),
  mockProLongerMessagesSent: null,
  mockProPinnedConversations: null,
  mockProBadgesSent: null,
  mockProGroupsUpgraded: null,
  mockNetworkPageNodeCount: getMockNetworkPageNodeCount(),
  fakeAvatarPickerColor: defaultAvatarPickerColor,
  fakeAvatarPickerFile: getFakeAvatarPickerFile(),
} as const;

export const defaultDataFeatureFlags = {
  ...defaultProDataFeatureFlags,
  useLocalDevNet:
    (!isEmpty(process.env.LOCAL_DEVNET_SEED_URL) ? process.env.LOCAL_DEVNET_SEED_URL : null) ??
    null,
} satisfies SessionDataFeatureFlags;
