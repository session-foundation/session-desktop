import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { isEmpty } from 'lodash';

export interface DebugState {
  debugMode: boolean;
}

export const initialDebugState = {
  debugMode: !isEmpty(process.env.SESSION_DEV),
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
