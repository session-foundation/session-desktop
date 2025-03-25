import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { NetworkTime } from '../../util/NetworkTime';
import { FEATURE_RELEASE_TIMESTAMPS } from '../../session/constants';

export interface ReleasedFeaturesState {
  legacyGroupDeprecationTimestampRefreshAtMs: number;
  legacyGroupsReadOnly: boolean;
}

export const initialReleasedFeaturesState = {
  legacyGroupDeprecationTimestampRefreshAtMs: Date.now(),
  legacyGroupsReadOnly: Date.now() >= FEATURE_RELEASE_TIMESTAMPS.LEGACY_GROUP_READONLY,
};

const releasedFeaturesSlice = createSlice({
  name: 'releasedFeatures',
  initialState: initialReleasedFeaturesState,
  reducers: {
    updateLegacyGroupDeprecationTimestampUpdatedAt: (state, action: PayloadAction<number>) => {
      state.legacyGroupDeprecationTimestampRefreshAtMs = action.payload;
      state.legacyGroupsReadOnly =
        NetworkTime.now() >= FEATURE_RELEASE_TIMESTAMPS.LEGACY_GROUP_READONLY;
      return state;
    },
  },
});

const { actions, reducer } = releasedFeaturesSlice;
export const { updateLegacyGroupDeprecationTimestampUpdatedAt } = actions;
export const releasedFeaturesReducer = reducer;
