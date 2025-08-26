// eslint-disable-next-line import/no-unresolved
import {} from 'styled-components/cssprop';

import { Store } from '@reduxjs/toolkit';
import { Persistor } from 'redux-persist/es/types';

import { PrimaryColorStateType, ThemeStateType } from './themes/constants/colors';
import type { EventEmitter } from './shared/event_emitter';
import type { SessionFlags } from './state/ducks/types/releasedFeaturesReduxTypes';

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
    versionInfo: { environment: string; version: string; commitHash: string; appInstance: string };
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
    setAutoStartEnabled: (val: boolean) => Promise<void>;
    getAutoStartEnabled: () => Promise<boolean>;
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
