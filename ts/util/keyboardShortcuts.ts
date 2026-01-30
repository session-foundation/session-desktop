import type { KeyboardEvent } from 'react';
import { isMacOS } from '../OS';
import type { FocusScope } from '../state/selectors/modal';
import { getFeatureFlag } from '../state/ducks/types/releasedFeaturesReduxTypes';

export function debugKeyboardShortcutsLog(...args: Array<unknown>) {
  if (!getFeatureFlag('debugKeyboardShortcuts')) {
    return;
  }
  window.log.debug('[debugKeyboardShortcuts]', ...args);
}

export function isButtonClickKey(e: KeyboardEvent<HTMLDivElement>) {
  return e.key === 'Enter' || e.code === 'Space';
}

export function createButtonOnKeyDownForClickEventHandler(callback: () => void) {
  return (e: KeyboardEvent<HTMLDivElement>) => {
    debugKeyboardShortcutsLog(`createButtonOnKeyDownForClickEventHandler fn called with: `, e);
    if (isButtonClickKey(e)) {
      e.preventDefault();
      e.stopPropagation();
      callback();
    }
  };
}

export type KbdShortcutOptions = {
  name: string;
  scope: FocusScope;
  // NOTE: this only supports one key at the moment, but we will want more in the future, but this is much more complex to implement
  keys: [string];
  // NOTE: ctrl becomes cmd on mac
  withCtrl?: boolean;
  withAlt?: boolean;
  withShift?: boolean;
};

export const ctrlKey = isMacOS() ? 'metaKey' : 'ctrlKey';
export const ctrlKeyName = isMacOS() ? 'cmd' : 'ctrl';

const baseConversationNavigation: KbdShortcutOptions = {
  name: 'Navigate to Conversation',
  withCtrl: true,
  keys: ['1-9'],
  scope: 'conversationList',
};
type ConversationNavKeys = `conversationNavigation${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`;

const conversationNavigation = Object.fromEntries(
  Array.from({ length: 9 }, (_, i) => [
    `conversationNavigation${i + 1}`,
    { ...baseConversationNavigation, keys: [`${i + 1}`] },
  ])
) as Record<ConversationNavKeys, KbdShortcutOptions>;

// TODO: These should be user-editable. It should be simple to store custom user keybinds
// in the database and its an often overlocked feature with little lift and massive UX gains.

export const KbdShortcut = {
  keyboardShortcutModal: {
    name: 'Keyboard Shortcuts',
    scope: 'global',
    withCtrl: true,
    keys: ['/'],
  },
  zoomIn: { name: 'Zoom In', scope: 'global', withCtrl: true, keys: ['+'] },
  zoomOut: { name: 'Zoom Out', scope: 'global', withCtrl: true, keys: ['-'] },
  userSettingsModal: { name: 'User Settings', scope: 'global', withCtrl: true, keys: [','] },
  newConversation: { name: 'New Conversation', scope: 'global', withCtrl: true, keys: ['n'] },
  conversationListSearch: {
    name: 'Search',
    scope: 'conversationList',
    withCtrl: true,
    keys: ['f'],
  },
  conversationFocusTextArea: {
    name: 'Focus Text Area',
    scope: 'conversationList',
    keys: ['Escape'],
  },
  conversationUploadAttachment: {
    name: 'Upload Attachment',
    scope: 'conversationList',
    withCtrl: true,
    keys: ['u'],
  },
  conversationToggleEmojiPicker: {
    name: 'Toggle Emoji Picker',
    scope: 'conversationList',
    withCtrl: true,
    keys: ['e'],
  },
  conversationSettingsModal: {
    name: 'Conversation Settings',
    scope: 'global',
    withCtrl: true,
    keys: ['.'],
  },
  ...conversationNavigation,
} as const satisfies Record<string, KbdShortcutOptions>;

export const KbdShortcutInformation: Record<string, Array<KbdShortcutOptions>> = {
  general: [
    KbdShortcut.newConversation,
    KbdShortcut.conversationListSearch,
    KbdShortcut.keyboardShortcutModal,
    baseConversationNavigation,
  ],
  conversation: [
    KbdShortcut.conversationFocusTextArea,
    KbdShortcut.conversationUploadAttachment,
    KbdShortcut.conversationToggleEmojiPicker,
    KbdShortcut.conversationSettingsModal,
  ],
  view: [KbdShortcut.zoomIn, KbdShortcut.zoomOut],
};
