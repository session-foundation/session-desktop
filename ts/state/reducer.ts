import { combineReducers } from '@reduxjs/toolkit';

import { callReducer as call, CallStateType } from './ducks/call';
import { reducer as conversations, ConversationsStateType } from './ducks/conversations';
import { defaultRoomReducer as defaultRooms, DefaultRoomsState } from './ducks/defaultRooms';
import { reducer as primaryColor } from './ducks/primaryColor';
import { reducer as search, SearchStateType } from './ducks/search';
import { reducer as section, SectionStateType } from './ducks/section';
import { ReduxSogsRoomInfos, SogsRoomInfoState } from './ducks/sogsRoomInfo';
import { reducer as theme } from './ducks/theme';
import { reducer as user, UserStateType } from './ducks/user';

import { PrimaryColorStateType, ThemeStateType } from '../themes/constants/colors';
import { groupReducer, GroupState } from './ducks/metaGroups';
import { modalReducer as modals, ModalState } from './ducks/modalDialog';
import { defaultOnionReducer as onionPaths, OnionState } from './ducks/onion';
import { settingsReducer, SettingsState } from './ducks/settings';
import {
  reducer as stagedAttachments,
  StagedAttachmentsStateType,
} from './ducks/stagedAttachments';
import { userConfigReducer as userConfig, UserConfigState } from './ducks/userConfig';
import { userGroupReducer, UserGroupState } from './ducks/userGroups';
import { releasedFeaturesReducer, ReleasedFeaturesState } from './ducks/releasedFeatures';
import { debugReducer, type DebugState } from './ducks/debug';

export type StateType = {
  search: SearchStateType;
  user: UserStateType;
  conversations: ConversationsStateType;
  theme: ThemeStateType;
  primaryColor: PrimaryColorStateType;
  section: SectionStateType;
  defaultRooms: DefaultRoomsState;
  onionPaths: OnionState;
  modals: ModalState;
  userConfig: UserConfigState;
  stagedAttachments: StagedAttachmentsStateType;
  call: CallStateType;
  sogsRoomInfo: SogsRoomInfoState;
  settings: SettingsState;
  groups: GroupState;
  userGroups: UserGroupState;
  releasedFeatures: ReleasedFeaturesState;
  debug: DebugState;
};

const reducers = {
  search,
  conversations,
  user,
  theme,
  primaryColor,
  section,
  defaultRooms,
  onionPaths,
  modals,
  userConfig,
  stagedAttachments,
  call,
  sogsRoomInfo: ReduxSogsRoomInfos.sogsRoomInfoReducer,
  settings: settingsReducer,
  groups: groupReducer,
  userGroups: userGroupReducer,
  releasedFeatures: releasedFeaturesReducer,
  debug: debugReducer,
};

// Making this work would require that our reducer signature supported AnyAction, not
//   our restricted actions
export const rootReducer = combineReducers(reducers);
