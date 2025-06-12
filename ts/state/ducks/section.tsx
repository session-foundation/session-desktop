// TODO move into redux slice

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { SessionSettingCategory } from '../../types/ReduxTypes';

export enum SectionType {
  Profile,
  Message,
  Settings,
  ColorMode,
  PathIndicator,
  DebugMenu,
}

export type LeftOverlayMode =
  | 'choose-action'
  | 'message'
  | 'open-group'
  | 'closed-group'
  | 'message-requests'
  | 'invite-a-friend';

type RightPanelDefaultState = { type: 'default'; params: null };
type RightPanelMessageInfoState = {
  type: 'message_info';
  params: { messageId: string; visibleAttachmentIndex: number | undefined };
};
export type RightOverlayMode = RightPanelDefaultState | RightPanelMessageInfoState;

export const initialSectionState: SectionStateType = {
  focusedSection: SectionType.Message,
  focusedSettingsSection: undefined,
  isAppFocused: false,
  leftOverlayMode: undefined,
  rightOverlayMode: { type: 'default', params: null },
};

export type SectionStateType = {
  focusedSection: SectionType;
  focusedSettingsSection?: SessionSettingCategory;
  isAppFocused: boolean;
  leftOverlayMode: LeftOverlayMode | undefined;
  rightOverlayMode: RightOverlayMode | undefined;
};

const sectionSlice = createSlice({
  name: 'sectionSlice',
  initialState: initialSectionState,
  reducers: {
    showLeftPaneSection(state, action: PayloadAction<SectionType>) {
      if (action.payload === SectionType.Settings) {
        // on click on the gear icon: show the 'privacy' tab by default
        return {
          ...state,
          focusedSection: action.payload,
          focusedSettingsSection: 'privacy',
        };
      }
      return {
        ...state,
        focusedSection: action.payload,
        focusedSettingsSection: undefined,
      };
    },
    setLeftOverlayMode(state, action: PayloadAction<LeftOverlayMode>) {
      return {
        ...state,
        leftOverlayMode: action.payload,
      };
    },
    resetLeftOverlayMode(state) {
      return {
        ...state,
        leftOverlayMode: undefined,
      };
    },
    setRightOverlayMode(state, action: PayloadAction<RightOverlayMode>) {
      return {
        ...state,
        rightOverlayMode: action.payload,
      };
    },
    resetRightOverlayMode(state) {
      return {
        ...state,
        rightOverlayMode: undefined,
      };
    },
    showSettingsSection(state, action: PayloadAction<SessionSettingCategory>) {
      return {
        ...state,
        focusedSettingsSection: action.payload,
        focusedSection: SectionType.Settings,
      };
    },
    setIsAppFocused(state, action: PayloadAction<boolean>) {
      return {
        ...state,
        isAppFocused: action.payload,
      };
    },
  },
});

export const reducer = sectionSlice.reducer;
export const sectionActions = {
  ...sectionSlice.actions,
};
