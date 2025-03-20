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
      // if passing null, it means delete that entry from redux
      {
        payload,
      }: PayloadAction<{ group: { pubkey: GroupPubkeyType; details: UserGroupsRedux | null } }>
    ) {
      if (!payload.group.details) {
        delete state.userGroups[payload.group.pubkey];
      } else {
        state.userGroups[payload.group.pubkey] = payload.group.details;
      }

      return state;
    },
  },
});

export const userGroupsActions = {
  ...userGroupSlice.actions,
};
export const userGroupReducer = userGroupSlice.reducer;
