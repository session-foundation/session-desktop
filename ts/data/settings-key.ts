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
  hideRecoveryPassword,
  showOnboardingAccountJustCreated,
  lastMessageGroupsRegenerated,
  proLongerMessagesSent,
  proBadgesSent,
  audioAutoplay: 'audioAutoplay',
  showRecoveryPhrasePrompt: 'showRecoveryPhrasePrompt',
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
  proDetails: 'proDetails',
  // NOTE: for these CTAs undefined means it has never been shown in this cycle of pro access, true means it needs to be shown and false means it has been shown and dont show it again.
  proExpiringSoonCTA: 'proExpiringSoonCTA',
  proExpiredCTA: 'proExpiredCTA',
} as const;

export const KNOWN_BLINDED_KEYS_ITEM = 'KNOWN_BLINDED_KEYS_ITEM';
export const SNODE_POOL_ITEM_ID = 'SNODE_POOL_ITEM_ID';
