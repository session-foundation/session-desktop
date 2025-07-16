import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { ToastUtils } from '../../session/utils';
import { Storage } from '../../util/storage';

export interface ReleasedFeaturesState {
  refreshedAt: number;
}

export const initialReleasedFeaturesState = {
  refreshedAt: Date.now(),
};

// #region - Async Thunks

// NOTE as features are released in production they will be removed from this list
const resetExperiments = createAsyncThunk(
  'releasedFeatures/resetExperiments',
  async (_, _payloadCreator): Promise<void> => {
    // reset the redux state
    // payloadCreator.dispatch(releasedFeaturesActions.updateSesh101NotificationAt(0));

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

      // state.sesh101NotificationAt = handleReleaseNotification({
      //   featureName: 'useSESH101',
      //   message: tr('sessionNetworkNotificationLive'),
      //   lastRefreshedAt: state.refreshedAt,
      //   notifyAt: state.sesh101NotificationAt,
      //   delayMs: 1 * DURATION.HOURS,
      // });

      return state;
    },
    // updateSesh101NotificationAt(state, action: PayloadAction<number>) {
    //   if (isValidUnixTimestamp(action.payload)) {
    //     state.sesh101NotificationAt = action.payload;
    //   } else {
    //     window.log.error(
    //       `[releasedFeatures/updateSesh101NotificationAt] invalid timestamp ${action.payload}`
    //     );
    //   }

    //   return state;
    // },
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
