export const SettingsKey = {
  // Privacy
  settingsPermissionCallMedia: 'settingsPermissionCallMedia',
  settingsPermissionMedia: 'settingsPermissionMedia',
  settingsBlindedMsgRequests: 'settingsBlindedMsgRequests',
  settingsReadReceipt: 'settingsReadReceipt',
  settingsTypingIndicator: 'settingsTypingIndicator',
  settingsLinkPreview: 'settingsLinkPreview',
  // Notifications
  settingsNotification: 'settingsNotification',
  settingsAudioNotification: 'settingsAudioNotification',
  // Conversations
  settingsOpenGroupPruning: 'settingsOpenGroupPruning',
  settingsSpellCheck: 'settingsSpellCheck',
  settingsAutoPlayAudioMessages: 'settingsAutoPlayAudioMessages',
  // Appearance
  settingsFollowSystemTheme: 'settingsFollowSystemTheme',
  settingsHideMenuBar: 'settingsHideMenuBar',
  // Preferences
  settingsAutoUpdate: 'settingsAutoUpdate',
  settingsStartInTray: 'settingsStartInTray',
  settingsAutoStart: 'settingsAutoStart',
  settingsShiftSend: 'settingsShiftSend',
  // Other
  settingsHideRecoveryPassword: 'settingsHideRecoveryPassword',
  settingsSyncedInitialConfigurationItem: 'settingsSyncedInitialConfigurationItem',
  settingsNtsAvatarExpiryMs: 'settingsNtsAvatarExpiryMs',
  settingsLinkPreviewPopupHasDisplayed: 'settingsLinkPreviewPopupHasDisplayed',
  settingsShowOnboardingAccountJustCreated: 'settingsShowOnboardingAccountJustCreated',
  // user config tracking timestamps (to discard incoming messages which would make a change we reverted in the last config message we merged)
  latestUserProfileEnvelopeTimestamp: 'latestUserProfileEnvelopeTimestamp',
  latestUserGroupEnvelopeTimestamp: 'latestUserGroupEnvelopeTimestamp',
  latestUserContactsEnvelopeTimestamp: 'latestUserContactsEnvelopeTimestamp',
} as const;

const settingsKeys = Object.values(SettingsKey);

export type SettingsKeyType = (typeof SettingsKey)[keyof typeof SettingsKey];

export function isSettingsKey(key: unknown): key is SettingsKeyType {
  return settingsKeys.indexOf(key as SettingsKeyType) !== -1;
}

export const SettingsDefault = {
  // Privacy
  settingsPermissionCallMedia: false,
  settingsPermissionMedia: false,
  settingsBlindedMsgRequests: false,
  settingsReadReceipt: false,
  settingsTypingIndicator: false,
  settingsLinkPreview: false,
  // Notifications
  settingsNotification: true,
  settingsAudioNotification: false,
  // Conversations
  settingsOpenGroupPruning: true,
  settingsSpellCheck: true,
  settingsAutoPlayAudioMessages: false,
  // Appearance
  settingsFollowSystemTheme: false,
  settingsHideMenuBar: true,
  // Preferences
  settingsAutoUpdate: true,
  settingsStartInTray: false,
  settingsAutoStart: false,
  settingsShiftSend: false,
  // Other
  settingsHideRecoveryPassword: false,
  settingsSyncedInitialConfigurationItem: undefined,
  settingsNtsAvatarExpiryMs: undefined,
  settingsLinkPreviewPopupHasDisplayed: false,
  settingsShowOnboardingAccountJustCreated: true,
  // user config tracking timestamps (to discard incoming messages which would make a change we reverted in the last config message we merged)
  latestUserProfileEnvelopeTimestamp: undefined,
  latestUserGroupEnvelopeTimestamp: undefined,
  latestUserContactsEnvelopeTimestamp: undefined,
} as const;

export const KNOWN_BLINDED_KEYS_ITEM = 'KNOWN_BLINDED_KEYS_ITEM';
export const SNODE_POOL_ITEM_ID = 'SNODE_POOL_ITEM_ID';

export const SettingsBools = [
  SettingsKey.settingsLinkPreview,
  SettingsKey.settingsBlindedMsgRequests,
  SettingsKey.settingsFollowSystemTheme,
  SettingsKey.settingsShiftSend,
  SettingsKey.settingsHideRecoveryPassword,
  SettingsKey.settingsShowOnboardingAccountJustCreated,
  SettingsKey.settingsOpenGroupPruning,
  SettingsKey.settingsStartInTray,
  SettingsKey.settingsAutoStart,
  SettingsKey.settingsAutoUpdate,
  SettingsKey.settingsHideMenuBar,
  SettingsKey.settingsTypingIndicator,
  SettingsKey.settingsReadReceipt,
  SettingsKey.settingsSpellCheck,
  SettingsKey.settingsPermissionMedia,
  SettingsKey.settingsPermissionCallMedia,
] as const;

export type SettingsBoolKey = (typeof SettingsBools)[number];

export type SettingsState = {
  settingsBools: Record<SettingsBoolKey, boolean>;
};

export function isSettingsBoolKey(key: unknown): key is SettingsBoolKey {
  return SettingsBools.indexOf(key as SettingsBoolKey) !== -1;
}
