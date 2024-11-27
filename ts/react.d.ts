import 'react';

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
    | 'group-name-input'
    | 'open-url'
    | 'recovery-password-seed-modal'
    | 'password-input-reconfirm'
    | 'conversation-header-subtitle'
    | 'password-input'
    | 'nickname-input'
    | 'image-upload-click'
    | 'profile-name-input'
    | 'your-profile-name'
    | 'edit-profile-dialog'
    | 'image-upload-section'
    | 'right-panel-group-name'
    | 'control-message'
    | 'header-conversation-name'
    | 'disappear-messages-type-and-time'
    | 'message-input'
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

    // generic button types
    | 'emoji-button'
    | 'reveal-blocked-user-settings'

    // left pane section types
    | 'theme-section'
    | 'settings-section'
    | 'message-section'
    | 'privacy-section'

    // settings menu item types
    | 'message-requests-settings-menu-item'
    | 'recovery-password-settings-menu-item'
    | 'privacy-settings-menu-item'
    | 'notifications-settings-menu-item'
    | 'conversations-settings-menu-item'
    | 'appearance-settings-menu-item'
    | 'help-settings-menu-item'
    | 'permissions-settings-menu-item'
    | 'clear-data-settings-menu-item'
    | 'block-menu-item'
    | 'delete-menu-item'
    | 'accept-menu-item'

    // timer options
    | DisappearTimeOptionDataTestId
    | DisappearOptionDataTestId
    | `input-${DisappearTimeOptionDataTestId}`
    | `input-${DisappearOptionDataTestId}`

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
    | 'remove-moderators'
    | 'add-moderators'
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

    // links
    | 'session-website-link'
    | 'session-link-helpdesk'
    | 'session-faq-link'

    // to sort
    | 'restore-using-recovery'
    | 'link-device'
    | 'select-contact'
    | 'contact' // this is way too generic
    | 'contact-status'
    | 'version-warning'
    | 'open-url-confirm-button'
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
    | 'disappear-set-button'
    | 'create-group-button'
    | 'delete-message-request'
    | 'accept-message-request'
    | 'mentions-popup-row'
    | 'session-id-signup'
    | 'search-contacts-field'
    | 'three-dot-loading-animation'
    | 'recovery-phrase-input'
    | 'display-name-input'
    | 'new-session-conversation'
    | 'new-closed-group-name'
    | 'leftpane-primary-avatar'
    | 'img-leftpane-primary-avatar'
    | 'conversation-options-avatar'
    | 'copy-sender-from-details'
    | 'copy-msg-from-details'
    | 'block-unblock-modal-description'
    // modules profile name
    | 'module-conversation__user__profile-name'
    | 'module-message-search-result__header__name__profile-name'
    | 'module-message__author__profile-name'
    | 'module-contact-name__profile-name'
    | 'delete-from-details';

  interface HTMLAttributes {
    'data-testid'?: SessionDataTestId;
  }
}
