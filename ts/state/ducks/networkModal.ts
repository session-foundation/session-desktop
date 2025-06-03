import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { LocalizerProps } from '../../components/basic/Localizer';

export type NetworkModalState = {
  infoLoading: boolean;
  /**
   * Use to simulate a refresh of the data, when we have some data in the cache still valid (not stale)
   */
  infoFakeRefreshing: boolean;
  lastRefreshedTimestamp: number;
  errorMessage: LocalizerProps | null;
};

export const initialNetworkModalState: NetworkModalState = {
  infoLoading: false,
  infoFakeRefreshing: false,
  lastRefreshedTimestamp: 0,
  errorMessage: null,
};

export const networkModalSlice = createSlice({
  name: 'networkModal',
  initialState: initialNetworkModalState,
  reducers: {
    setInfoLoading(state, action: PayloadAction<boolean>) {
      state.infoLoading = action.payload;
      return state;
    },
    setInfoFakeRefreshing(state, action: PayloadAction<boolean>) {
      state.infoFakeRefreshing = action.payload;
      return state;
    },
    setLastRefreshedTimestamp(state, action: PayloadAction<number>) {
      state.lastRefreshedTimestamp = action.payload;
      return state;
    },
    setErrorMessage(state, action: PayloadAction<LocalizerProps | null>) {
      state.errorMessage = action.payload;
      return state;
    },
  },
});

export const { setInfoLoading, setInfoFakeRefreshing, setLastRefreshedTimestamp, setErrorMessage } =
  networkModalSlice.actions;
export default networkModalSlice.reducer;
