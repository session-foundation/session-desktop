import 'react';
import type { ReleaseChannels } from './updater/types';

/**
 * WARNING: if you change something here, you will most likely break some integration tests.
 * So be sure to check with QA first.
 */

declare module 'react' {
  // disappear options
  type DisappearOptionDataTestId =
    | 'disappear-after-send-option'
    | 'disappear-after-read-option'
    | 'disappear-legacy-option'
    | 'disappear-off-option';
  type DisappearTimeOptionDataTestId =
    | 'time-option-0-seconds'
    | 'time-option-5-seconds'
    | 'time-option-10-seconds'
    | 'time-option-30-seconds'
    | 'time-option-60-seconds'
    | 'time-option-5-minutes'
    | 'time-option-30-minutes'
    | 'time-option-1-hours'
    | 'time-option-6-hours'
    | 'time-option-12-hours'
    | 'time-option-1-days'
    | 'time-option-7-days'
    | 'time-option-14-days';

  type MenuOption =
    | 'attachments'
    | 'group-members'
    | 'manage-members'
    | 'notifications'
    | 'invite-contacts'
    | 'clear-all-messages'
    | 'copy-account-id'
    | 'delete-conversation'
    | 'delete-contact'
    | 'block-user'
    | 'hide-nts'
    | 'show-nts'
    | 'copy-community-url'
    | 'leave-community'
    | 'add-admins'
    | 'remove-admins'
    | 'pin-conversation'
    | 'unban-user'
    | 'ban-user'
    | 'disappearing-messages' // one of those two might be incorrect. FIXME
    | 'disappearing-messages-timer';

  type MenuOptionDetails = `${MenuOption}-details`;
  type NotificationsOptions = 'mute' | 'all-messages' | 'mentions-only';
  type NotificationButtons = `notifications-${NotificationsOptions}-button`;
  type NotificationRadioButtons = `notifications-${NotificationsOptions}-radio-button`;

  type SetButton = 'notifications' | 'disappear';

  type ConfirmButtons =
    | 'set-nickname'
    | 'open-url'
    | 'add-admins'
    | 'update-group-info'
    | 'ban-user'
    | 'unban-user'
    | 'ban-user-delete-all';

  type CancelButtons = 'update-group-info' | 'add-admins' | 'unban-user';

  type ClearButtons = 'group-info-description' | 'group-info-name' | 'nickname' | 'add-admins';

  // left pane section types
  type Sections = 'theme' | 'settings' | 'message' | 'privacy' | 'debug-menu';

  type SettingsMenuItems =
    | 'message-requests'
    | 'recovery-password'
    | 'privacy'
    | 'notifications'
    | 'conversations'
    | 'appearance'
    | 'help'
    | 'permissions'
    | 'clear-data'
    | 'session-network'
    | 'donate';

  type MenuItems = 'block' | 'delete' | 'accept';

  type Inputs =
    | 'password'
    | 'nickname'
    | 'profile-name'
    | 'message'
    | 'update-group-info-name'
    | 'update-group-info-description'
    | 'recovery-phrase'
    | 'display-name'
    | 'add-admins'
    | 'ban-user'
    | 'unban-user';

  type Dialog = 'invite-contacts' | 'edit-profile';

  type SessionDataTestId =
    | 'group-member-status-text'
    | 'loading-spinner'
    | 'session-toast'
    | 'loading-animation'
    | 'your-session-id'
    | 'chooser-new-community'
    | 'chooser-new-group'
    | 'chooser-new-conversation-button'
    | 'new-conversation-button'
    | 'message-request-banner'
    | 'leftpane-section-container'
    | 'open-url'
    | 'recovery-password-seed-modal'
    | 'password-input-reconfirm'
    | 'conversation-header-subtitle'
    | 'image-upload-click'
    | 'your-profile-name'
    | 'community-name'
    | 'group-name'
    | 'group-description'
    | 'preferred-display-name'
    | 'fallback-display-name'
    | 'image-upload-section'
    | 'profile-picture'
    | 'display-name'
    | 'control-message'
    | 'header-conversation-name'
    | 'disappear-messages-type-and-time'
    | 'message-input-text-area'
    | 'messages-container'
    | 'decline-and-block-message-request'
    | 'session-dropdown'
    | 'path-light-container'
    | 'add-user-button'
    | 'back-button-conversation-options'
    | 'send-message-button'
    | 'scroll-to-bottom-button'
    | 'end-call'
    | 'modal-close-button'
    | 'end-voice-message'
    | 'back-button-message-details'
    | 'edit-profile-icon'
    | 'microphone-button'
    | 'call-button'
    | 'attachments-button'
    | 'invite-warning'
    | 'some-of-your-devices-outdated-conversation'
    | 'some-of-your-devices-outdated-inbox'
    | 'legacy-group-banner'
    | 'account-id'
    | 'set-nickname-remove-button'

    // generic button types
    | 'emoji-button'
    | 'reveal-blocked-user-settings'
    | `${Sections}-section`

    // settings menu item types
    | `${MenuItems}-menu-item`
    | `${ConfirmButtons}-confirm-button`
    | `${CancelButtons}-cancel-button`
    | `clear-${ClearButtons}-button`
    | `${SettingsMenuItems}-settings-menu-item`
    | `${Inputs}-input`

    // timer options
    | DisappearTimeOptionDataTestId
    | DisappearOptionDataTestId
    | `input-${DisappearTimeOptionDataTestId}`
    | `input-${DisappearOptionDataTestId}`

    // dialog roots
    | `${Dialog}-dialog`

    // generic readably message (not control message)
    | 'message-content'

    // control message types
    | 'message-request-response-message'
    | 'interaction-notification'
    | 'data-extraction-notification'
    | 'group-update-message'
    | 'disappear-control-message'

    // subtle control message types
    | 'group-request-explanation'
    | 'conversation-request-explanation'
    | 'group-invite-control-message'
    | 'empty-conversation-control-message'

    // call notification types
    | 'call-notification-missed-call'
    | 'call-notification-started-call'
    | 'call-notification-answered-a-call'

    // settings toggle and buttons
    | 'remove-password-settings-button'
    | 'change-password-settings-button'
    | 'enable-read-receipts'
    | 'set-password-button'
    | 'enable-read-receipts'
    | 'enable-calls'
    | 'enable-microphone'
    | 'enable-follow-system-theme'
    | 'unblock-button-settings-screen'
    | 'save-attachment-from-details'
    | 'resend-msg-from-details'
    | 'reply-to-msg-from-details'
    | 'leave-group-button'
    | 'disappearing-messages'
    | 'group-members'
    | 'edit-group-name'
    | 'delete-group-button'

    // SessionRadioGroup & SessionRadio
    | 'password-input-confirm'
    | 'msg-status'
    | 'input-device_and_network'
    | 'label-device_and_network'
    | 'input-device_only'
    | 'label-device_only'
    | 'input-deleteForEveryone'
    | 'label-deleteForEveryone'
    | 'input-deleteJustForMe'
    | 'label-deleteJustForMe'
    | 'input-enterForSend'
    | 'label-enterForSend'
    | 'input-enterForNewLine'
    | 'label-enterForNewLine'
    | 'input-message'
    | 'label-message'
    | 'input-name'
    | 'label-name'
    | 'input-count'
    | 'label-count'
    | 'clear-everyone-radio-option'
    | 'clear-device-radio-option'
    | 'clear-everyone-radio-option-label'
    | 'clear-device-radio-option-label'

    // links
    | 'session-website-link'
    | 'session-link-helpdesk'
    | 'session-faq-link'

    // link preview (staged)
    | 'link-preview-loading'
    | 'link-preview-image'
    | 'link-preview-title'
    | 'link-preview-close'

    // modules profile name
    | 'module-conversation__user__profile-name'
    | 'module-message-search-result__header__name__profile-name'
    | 'module-message__author__profile-name'
    | 'module-contact-name__profile-name'

    // network page
    | 'staking-reward-pool-amount'
    | 'market-cap-amount'
    | 'learn-about-staking-link'
    | 'swarm-image'
    | 'sent-price'
    | 'tooltip-info'
    | 'tooltip'
    | 'network-secured-amount'
    | 'learn-more-network-link'
    | 'your-swarm-amount'
    | 'nodes-securing-amount'
    | 'refresh-button'

    // to sort
    | 'restore-using-recovery'
    | 'link-device'
    | 'join-community-conversation'
    | 'join-community-button'
    | 'audio-player'
    | 'select-contact'
    | 'contact' // this is way too generic
    | 'contact-status'
    | 'version-warning'
    | 'copy-url-button'
    | 'continue-session-button'
    | 'next-new-conversation-button'
    | 'reveal-recovery-phrase'
    | 'existing-account-button'
    | 'create-account-button'
    | 'resend-invite-button'
    | 'session-confirm-cancel-button'
    | 'session-confirm-ok-button'
    | 'confirm-nickname'
    | 'context-menu-item'
    | 'view-qr-code-button'
    | 'your-qr-code'
    | 'session-recovery-password'
    | 'hide-recovery-password-button'
    | 'copy-button-account-id'
    | 'path-light-svg'
    | 'group-member-name'
    | 'privacy-policy-button'
    | 'terms-of-service-button'
    | 'chooser-invite-friend'
    | 'your-account-id'
    | 'hide-recovery-phrase-toggle'
    | 'reveal-recovery-phrase-toggle'
    | 'resend-promote-button'
    | 'continue-button'
    | 'back-button'
    | 'empty-conversation'
    | 'session-error-message'
    | 'hide-input-text-toggle'
    | 'show-input-text-toggle'
    | 'save-button-profile-update'
    | 'save-button-profile-update'
    | 'copy-button-profile-update'
    | 'create-group-button'
    | 'delete-message-request'
    | 'accept-message-request'
    | 'mentions-popup-row'
    | 'session-id-signup'
    | 'search-contacts-field'
    | 'three-dot-loading-animation'
    | 'new-session-conversation'
    | 'new-closed-group-name'
    | 'leftpane-primary-avatar'
    | 'img-leftpane-primary-avatar'
    | 'conversation-options-avatar'
    | 'copy-sender-from-details'
    | 'copy-msg-from-details'
    | 'modal-heading'
    | 'modal-description'
    | 'error-message'
    | 'group-not-updated-30-days-banner'
    | 'delete-from-details'
    | 'avatar-placeholder'
    | `input-releases-${ReleaseChannels}`
    | `label-releases-${ReleaseChannels}`
    | `${MenuOption}-menu-option`
    | `${MenuOptionDetails}-menu-option`
    | `${SetButton}-set-button`
    | `${NotificationButtons}`
    | `${NotificationRadioButtons}`
    | 'last-updated-timestamp'
    // Once the whole app have datatestId when required, this `invalid-data-testid` will be removed
    | 'invalid-data-testid';

  interface HTMLAttributes {
    'data-testid'?: SessionDataTestId;
  }
}
