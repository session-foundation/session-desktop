import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { isEmpty } from 'lodash';

import type { InfoResponse } from '../../session/apis/network_api/types';
import type { DeepNullable } from '../../types/Util';
import { setInfoFakeRefreshing, setInfoLoading, setLastRefreshedTimestamp } from './networkModal';
import NetworkApi from '../../session/apis/network_api/NetworkApi';
import type { StateType } from '../reducer';
import { DURATION } from '../../session/constants';
import { batchGlobalIsSuccess } from '../../session/apis/open_group_api/sogsv3/sogsV3BatchPoll';
import { sleepFor } from '../../session/utils/Promise';

export type NetworkDataState = DeepNullable<InfoResponse>;

export const initialNetworkDataState: NetworkDataState = {
  t: 0,
  status_code: null,
  price: {
    usd: null,
    usd_market_cap: null,
    t_price: null,
    t_stale: null,
  },
  token: {
    staking_requirement: null,
    staking_reward_pool: null,
    contract_address: null,
  },
  network: {
    network_size: null,
    network_staked_tokens: null,
    network_staked_usd: null,
  },
};

// #region - Async thunks
const fetchInfoFromSeshServer = createAsyncThunk(
  'networkData/fetchInfoFromSeshServer',
  async (_, payloadCreator): Promise<InfoResponse> => {
    try {
      if (window.sessionFeatureFlags?.debug.debugServerRequests) {
        window.log.info(
          `[networkData/fetchInfoFromSeshServer] starting ${new Date().toISOString()}`
        );
      }

      const state = payloadCreator.getState() as StateType;
      const infoLoading = state.networkModal.infoLoading;
      const stalePriceTimestamp = state.networkData.price.t_stale;

      if (infoLoading) {
        throw new Error('already loading');
      }

      payloadCreator.dispatch(setInfoLoading(true));
      const networkApi = new NetworkApi();
      const result = await networkApi.getInfo();
      if (!result) {
        throw new Error('Data fetch failed');
      }

      if (
        !batchGlobalIsSuccess(result) &&
        stalePriceTimestamp &&
        Date.now() / 1000 > stalePriceTimestamp
      ) {
        payloadCreator.dispatch(networkDataActions.clearCachedData());
        payloadCreator.dispatch(setLastRefreshedTimestamp(0));
        throw new Error(
          `Data fetch failed with ${result.status_code} error. Clearing stale cache data.`
        );
      }

      payloadCreator.dispatch(setLastRefreshedTimestamp(Date.now()));
      return result;
    } finally {
      payloadCreator.dispatch(setInfoLoading(false));
    }
  }
);

const refreshInfoFromSeshServer = createAsyncThunk(
  'networkData/refreshInfoFromSeshServer',
  async (_opts, payloadCreator) => {
    if (window.sessionFeatureFlags?.debug.debugServerRequests) {
      window.log.info(
        `[networkData/refreshInfoFromSeshServer] starting ${new Date().toISOString()}`
      );
    }

    const state = payloadCreator.getState() as StateType;
    const { infoFakeRefreshing, infoLoading } = state.networkModal;
    const infoTimestamp = state.networkData.t;
    const stalePriceTimestamp = state.networkData.price.t_stale;

    // if we are already fake refreshing, cancel this call
    if (infoFakeRefreshing) {
      return;
    }

    if (infoTimestamp && stalePriceTimestamp && Date.now() / 1000 <= stalePriceTimestamp) {
      if (window.sessionFeatureFlags?.debug.debugServerRequests) {
        window.log.info(
          `[networkData/refreshInfoFromSeshServer] using cache. Data will be stale at ${new Date(stalePriceTimestamp * 1000).toISOString()}`
        );
      }
      payloadCreator.dispatch(setInfoFakeRefreshing(true));
      await sleepFor(0.5 * DURATION.SECONDS);
      payloadCreator.dispatch(setInfoFakeRefreshing(false));
      payloadCreator.dispatch(setLastRefreshedTimestamp(Date.now()));

      return;
    }

    if (!infoTimestamp && !stalePriceTimestamp) {
      if (window.sessionFeatureFlags?.debug.debugServerRequests) {
        window.log.info(
          `[networkData/refreshInfoFromSeshServer] no data to refresh ${new Date().toISOString()}`
        );
      }
    }

    if (
      infoLoading &&
      infoTimestamp &&
      stalePriceTimestamp &&
      infoTimestamp <= stalePriceTimestamp
    ) {
      payloadCreator.dispatch(setInfoLoading(false));
      throw new Error('Stuck loading');
    }

    if (window.sessionFeatureFlags?.debug.debugServerRequests) {
      window.log.info(
        `[networkData/refreshInfoFromSeshServer] triggered refresh${infoTimestamp ? ` at ${new Date(infoTimestamp * 1000).toISOString()}` : ''}`
      );
    }

    payloadCreator.dispatch(fetchInfoFromSeshServer() as any);
  }
);

// #endregion

export const networkDataSlice = createSlice({
  name: 'networkData',
  initialState: initialNetworkDataState,
  reducers: {
    clearCachedData(state) {
      return { ...initialNetworkDataState, status_code: state.status_code, t: state.t };
    },
  },
  extraReducers: builder => {
    builder.addCase(fetchInfoFromSeshServer.fulfilled, (state, action) => {
      if (window.sessionFeatureFlags?.debug.debugServerRequests) {
        window.log.info(
          `[networkData/fetchInfoFromSeshServer] fulfilled ${new Date().toISOString()}`,
          JSON.stringify(action.payload)
        );
      }
      const { t, status_code, price, token, network } = action.payload;
      state.t = t;
      state.status_code = status_code;
      if (!isEmpty(price)) {
        state.price = price;
      }
      if (!isEmpty(token)) {
        state.token = token;
      }
      if (!isEmpty(network)) {
        state.network = network;
      }
    });
    builder.addCase(fetchInfoFromSeshServer.rejected, (_state, action) => {
      window.log.error(
        `[networkData/fetchInfoFromSeshServer] rejected ${action.error.message || action.error}`
      );
    });
    builder.addCase(refreshInfoFromSeshServer.fulfilled, (_state, _action) => {
      if (window.sessionFeatureFlags?.debug.debugServerRequests) {
        window.log.info(
          `[networkData/refreshInfoFromSeshServer] fulfilled ${new Date().toISOString()}`
        );
      }
    });
    builder.addCase(refreshInfoFromSeshServer.rejected, (_state, action) => {
      window.log.error(
        `[networkData/refreshInfoFromSeshServer] rejected ${JSON.stringify(action.error.message || action.error)}`
      );
    });
  },
});

export default networkDataSlice.reducer;
export const networkDataActions = {
  ...networkDataSlice.actions,
  fetchInfoFromSeshServer,
  refreshInfoFromSeshServer,
};
