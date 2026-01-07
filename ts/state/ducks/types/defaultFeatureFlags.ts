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
  showPopoverAnchors: false,
  // Note: some stuff are init when the app starts, so fsTTL30s should only be set from the env itself (before app starts)
  fsTTL30s: !isEmpty(process.env.FILE_SERVER_TTL_30S),
  debugLogging: !isEmpty(process.env.SESSION_DEBUG),
  debugLibsessionDumps: !isEmpty(process.env.SESSION_DEBUG_LIBSESSION_DUMPS),
  debugBuiltSnodeRequests: !isEmpty(process.env.SESSION_DEBUG_BUILT_SNODE_REQUEST),
  debugSwarmPolling: !isEmpty(process.env.SESSION_DEBUG_SWARM_POLLING),
  debugServerRequests: !isEmpty(process.env.SESSION_DEBUG_SERVER_REQUESTS),
  debugNonSnodeRequests: false,
  debugOnionRequests: false,
  debugOnionPaths: !isEmpty(process.env.SESSION_DEBUG_ONION_PATHS),
  debugSnodePool: !isEmpty(process.env.SESSION_DEBUG_SNODE_POOL),
  debugInsecureNodeFetch: !isEmpty(process.env.SESSION_DEBUG_INSECURE_NODE_FETCH),
  debugOnlineState: !isEmpty(process.env.SESSION_DEBUG_ONLINE_STATE),
} satisfies SessionBooleanFeatureFlags;

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
  mockNetworkPageNodeCount: null,
} as const;

export const defaultDataFeatureFlags = {
  ...defaultProDataFeatureFlags,
  useLocalDevNet:
    (!isEmpty(process.env.LOCAL_DEVNET_SEED_URL) ? process.env.LOCAL_DEVNET_SEED_URL : null) ??
    null,
} satisfies SessionDataFeatureFlags;
