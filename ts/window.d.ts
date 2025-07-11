// eslint-disable-next-line import/no-unresolved
import {} from 'styled-components/cssprop';

import { Store } from '@reduxjs/toolkit';
import { Persistor } from 'redux-persist/es/types';

import { PrimaryColorStateType, ThemeStateType } from './themes/constants/colors';
import type { GetMessageArgs, MergedLocalizerTokens } from './localization/localeTools';
import type { I18nMethods } from './types/I18nMethods';
import type { EventEmitter } from './shared/event_emitter';
import type { SessionFlags } from './state/ducks/types/releasedFeaturesReduxTypes';

export interface LibTextsecure {
  messaging: boolean;
}

/*
We declare window stuff here instead of global.d.ts because we are importing other declarations.
If you import anything in global.d.ts, the type system won't work correctly.
*/

declare global {
  interface Window {
    Events: any;
    Whisper: { events: EventEmitter };
    clearLocalData: () => Promise<void>;
    clipboard: any;
    getSettingValue: (id: string, comparisonValue?: any) => any;
    setSettingValue: (id: string, value: any) => Promise<void>;

    /** NOTE: Because of docstring limitations changes MUST be manually synced between {@link setupI18n.getMessage } and {@link window.i18n } */
    /**
     * @deprecated this will eventually be replaced by LocalizedStringBuilder
     * Retrieves a localized message string, substituting variables where necessary.
     *
     * @param token - The token identifying the message to retrieve.
     * @param args - An optional record of substitution variables and their replacement values. This is required if the string has dynamic variables.
     *
     * @returns The localized message string with substitutions applied.
     */
    i18n: (<T extends MergedLocalizerTokens>(...[token, args]: GetMessageArgs<T>) => string) & {
      /** NOTE: Because of docstring limitations changes MUST be manually synced between {@link setupI18n.getRawMessage } and {@link window.i18n.getRawMessage } */
      /**
       * Retrieves a localized message string, without substituting any variables. This resolves any plural forms using the given args
       * @param token - The token identifying the message to retrieve.
       * @param args - An optional record of substitution variables and their replacement values. This is required if the string has dynamic variables.
       *
       * @returns The localized message string with substitutions applied.
       *
       * @deprecated
       *
       * NOTE: This is intended to be used to get the raw string then format it with {@link formatMessageWithArgs}
       */
      getRawMessage: I18nMethods['getRawMessage'];

      /** NOTE: Because of docstring limitations changes MUST be manually synced between {@link setupI18n.formatMessageWithArgs } and {@link window.i18n.formatMessageWithArgs } */
      /**
       * Formats a localized message string with arguments and returns the formatted string.
       * @param rawMessage - The raw message string to format. After using @see {@link getRawMessage} to get the raw string.
       * @param args - An optional record of substitution variables and their replacement values. This
       * is required if the string has dynamic variables. This can be optional as a strings args may be defined in @see {@link LOCALE_DEFAULTS}
       *
       * @returns The formatted message string.
       *
       * @deprecated
       */
      formatMessageWithArgs: I18nMethods['formatMessageWithArgs'];

      strippedWithObj: I18nMethods['strippedWithObj'];
    };
    log: any;
    sessionFeatureFlags: SessionFlags;
    onLogin: (pw: string) => Promise<void>; // only set on the password window
    onTryPassword: (pw: string) => Promise<void>; // only set on the main window
    persistStore?: Persistor;
    restart: () => void;
    getSeedNodeList: () => Array<string> | undefined;
    setPassword: (
      newPassword: string | null,
      oldPassword: string | null
    ) => Promise<string | undefined>;
    isOnline: boolean;
    toggleMediaPermissions: () => Promise<void>;
    toggleCallMediaPermissionsTo: (enabled: boolean) => Promise<void>;
    getCallMediaPermissions: () => boolean;
    toggleMenuBar: () => void;
    toggleSpellCheck: () => void;
    primaryColor: PrimaryColorStateType;
    theme: ThemeStateType;
    setTheme: (newTheme: string) => Promise<void>;
    userConfig: any;
    versionInfo: any;
    readyForUpdates: () => void;
    drawAttention: () => void;

    platform: string;
    openFromNotification: (conversationKey?: string) => void;
    getEnvironment: () => string;
    getNodeVersion: () => string;

    showWindow: () => void;
    setCallMediaPermissions: (val: boolean) => void;
    setMediaPermissions: (val: boolean) => void;
    askForMediaAccess: () => void;
    getMediaPermissions: () => boolean;
    nodeSetImmediate: any;

    getTitle: () => string;
    getAppInstance: () => string;
    getCommitHash: () => string | undefined;
    getVersion: () => string;
    getOSRelease: () => string;
    saveLog: () => void;
    setAutoHideMenuBar: (val: boolean) => void;
    setMenuBarVisibility: (val: boolean) => void;
    contextMenuShown: boolean;
    inboxStore?: Store;
    getState: () => unknown;
    openConversationWithMessages: (args: {
      conversationKey: string;
      messageId: string | null;
    }) => Promise<void>;
    setStartInTray: (val: boolean) => Promise<void>;
    getStartInTray: () => Promise<boolean>;
    getOpengroupPruning: () => Promise<boolean>;
    setOpengroupPruning: (val: boolean) => Promise<void>;
    closeAbout: () => void;
    getAutoUpdateEnabled: () => boolean;
    setAutoUpdateEnabled: (enabled: boolean) => void;
    setZoomFactor: (newZoom: number) => void;
    updateZoomFactor: () => void;
    getUserKeys: () => Promise<{ id: string; vbid: string }>;
  }
}
