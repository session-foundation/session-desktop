// TODO move into redux slice

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export enum SectionType {
  Profile,
  Message,
  ThemeSwitch,
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
  isAppFocused: false,
  leftOverlayMode: undefined,
  rightOverlayMode: { type: 'default', params: null },
};

export type SectionStateType = {
  focusedSection: SectionType;
  isAppFocused: boolean;
  leftOverlayMode: LeftOverlayMode | undefined;
  rightOverlayMode: RightOverlayMode | undefined;
};

const sectionSlice = createSlice({
  name: 'sectionSlice',
  initialState: initialSectionState,
  reducers: {
    showLeftPaneSection(state, action: PayloadAction<SectionType>) {
      return {
        ...state,
        focusedSection: action.payload,
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
