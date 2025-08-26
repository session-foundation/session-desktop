const settingsReadReceipt = 'read-receipt-setting';
const settingsTypingIndicator = 'typing-indicators-setting';
const settingsAutoUpdate = 'auto-update';
const hasShiftSendEnabled = 'hasShiftSendEnabled';
const settingsMenuBar = 'hide-menu-bar';
const settingsSpellCheck = 'spell-check';
const settingsLinkPreview = 'link-preview-setting';
const hasBlindedMsgRequestsEnabled = 'hasBlindedMsgRequestsEnabled';
const settingsStartInTray = 'start-in-tray-setting';
const settingsAutoStart = 'auto-start-setting';
const settingsOpengroupPruning = 'prune-setting';
const settingsNotification = 'notification-setting';
const settingsAudioNotification = 'audio-notification-setting';
const hasSyncedInitialConfigurationItem = 'hasSyncedInitialConfigurationItem';
const ntsAvatarExpiryMs = 'ntsAvatarExpiryMs';
const hasLinkPreviewPopupBeenDisplayed = 'hasLinkPreviewPopupBeenDisplayed';
const hasFollowSystemThemeEnabled = 'hasFollowSystemThemeEnabled';
const hideRecoveryPassword = 'hideRecoveryPassword';

// user config tracking timestamps (to discard incoming messages which would make a change we reverted in the last config message we merged)
const latestUserProfileEnvelopeTimestamp = 'latestUserProfileEnvelopeTimestamp';
const latestUserGroupEnvelopeTimestamp = 'latestUserGroupEnvelopeTimestamp';
const latestUserContactsEnvelopeTimestamp = 'latestUserContactsEnvelopeTimestamp';
const showOnboardingAccountJustCreated = 'showOnboardingAccountJustCreated';

export const SettingsKey = {
  settingsReadReceipt,
  settingsTypingIndicator,
  settingsAutoUpdate,
  hasShiftSendEnabled,
  settingsMenuBar,
  settingsSpellCheck,
  settingsLinkPreview,
  settingsStartInTray,
  settingsAutoStart,
  settingsOpengroupPruning,
  hasBlindedMsgRequestsEnabled,
  settingsNotification,
  settingsAudioNotification,
  hasSyncedInitialConfigurationItem,
  ntsAvatarExpiryMs,
  hasLinkPreviewPopupBeenDisplayed,
  latestUserProfileEnvelopeTimestamp,
  latestUserGroupEnvelopeTimestamp,
  latestUserContactsEnvelopeTimestamp,
  hasFollowSystemThemeEnabled,
  hideRecoveryPassword,
  showOnboardingAccountJustCreated,
} as const;

export const KNOWN_BLINDED_KEYS_ITEM = 'KNOWN_BLINDED_KEYS_ITEM';
export const SNODE_POOL_ITEM_ID = 'SNODE_POOL_ITEM_ID';
