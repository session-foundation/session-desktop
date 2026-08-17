const settingsReadReceipt = 'read-receipt-setting';
const settingsTypingIndicator = 'typing-indicators-setting';
const settingsAutoUpdate = 'auto-update';
const hasShiftSendEnabled = 'hasShiftSendEnabled';
const settingsMenuBar = 'hide-menu-bar';
const settingsSpellCheck = 'spell-check';
const settingsLinkPreview = 'link-preview-setting';
const hasBlindedMsgRequestsEnabled = 'hasBlindedMsgRequestsEnabled';
const settingsStartInTray = 'start-in-tray-setting';
const settingsOpengroupPruning = 'prune-setting';
const settingsNotification = 'notification-setting';
const settingsAudioNotification = 'audio-notification-setting';
const hasSyncedInitialConfigurationItem = 'hasSyncedInitialConfigurationItem';
const hasLinkPreviewPopupBeenDisplayed = 'hasLinkPreviewPopupBeenDisplayed';
const hasFollowSystemThemeEnabled = 'hasFollowSystemThemeEnabled';
const hideRecoveryPassword = 'hideRecoveryPassword';

// Pro stats counters
const proLongerMessagesSent = 'proLongerMessagesSent';
const proBadgesSent = 'proBadgesSent';

// user config tracking timestamps (to discard incoming messages which would make a change we reverted in the last config message we merged)
const latestUserProfileEnvelopeTimestamp = 'latestUserProfileEnvelopeTimestamp';
const latestUserGroupEnvelopeTimestamp = 'latestUserGroupEnvelopeTimestamp';
const latestUserContactsEnvelopeTimestamp = 'latestUserContactsEnvelopeTimestamp';
const showOnboardingAccountJustCreated = 'showOnboardingAccountJustCreated';

/**
 * When we added the author of a message in groups in the last message,
 * we also had to regenerate the existing last messages.
 * We only need to do this once, and we can remove it in a few months safely :tm:
 *
 */
const lastMessageGroupsRegenerated = 'lastMessageGroupsRegenerated';

const localAttachmentEncryptionKey = 'local_attachment_encrypted_key';

export const SettingsKey = {
  lastShutdownWasGraceful: 'lastShutdownWasGraceful',
  settingsReadReceipt,
  settingsTypingIndicator,
  settingsAutoUpdate,
  hasShiftSendEnabled,
  settingsMenuBar,
  settingsSpellCheck,
  settingsLinkPreview,
  settingsStartInTray,
  pendingMessages: 'pendingMessages',
  settingsOpengroupPruning,
  hasBlindedMsgRequestsEnabled,
  settingsNotification,
  settingsAudioNotification,
  hasSyncedInitialConfigurationItem,
  hasLinkPreviewPopupBeenDisplayed,
  latestUserProfileEnvelopeTimestamp,
  latestUserGroupEnvelopeTimestamp,
  latestUserContactsEnvelopeTimestamp,
  hasFollowSystemThemeEnabled,
  hasGiphyIntegrationEnabled: 'hasGiphyIntegrationEnabled',
  hideRecoveryPassword,
  showOnboardingAccountJustCreated,
  lastMessageGroupsRegenerated,
  proLongerMessagesSent,
  proBadgesSent,
  audioAutoplay: 'audioAutoplay',
  showRecoveryPhrasePrompt: 'showRecoveryPhrasePrompt',
  dismissedRecoveryPhrasePrompt: 'dismissedRecoveryPhrasePrompt',
  hideMessageRequests: 'hideMessageRequests',
  identityKey: 'identityKey',
  blocked: 'blocked',
  numberId: 'number_id',
  localAttachmentEncryptionKey,
  spellCheckEnabled: 'spell-check',
  settingsTheme: 'settingsTheme',
  urlInteractions: 'urlInteractions',
  ctaInteractions: 'ctaInteractions',
  proMasterKeyHex: 'proMasterKeyHex',
  proRotatingPrivateKeyHex: 'proRotatingPrivateKeyHex',
  /**
   * The ticket of the last fetched revocations list, number | undefined
   * Note: changes to this have to be done through the ProRevocationCache
   */
  proRevocationListTicket: 'proRevocationListTicket',
  /**
   * The items of the last fetched revocations list, Array of items validating ProRevocationItemSchema (or undefined)
   * Note: changes to this have to be done through the ProRevocationCache
   */
  proRevocationListItems: 'proRevocationListItems',
  /**
   * The next time we want to run the UpdateProRevocationListJob, number | undefined (milliseconds since epoch).
   * This is either unset or set via the retry_in_s from the server.
   *
   */
  proRevocationListNextRunAtMs: 'proRevocationListNextRunAtMs',
  proStatus: 'proStatus',
  /**
   * When a get_pro_status request was last STARTED, number | undefined (ms since epoch, network time).
   * Backs the 60s status-refresh floor. Stamped on attempt rather than success because a failing request
   * costs the backend the same as a succeeding one, and persisted because the floor has to survive the
   * process restart that the startup gate is about.
   *
   * Not interchangeable with redux `proBackendData.details.lastFetchedMs`, which is per-run and stamped
   * on COMPLETION. Anything asking "have we confirmed our status" must use that one — this key would let
   * a *failed* request satisfy the check.
   */
  proStatusLastFetchAttemptMs: 'proStatusLastFetchAttemptMs',
  /**
   * When we last let a *cold start* fetch get_pro_status, number | undefined (ms since epoch,
   * network time). Separate from proStatusLastFetchAttemptMs so the ~24h startup interval isn't reset by
   * routine in-session refreshes.
   */
  proStatusLastStartupFetchMs: 'proStatusLastStartupFetchMs',
  // NOTE: for these CTAs undefined means it has never been shown in this cycle of pro access, true means it needs to be shown and false means it has been shown and dont show it again.
  proExpiringSoonCTA: 'proExpiringSoonCTA',
  proExpiredCTA: 'proExpiredCTA',
} as const;

export const KNOWN_BLINDED_KEYS_ITEM = 'KNOWN_BLINDED_KEYS_ITEM';
export const SNODE_POOL_ITEM_ID = 'SNODE_POOL_ITEM_ID';
