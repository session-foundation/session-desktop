// Default Theme should be Classic Dark
export type ThemeColorVariables = {
  '--danger-color': string;
  '--warning-color': string;
  '--disabled-color': string;

  /* Backgrounds */
  '--background-primary-color': string;
  '--background-secondary-color': string;
  '--background-tertiary-color': string;

  /* Text */
  '--text-primary-color': string;
  '--text-secondary-color': string;
  '--text-selection-color': string;

  /* Borders */
  '--borders-color': string;

  /* Message Bubbles */
  '--message-bubble-outgoing-background-color': string;
  '--message-bubble-incoming-background-color': string;
  '--message-bubble-outgoing-text-color': string;
  '--message-bubble-incoming-text-color': string;

  /* Menu Button */
  '--menu-button-background-hover-color': string;
  '--menu-button-icon-color': string;
  '--menu-button-icon-hover-color': string;
  '--menu-button-border-color': string;
  '--menu-button-border-hover-color': string;

  /* Chat (Interaction) Buttons */
  /* Also used for Reaction Bar Buttons */
  /* Used for Link Preview Attachment Icons */
  /* Used for Media Grid Item Play Button */
  '--chat-buttons-background-color': string;
  '--chat-buttons-background-hover-color': string;
  '--chat-buttons-icon-color': string;

  /* Buttons */
  /* Outline (Default) */
  '--button-outline-background-hover-color': string;
  '--button-outline-text-color': string;
  '--button-outline-text-hover-color': string;
  '--button-outline-border-color': string;
  '--button-outline-border-hover-color': string;
  '--button-outline-background-color': string;

  /* Solid */
  /* Also used for Pills */
  '--button-solid-background-hover-color': string;
  '--button-solid-text-hover-color': string;

  /* Simple */
  '--button-simple-text-color': string;

  /* Icons */
  '--button-icon-background-color': string;
  '--button-icon-stroke-hover-color': string;
  '--button-icon-stroke-selected-color': string;

  /* Conversation Tab */
  /* This is also user for Overlay Tabs, Contact Rows, Conversation List Items,
   Message Search Results, Message Requests Banner, Member List Item,
   Contact List Items, Message Right Click Highlighting etc. */
  '--conversation-tab-background-color': string;
  '--conversation-tab-background-hover-color': string;
  '--conversation-tab-background-selected-color': string;
  '--conversation-tab-background-unread-color': string;
  '--conversation-tab-text-selected-color': string;
  '--conversation-tab-text-unread-color': string;

  /* Search Bar */
  '--search-bar-background-color': string;

  /* Scroll Bars */
  '--scroll-bar-track-color': string;
  '--scroll-bar-track-hover-color': string;
  '--scroll-bar-thumb-color': string;
  '--scroll-bar-thumb-hover-color': string;

  /* Toggle Switch */
  '--toggle-switch-ball-shadow-color': string;
  '--toggle-switch-off-border-color': string;

  /* Emoji Reaction Bar */
  '--emoji-reaction-bar-background-color': string;
  /* NOTE only used for + icon */
  '--emoji-reaction-bar-icon-background-color': string;

  /* Modals */
  '--modal-background-color': string;
  '--modal-background-content-color': string;
  '--modal-shadow-color': string;
  '--modal-drop-shadow': string;

  /* Toasts */
  '--toast-background-color': string;

  /* Session Text Logo */
  /* Loads SVG as IMG and uses a filter to change color */
  '--session-logo-text-light-filter': string;
  '--session-logo-text-current-filter': string;

  /* Suggestions i.e. Mentions and Emojis */
  '--suggestions-background-color': string;
  '--suggestions-background-hover-color': string;

  /* Inputs */
  /* Also used for some TextAreas */
  '--input-text-color': string;

  /* Call Buttons */
  '--call-buttons-background-color': string;
  '--call-buttons-background-hover-color': string;
  '--call-buttons-background-disabled-color': string;
  '--call-buttons-action-background-color': string;
  '--call-buttons-action-background-hover-color': string;
  '--call-buttons-icon-color': string;
  '--call-buttons-icon-disabled-color': string;

  /* File Dropzone */
  '--file-dropzone-border-color': string;

  /* Session Recording */
  '--session-recording-pulse-color': string;

  /* HTML Renderer */
  /**
   * This isn't good, but we want the span color to be
   * `--primary-color` on dark themes and `--text-primary-color` on light themes
   */
  '--renderer-span-primary-color': string;
};
