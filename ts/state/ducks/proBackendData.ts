import type { WithMasterPrivKeyHex, WithRotatingPrivKeyHex } from 'libsession_util_nodejs';
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { StateType } from '../reducer';
import {
  ProProofResultType,
  ProStatusResultType,
} from '../../session/apis/pro_backend_api/schemas';
import ProBackendAPI from '../../session/apis/pro_backend_api/ProBackendAPI';
import { getFeatureFlag } from './types/releasedFeaturesReduxTypes';
import { UserUtils } from '../../session/utils';
import { getProRotatingPrivateKeyHex } from '../../session/utils/User';

type RequestState<D = unknown> = {
  isFetching: boolean;
  // Shortcut for `isFetching && !data`
  isLoading: boolean;
  // Shortcut for `!!error`
  isError: boolean;
  error: string | null;
  t: number;
  data: D | null;
};

const defaultRequestState = {
  isFetching: false,
  isLoading: false,
  isError: false,
  error: null,
  t: 0,
  data: null,
} satisfies RequestState;

export type RequestActionArgs = {
  key: keyof ProBackendDataState;
  result: boolean;
};

type ReducerBooleanStateAction = PayloadAction<RequestActionArgs>;

export type ProBackendDataState = {
  proof: RequestState<ProProofResultType>;
  proStatus: RequestState<ProStatusResultType>;
};

export const initialProBackendDataState: ProBackendDataState = {
  proof: defaultRequestState,
  proStatus: defaultRequestState,
};

type ApiResponse<T> = {
  status_code: number;
  t: number;
  result: T;
};

type CreateProBackendFetchAsyncThunk<D> = {
  key: keyof ProBackendDataState;
  getter: () => Promise<ApiResponse<D> | null>;
  payloadCreator: Parameters<Parameters<typeof createAsyncThunk>['1']>['1'];
};

async function createProBackendFetchAsyncThunk<D>({
  key,
  getter,
  payloadCreator,
}: CreateProBackendFetchAsyncThunk<D>): Promise<RequestState<D>> {
  try {
    if (getFeatureFlag('debugServerRequests')) {
      window.log.info(`[${key}] starting ${new Date().toISOString()}`);
    }

    const state = payloadCreator.getState() as StateType;
    if (state.proBackendData[key].isFetching) {
      return state.proBackendData[key] as RequestState<D>;
    }

    payloadCreator.dispatch(proBackendDataSlice.actions.setIsFetching({ key, result: true }));
    payloadCreator.dispatch(
      proBackendDataSlice.actions.setIsLoading({
        key,
        result: !state.proBackendData[key].data,
      })
    );

    const response = await getter();
    if (!response) {
      throw new Error('Data fetch failed');
    }

    if (response.status_code !== 200) {
      return {
        data: state.proBackendData[key].data as D | null,
        error: 'TODO: get the error',
        isError: true,
        isFetching: false,
        isLoading: false,
        t: response.t,
      };
    }

    return {
      data: response.result as D,
      error: null,
      isError: false,
      isFetching: false,
      isLoading: false,
      t: response.t,
    };
  } catch (e) {
    window?.log?.error(e);
    return {
      data: null as D,
      error: e.message,
      isError: true,
      isFetching: false,
      isLoading: false,
      t: 0,
    };
  } finally {
    payloadCreator.dispatch(proBackendDataSlice.actions.setIsFetching({ key, result: false }));
    payloadCreator.dispatch(proBackendDataSlice.actions.setIsLoading({ key, result: false }));
  }
}

const fetchProProofFromProBackend = createAsyncThunk(
  'proBackendData/fetchProProof',
  async (
    args: WithMasterPrivKeyHex & WithRotatingPrivKeyHex,
    payloadCreator
  ): Promise<RequestState<ProProofResultType>> => {
    return createProBackendFetchAsyncThunk({
      key: 'proof',
      getter: () => ProBackendAPI.getProProof(args),
      payloadCreator,
    });
  }
);

const fetchProStatusFromProBackend = createAsyncThunk(
  'proBackendData/fetchProStatus',
  async (
    args: WithMasterPrivKeyHex,
    payloadCreator
  ): Promise<RequestState<ProStatusResultType>> => {
    return createProBackendFetchAsyncThunk({
      key: 'proStatus',
      getter: () => ProBackendAPI.getProStatus(args),
      payloadCreator,
    });
  }
);

const refreshProProofFromProBackend = createAsyncThunk(
  'proBackendData/refreshProProof',
  async (_opts, payloadCreator) => {
    if (getFeatureFlag('debugServerRequests')) {
      window.log.info(
        `[proBackend/refreshProProofFromProBackend] starting ${new Date().toISOString()}`
      );
    }

    const state = payloadCreator.getState() as StateType;

    if (state.proBackendData.proof.isFetching) {
      return;
    }

    if (getFeatureFlag('debugServerRequests')) {
      window.log.info(
        `[proBackend/refreshProProofFromProBackend] triggered refresh at ${new Date().toISOString()}`
      );
    }

    const masterPrivKeyHex = await UserUtils.getProMasterKeyHex();
    const rotatingPrivKeyHex = await getProRotatingPrivateKeyHex();

    payloadCreator.dispatch(
      fetchProProofFromProBackend({ masterPrivKeyHex, rotatingPrivKeyHex }) as any
    );
  }
);

const refreshProStatusFromProBackend = createAsyncThunk(
  'proBackendData/refreshProStatus',
  async (_opts, payloadCreator) => {
    if (getFeatureFlag('debugServerRequests')) {
      window.log.info(
        `[proBackend/refreshProStatusFromProBackend] starting ${new Date().toISOString()}`
      );
    }

    const state = payloadCreator.getState() as StateType;

    if (state.proBackendData.proStatus.isFetching) {
      return;
    }

    if (getFeatureFlag('debugServerRequests')) {
      window.log.info(
        `[proBackend/refreshProStatusFromProBackend] triggered refresh at ${new Date().toISOString()}`
      );
    }
    const masterPrivKeyHex = await UserUtils.getProMasterKeyHex();
    payloadCreator.dispatch(fetchProStatusFromProBackend({ masterPrivKeyHex }) as any);
  }
);

export const proBackendDataSlice = createSlice({
  name: 'proBackendData',
  initialState: initialProBackendDataState,
  reducers: {
    setIsFetching(state, action: ReducerBooleanStateAction) {
      state[action.payload.key].isFetching = action.payload.result;
      return state;
    },
    setIsLoading(state, action: ReducerBooleanStateAction) {
      state[action.payload.key].isLoading = action.payload.result;
      return state;
    },
    setIsError(state, action: ReducerBooleanStateAction) {
      state[action.payload.key].isError = action.payload.result;
      return state;
    },
  },
  extraReducers: builder => {
    builder.addCase(fetchProProofFromProBackend.fulfilled, (state, action) => {
      if (getFeatureFlag('debugServerRequests')) {
        window.log.info(
          `[proBackend / fetchProProofFromProBackend] fulfilled ${new Date().toISOString()} `,
          JSON.stringify(action.payload)
        );
      }
      state.proof = action.payload;
    });
    builder.addCase(fetchProProofFromProBackend.rejected, (_state, action) => {
      window.log.error(
        `[proBackend / fetchProProofFromProBackend] rejected ${action.error.message || action.error} `
      );
    });

    builder.addCase(fetchProStatusFromProBackend.fulfilled, (state, action) => {
      if (getFeatureFlag('debugServerRequests')) {
        window.log.info(
          `[proBackend / fetchProStatusFromProBackend] fulfilled ${new Date().toISOString()} `,
          JSON.stringify(action.payload)
        );
      }
      state.proStatus = action.payload;
    });
    builder.addCase(refreshProProofFromProBackend.fulfilled, (_state, _action) => {
      if (getFeatureFlag('debugServerRequests')) {
        window.log.info(
          `[proBackend / refreshProProofFromProBackend] fulfilled ${new Date().toISOString()} `
        );
      }
    });
    builder.addCase(refreshProProofFromProBackend.rejected, (_state, action) => {
      window.log.error(
        `[proBackend / refreshProProofFromProBackend] rejected ${JSON.stringify(action.error.message || action.error)} `
      );
    });
  },
});

export default proBackendDataSlice.reducer;
export const proBackendDataActions = {
  ...proBackendDataSlice.actions,
  fetchProProofFromProBackend,
  fetchProStatusFromProBackend,
  refreshProProofFromProBackend,
  refreshProStatusFromProBackend,
};
