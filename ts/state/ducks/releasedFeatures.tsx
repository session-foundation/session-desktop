import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface ReleasedFeaturesState {
  refreshedAt: number;
}

export const initialReleasedFeaturesState = {
  refreshedAt: Date.now(),
};

const releasedFeaturesSlice = createSlice({
  name: 'releasedFeatures',
  initialState: initialReleasedFeaturesState,
  reducers: {
    updateReleasedFeatures: (state, action: PayloadAction<number>) => {
      state.refreshedAt = action.payload;
      // Note: Compute the new state here based on the network time (and not the local one)
      // state.legacyGroupsReadOnly =
      //   NetworkTime.now() >= FEATURE_RELEASE_TIMESTAMPS.LEGACY_GROUP_READONLY;
      return state;
    },
  },
});

const { actions, reducer } = releasedFeaturesSlice;
export const { updateReleasedFeatures } = actions;
export const releasedFeaturesReducer = reducer;
