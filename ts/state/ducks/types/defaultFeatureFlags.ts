import { isEmpty } from 'lodash';
import { isTestIntegration, isTestNet } from '../../../shared/env_vars';
import type {
  SessionBooleanFeatureFlags,
  SessionDataFeatureFlags,
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
  useClosedGroupV2QAButtons: false,
  useDeterministicEncryption: !isEmpty(process.env.SESSION_ATTACH_DETERMINISTIC_ENCRYPTION),
  disableOnionRequests: false,
  disableImageProcessor: !isEmpty(process.env.SESSION_DISABLE_IMAGE_PROCESSOR),
  disableLocalAttachmentEncryption: !isEmpty(
    process.env.SESSION_DISABLE_LOCAL_ATTACHMENT_ENCRYPTION
  ),
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

export const defaultAvatarPickerColor = '#0000ff'; // defaults to blue

export const defaultProDataFeatureFlags = {
  mockMessageProFeatures: null,
  mockProCurrentStatus: null,
  mockProPaymentProvider: null,
  mockProAccessVariant: null,
  mockProAccessExpiry: null,
  mockProLongerMessagesSent: null,
  mockProPinnedConversations: null,
  mockProBadgesSent: null,
  mockProGroupsUpgraded: null,
  mockNetworkPageNodeCount: getMockNetworkPageNodeCount(),
  fakeAvatarPickerColor: defaultAvatarPickerColor,
} as const;

export const defaultDataFeatureFlags = {
  ...defaultProDataFeatureFlags,
  useLocalDevNet:
    (!isEmpty(process.env.LOCAL_DEVNET_SEED_URL) ? process.env.LOCAL_DEVNET_SEED_URL : null) ??
    null,
} satisfies SessionDataFeatureFlags;
