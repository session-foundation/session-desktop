import { isBoolean, merge } from 'lodash';

import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import {
  isSettingsBoolKey,
  type SettingsBoolKey,
  SettingsBools,
  SettingsDefault,
  type SettingsState,
} from '../../data/settings-key';

export function getSettingsDefaultState(): SettingsState {
  const settingsBools = Object.fromEntries(SettingsBools.map(key => [key, SettingsDefault[key]]));

  return {
    settingsBools,
  } as SettingsState;
}

export async function getSettingsInitialState(): Promise<SettingsState> {
  const nodeState = await window.getNodeSettings();
  const defaultState = getSettingsDefaultState();

  return merge(defaultState, nodeState);
}

/**
 * This slice is the one holding the settings of the currently logged in user in redux.
 * This is in addition to the settings stored in the Storage class but is a memory only representation of them.
 * You should not try to make changes here, but instead through the Storage class.
 * What you can do with this slice, is to create selectors and hooks to keep your UI in sync with the state in whatever is Storage.
 */
const settingsSlice = createSlice({
  name: 'settings',
  // when this createSlice gets invoke, the storage is not ready, but redux still wants a state so we just avoid hitting the storage.
  // Once the storage is ready,
  initialState: getSettingsDefaultState(),
  reducers: {
    updateAllOnStorageReady(state, { payload }: PayloadAction<Record<SettingsBoolKey, boolean>>) {
      state.settingsBools = merge(state.settingsBools, payload);
      return state;
    },
    updateSettingsBoolValue(state, action: PayloadAction<{ id: string; value: boolean }>) {
      const { id, value } = action.payload;

      if (!isSettingsBoolKey(id) || !isBoolean(value)) {
        return state;
      }

      state.settingsBools[id] = value;

      return state;
    },
    deleteSettingsBoolValue(state, action: PayloadAction<string>) {
      if (!isSettingsBoolKey(action.payload)) {
        return state;
      }

      delete state.settingsBools[action.payload];
      return state;
    },
  },
});

const { actions, reducer } = settingsSlice;
export const { updateSettingsBoolValue, deleteSettingsBoolValue, updateAllOnStorageReady } =
  actions;
export const settingsReducer = reducer;
