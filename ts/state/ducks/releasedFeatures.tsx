import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { ToastUtils } from '../../session/utils';
import { Storage } from '../../util/storage';
import { DURATION } from '../../session/constants';
import { isValidUnixTimestamp } from '../../session/utils/Timestamps';
import { handleReleaseNotification } from '../../util/releasedFeatures';
import { localize } from '../../localization/localeTools';

export interface ReleasedFeaturesState {
  refreshedAt: number;
  sesh101Ready: boolean;
  sesh101NotificationAt: number;
}

export const initialReleasedFeaturesState = {
  refreshedAt: Date.now(),
  sesh101Ready: window.sessionFeatureFlags.useSESH101,
  sesh101NotificationAt: 0,
};

// #region - Async Thunks

// NOTE as features are released in production they will be removed from this list
const resetExperiments = createAsyncThunk(
  'releasedFeatures/resetExperiments',
  async (_, payloadCreator): Promise<void> => {
    // reset the feature flags
    window.sessionFeatureFlags.useReleaseChannels = false;
    window.sessionFeatureFlags.useSESH101 = false;

    // reset the redux state
    payloadCreator.dispatch(releasedFeaturesActions.updateSesh101Ready(false));
    payloadCreator.dispatch(releasedFeaturesActions.updateSesh101NotificationAt(0));

    // reset the storage
    await Storage.remove(`releaseNotification-useSESH101`);

    ToastUtils.pushToastInfo('releasedFeatures/resetExperiments', 'Reset experiments!');
  }
);
// #endregion

const releasedFeaturesSlice = createSlice({
  name: 'releasedFeatures',
  initialState: initialReleasedFeaturesState,
  reducers: {
    /**
     * Check if any features need to be released
     * @param action - the time we last checked for released features (network time not local)
     * @note This is called every second by useCheckReleasedFeatures
     */
    updateReleasedFeatures: (
      state,
      action: PayloadAction<{
        refreshedAt: number;
      }>
    ) => {
      const { refreshedAt } = action.payload;

      state.refreshedAt = refreshedAt;
      state.sesh101Ready = window.sessionFeatureFlags.useSESH101;

      if (state.sesh101Ready) {
        state.sesh101NotificationAt = handleReleaseNotification({
          featureName: 'useSESH101',
          message: localize('sessionNetworkNotificationLive').toString(),
          lastRefreshedAt: state.refreshedAt,
          notifyAt: state.sesh101NotificationAt,
          delayMs: 1 * DURATION.HOURS,
        });
      }

      return state;
    },
    updateSesh101Ready: (state, action: PayloadAction<boolean>) => {
      state.sesh101Ready = action.payload;
      return state;
    },
    updateSesh101NotificationAt(state, action: PayloadAction<number>) {
      if (isValidUnixTimestamp(action.payload)) {
        state.sesh101NotificationAt = action.payload;
      } else {
        window.log.error(
          `[releasedFeatures/updateSesh101NotificationAt] invalid timestamp ${action.payload}`
        );
      }

      return state;
    },
  },
  extraReducers: builder => {
    builder.addCase(resetExperiments.fulfilled, (_state, _action) => {
      window.log.info(`[releasedFeatures/resetExperiments] fulfilled ${new Date().toISOString()}`);
    });
    builder.addCase(resetExperiments.rejected, (_state, action) => {
      window.log.error(
        `[releasedFeatures/resetExperiments] rejected ${JSON.stringify(action.error.message || action.error)}`
      );
    });
  },
});

export default releasedFeaturesSlice.reducer;
export const releasedFeaturesActions = {
  ...releasedFeaturesSlice.actions,
  resetExperiments,
};
