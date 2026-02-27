import type { KeyboardEvent, MouseEvent } from 'react';
import { isMacOS } from '../OS';
import { getFeatureFlag } from '../state/ducks/types/releasedFeaturesReduxTypes';
import type { FocusScope } from '../state/focus';
import { tr } from '../localization';

type NeededKeyboardEventForIdentification = Pick<KeyboardEvent<unknown>, 'key' | 'code'>;

export function debugKeyboardShortcutsLog(...args: Array<unknown>) {
  if (!getFeatureFlag('debugKeyboardShortcuts')) {
    return;
  }
  window.log.debug('[debugKeyboardShortcuts]', ...args);
}

export function isButtonClickKey(e: NeededKeyboardEventForIdentification) {
  return isEnterKey(e) || isSpaceKey(e);
}

export function isSpaceKey(e: NeededKeyboardEventForIdentification) {
  return e && e.code === 'Space';
}

export function isEnterKey(e: NeededKeyboardEventForIdentification) {
  return e && e.key.toLowerCase() === 'enter';
}

export function isEscapeKey(e: NeededKeyboardEventForIdentification) {
  return e && (e.key.toLowerCase() === 'escape' || e.key.toLowerCase() === 'esc');
}

export function isBackspace(e: NeededKeyboardEventForIdentification) {
  return e && e.key.toLowerCase() === 'backspace';
}

export function isDeleteKey(e: NeededKeyboardEventForIdentification) {
  return e && e.code.toLowerCase() === 'delete';
}

export function createButtonOnKeyDownForClickEventHandler(
  callback: (e: KeyboardEvent<HTMLElement> | MouseEvent<HTMLElement>) => void,
  allowPropagation: boolean = false
) {
  return (e: KeyboardEvent<HTMLElement>) => {
    debugKeyboardShortcutsLog(`createButtonOnKeyDownForClickEventHandler fn called with: `, e);
    if (isButtonClickKey(e)) {
      if (!allowPropagation) {
        e.preventDefault();
        e.stopPropagation();
      }
      callback(e);
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

const baseConversationNavigation = {
  name: 'Navigate to Conversation',
  withCtrl: true,
  keys: ['1-9'],
  scope: 'mainScreen',
} satisfies KbdShortcutOptions;
type ConversationNavKeys = `conversationNavigation${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`;

const conversationNavigation = Object.fromEntries(
  Array.from({ length: 9 }, (_, i) => [
    `conversationNavigation${i + 1}`,
    { ...baseConversationNavigation, keys: [`${i + 1}`] },
  ])
) as Record<ConversationNavKeys, typeof baseConversationNavigation>;

// TODO: These should be user-editable. It should be simple to store custom user keybinds
// in the database and its an often overlooked feature with little lift and massive UX gains.
export const KbdShortcut = {
  ...conversationNavigation,
  keyboardShortcutModal: {
    name: 'Keyboard Shortcuts',
    scope: 'global',
    withCtrl: true,
    keys: ['/'],
  },
  zoomIn: { name: tr('appearanceZoomIn'), scope: 'global', withCtrl: true, keys: ['+'] },
  zoomOut: { name: tr('appearanceZoomOut'), scope: 'global', withCtrl: true, keys: ['-'] },
  userSettingsModal: { name: 'User Settings', scope: 'global', withCtrl: true, keys: [','] },
  newConversation: {
    name: tr('conversationsNew'),
    scope: 'mainScreen',
    withCtrl: true,
    keys: ['n'],
  },
  newMessage: {
    name: tr('messageNew', { count: 1 }),
    scope: 'mainScreen',
    withCtrl: true,
    withShift: true,
    keys: ['m'],
  },
  createGroup: {
    name: tr('groupCreate'),
    scope: 'mainScreen',
    withCtrl: true,
    withShift: true,
    keys: ['g'],
  },
  joinCommunity: {
    name: tr('communityJoin'),
    scope: 'mainScreen',
    withCtrl: true,
    withShift: true,
    keys: ['c'],
  },
  openNoteToSelf: {
    name: tr('noteToSelfOpen'),
    scope: 'mainScreen',
    withCtrl: true,
    withShift: true,
    keys: ['n'],
  },
  conversationListSearch: {
    name: tr('search'),
    scope: 'mainScreen',
    withCtrl: true,
    keys: ['f'],
  },

  // Right Panel Shortcuts
  closeRightPanel: { name: 'Close Panel', scope: 'rightPanel', keys: ['Escape'] },

  // Conversation Shortcuts
  conversationFocusTextArea: {
    name: tr('focusTextArea'),
    scope: 'mainScreen',
    keys: ['Escape'],
  },
  conversationUploadAttachment: {
    name: tr('attachmentsAdd'),
    scope: 'mainScreen',
    withCtrl: true,
    keys: ['u'],
  },
  conversationToggleEmojiPicker: {
    name: tr('toggleEmojiPicker'),
    scope: 'mainScreen',
    withCtrl: true,
    keys: ['e'],
  },
  conversationSettingsModal: {
    name: tr('conversationSettings'),
    scope: 'mainScreen',
    withCtrl: true,
    keys: ['.'],
  },
  // Message Shortcuts
  messageToggleReactionBar: {
    name: tr('toggleReactionBarMessage'),
    scope: 'message',
    keys: ['e'],
  },
  messageToggleReply: {
    name: tr('toggleReplyMessage'),
    scope: 'message',
    keys: ['r'],
  },
  messageCopyText: {
    name: tr('messageCopy'),
    scope: 'message',
    withCtrl: true,
    keys: ['c'],
  },
  messageSaveAttachment: {
    name: tr('saveMessageAttachment'),
    scope: 'message',
    withCtrl: true,
    keys: ['s'],
  },
  // NOTE: these are currently dummy shortcuts, they are native or implemented differently
  messageOpenContextMenu: {
    name: tr('openMessageContextMenu'),
    scope: 'message',
    keys: ['Enter'],
  },
} as const satisfies Record<string, KbdShortcutOptions>;

export const KbdShortcutInformation: Record<string, Array<KbdShortcutOptions>> = {
  general: [
    KbdShortcut.newConversation,
    KbdShortcut.newMessage,
    KbdShortcut.createGroup,
    KbdShortcut.joinCommunity,
    KbdShortcut.openNoteToSelf,
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
  message: [
    KbdShortcut.messageCopyText,
    KbdShortcut.messageToggleReply,
    KbdShortcut.messageToggleReactionBar,
    KbdShortcut.messageSaveAttachment,
    KbdShortcut.messageOpenContextMenu,
  ],
  view: [KbdShortcut.zoomIn, KbdShortcut.zoomOut],
};
