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

  type Avatars = 'edit-profile-dialog' | 'user-profile-dialog' | 'edit-profile-picture-dialog';

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
    | 'ban-user-delete-all'
    | 'modal-session-pro';

  type CancelButtons = 'update-group-info' | 'add-admins' | 'unban-user' | 'modal-session-pro';

  type ClearButtons =
    | `${'group' | 'community'}-info-description`
    | `${'group' | 'community'}-info-name`
    | 'nickname'
    | 'add-admins';

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
    | 'session-pro'
    | 'donate';

  type MenuItems = 'block' | 'delete' | 'accept';

  type Inputs =
    | 'password'
    | 'nickname'
    | 'profile-name'
    | 'message'
    | `update-${'group' | 'community'}-info-name`
    | `update-${'group' | 'community'}-info-description`
    | 'recovery-phrase'
    | 'display-name'
    | 'add-admins'
    | 'ban-user'
    | 'unban-user';

  type ProBadges =
    | 'edit-profile-picture'
    | 'conversation-title'
    | 'conversation-header'
    | 'profile-name'
    | 'contact-name'
    | 'message-info'
    | 'send-more';

  type Dialog = 'invite-contacts' | 'edit-profile';

  type Buttons =
    | 'chooser-new-conversation'
    | 'new-conversation'
    | 'add-user'
    | 'send-message'
    | 'scroll-to-bottom'
    | 'modal-close'
    | 'microphone'
    | 'call'
    | 'attachments'
    | 'set-nickname-remove'
    | 'emoji'
    | 'remove-password-settings'
    | 'change-password-settings'
    | 'leave-group'
    | 'delete-group'
    | 'set-password'
    | 'refresh'
    | 'join-community'
    | 'copy-url'
    | 'continue-session'
    | 'next-new-conversation'
    | 'existing-account'
    | 'create-account'
    | 'resend-invite'
    | 'view-qr-code'
    | 'session-confirm-cancel'
    | 'session-confirm-ok'
    | 'hide-recovery-password'
    | 'privacy-policy'
    | 'terms-of-service'
    | 'resend-promote'
    | 'continue'
    | 'back'
    | 'create-group'
    | `${ConfirmButtons}-confirm`
    | `${CancelButtons}-cancel`
    | `clear-${ClearButtons}`
    | `${SetButton}-set`;

  type InputLabels =
    | 'device_and_network'
    | 'device_only'
    | 'deleteForEveryone'
    | 'deleteJustForMe'
    | 'enterForSend'
    | 'enterForNewLine'
    | 'message'
    | 'name'
    | 'count';

  type SessionDataTestId =
    | 'group-member-status-text'
    | 'loading-spinner'
    | 'session-toast'
    | 'loading-animation'
    | 'your-session-id'
    | 'chooser-new-community'
    | 'chooser-new-group'
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
    | 'back-button-conversation-options'
    | 'back-button-message-details'
    | 'end-call'
    | 'end-voice-message'
    | 'edit-profile-icon'
    | 'edit-community-details'
    | 'invite-warning'
    | 'some-of-your-devices-outdated-conversation'
    | 'some-of-your-devices-outdated-inbox'
    | 'legacy-group-banner'
    | 'account-id'
    | 'modal-actions-container'
    | 'reveal-blocked-user-settings'
    | `${Sections}-section`

    // Buttons
    | `${Buttons}-button`

    // settings menu item types
    | `${MenuItems}-menu-item`
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
    | 'enable-read-receipts'
    | 'enable-calls'
    | 'enable-microphone'
    | 'enable-follow-system-theme'
    | 'unblock-button-settings-screen'
    | 'save-attachment-from-details'
    | 'resend-msg-from-details'
    | 'reply-to-msg-from-details'
    | 'disappearing-messages'
    | 'group-members'
    | 'edit-group-name'

    // SessionRadioGroup & SessionRadio
    | 'password-input-confirm'
    | 'msg-status'
    | `input-${InputLabels}`
    | `label-${InputLabels}`
    | 'clear-everyone-radio-option'
    | 'clear-device-radio-option'
    | 'clear-everyone-radio-option-label'
    | 'clear-device-radio-option-label'

    // links
    | 'session-website-link'
    | 'session-link-helpdesk'
    | 'session-faq-link'

    // link preview (staged)
    | `link-preview-${'loading' | 'image' | 'title' | 'close'}`

    // spacers
    | `spacer-${'xxs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'}`

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

    // to sort
    | 'restore-using-recovery'
    | 'link-device'
    | 'join-community-conversation'
    | 'audio-player'
    | 'select-contact'
    | 'contact' // this is way too generic
    | 'contact-status'
    | 'version-warning'
    | 'reveal-recovery-phrase'
    | 'confirm-nickname'
    | 'context-menu-item'
    | 'your-qr-code'
    | 'session-recovery-password'
    | 'copy-button-account-id'
    | 'path-light-svg'
    | 'group-member-name'
    | 'chooser-invite-friend'
    | 'your-account-id'
    | 'hide-recovery-phrase-toggle'
    | 'reveal-recovery-phrase-toggle'
    | 'hide-password-input-toggle'
    | 'reveal-password-input-toggle'
    | 'empty-conversation'
    | 'session-error-message'
    | 'hide-input-text-toggle'
    | 'show-input-text-toggle'
    | 'save-button-profile-update'
    | 'copy-button-profile-update'
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
    | 'tooltip-character-count'
    | `${MenuOption}-menu-option`
    | `${MenuOptionDetails}-menu-option`
    | `${NotificationButtons}`
    | `${NotificationRadioButtons}`
    | `avatar-${Avatars}`
    | `pro-badge-${ProBadges}`
    | 'last-updated-timestamp'
    | 'account-id-pill'
    // Once the whole app have datatestId when required, this `invalid-data-testid` will be removed
    | 'invalid-data-testid';

  interface HTMLAttributes {
    'data-testid'?: SessionDataTestId;
  }
}
