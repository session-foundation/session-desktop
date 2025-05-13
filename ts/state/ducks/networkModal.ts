import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { LocalizerProps } from '../../components/basic/Localizer';

export type NetworkModalState = {
  infoLoading: boolean;
  nodesLoading: boolean;
  lastRefreshedTimestamp: number;
  errorMessage: LocalizerProps | null;
};

export const initialNetworkModalState: NetworkModalState = {
  infoLoading: false,
  nodesLoading: false,
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
    setNodesLoading(state, action: PayloadAction<boolean>) {
      state.nodesLoading = action.payload;
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

export const { setInfoLoading, setNodesLoading, setLastRefreshedTimestamp, setErrorMessage } =
  networkModalSlice.actions;
export default networkModalSlice.reducer;
