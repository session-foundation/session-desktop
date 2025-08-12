import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { isDebugMode } from '../../shared/env_vars';

export interface DebugState {
  debugMode: boolean;
}

export const initialDebugState = {
  debugMode: isDebugMode(),
};

const debugSlice = createSlice({
  name: 'debug',
  initialState: initialDebugState,
  reducers: {
    setDebugMode: (state, action: PayloadAction<boolean>) => {
      state.debugMode = action.payload;
      return state;
    },
  },
});

const { actions, reducer } = debugSlice;
export const { setDebugMode } = actions;
export const debugReducer = reducer;
