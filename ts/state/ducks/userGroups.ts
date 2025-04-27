/* eslint-disable no-await-in-loop */
import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { GroupPubkeyType } from 'libsession_util_nodejs';
import type { UserGroupsRedux } from './types/groupReduxTypes';

export type UserGroupState = {
  userGroups: Record<GroupPubkeyType, UserGroupsRedux>;
};

export const initialUserGroupState: UserGroupState = {
  userGroups: {},
};

const userGroupSlice = createSlice({
  name: 'userGroup',
  initialState: initialUserGroupState,

  reducers: {
    refreshUserGroupsSlice(
      state: UserGroupState,
      action: PayloadAction<{ groups: Array<UserGroupsRedux> }>
    ) {
      state.userGroups = {};
      action.payload.groups.forEach(m => {
        state.userGroups[m.pubkeyHex] = m;
      });

      return state;
    },
    refreshUserGroupDetails(
      state: UserGroupState,
      { payload }: PayloadAction<{ group: UserGroupsRedux }>
    ) {
      state.userGroups[payload.group.pubkeyHex] = payload.group;

      return state;
    },
    deleteUserGroupDetails(
      state: UserGroupState,
      { payload }: PayloadAction<{ group: { pubkey: GroupPubkeyType } }>
    ) {
      delete state.userGroups[payload.group.pubkey];

      return state;
    },
  },
});

export const userGroupsActions = {
  ...userGroupSlice.actions,
};
export const userGroupReducer = userGroupSlice.reducer;
