import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { StateType } from '../reducer';
import {
  ProProofResultType,
  ProRevocationsResultType,
  ProStatusResultType,
} from '../../session/apis/pro_backend_api/types';
import ProBackendAPI from '../../session/apis/pro_backend_api/ProBackendAPI';
import { getFeatureFlag } from './types/releasedFeaturesReduxTypes';

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

type RequestActionArgs = {
  key: keyof ProBackendDataState;
  result: boolean;
};

type ReducerBooleanStateAction = PayloadAction<RequestActionArgs>;

export type ProBackendDataState = {
  proof: RequestState<ProProofResultType>;
  revocations: RequestState<ProRevocationsResultType>;
  proStatus: RequestState<ProStatusResultType>;
};

export const initialProBackendDataState: ProBackendDataState = {
  proof: defaultRequestState,
  revocations: defaultRequestState,
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
      throw new Error('already fetching');
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
  } finally {
    payloadCreator.dispatch(proBackendDataSlice.actions.setIsFetching({ key, result: false }));
    payloadCreator.dispatch(proBackendDataSlice.actions.setIsLoading({ key, result: false }));
  }
}

const fetchProProofFromProBackend = createAsyncThunk(
  'proBackendData/fetchProProof',
  async (_, payloadCreator): Promise<RequestState<ProProofResultType>> => {
    return createProBackendFetchAsyncThunk({
      key: 'proof',
      getter: ProBackendAPI.getProProof,
      payloadCreator,
    });
  }
);

const fetchProRevocationsFromProBackend = createAsyncThunk(
  'proBackendData/fetchProRevocations',
  async (_, payloadCreator): Promise<RequestState<ProRevocationsResultType>> => {
    return createProBackendFetchAsyncThunk({
      key: 'revocations',
      getter: ProBackendAPI.getRevocationList,
      payloadCreator,
    });
  }
);

const fetchProStatusFromProBackend = createAsyncThunk(
  'proBackendData/fetchProStatus',
  async (_, payloadCreator): Promise<RequestState<ProStatusResultType>> => {
    return createProBackendFetchAsyncThunk({
      key: 'proStatus',
      getter: ProBackendAPI.getProStatus,
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

    // TODO: why is this as any here and in network api backend?
    payloadCreator.dispatch(fetchProProofFromProBackend() as any);
  }
);

const refreshProRevocationsFromProBackend = createAsyncThunk(
  'proBackendData/refreshProRevocations',
  async (_opts, payloadCreator) => {
    if (getFeatureFlag('debugServerRequests')) {
      window.log.info(
        `[proBackend/refreshProRevocationsFromProBackend] starting ${new Date().toISOString()}`
      );
    }

    const state = payloadCreator.getState() as StateType;

    if (state.proBackendData.revocations.isFetching) {
      return;
    }

    if (getFeatureFlag('debugServerRequests')) {
      window.log.info(
        `[proBackend/refreshProRevocationsFromProBackend] triggered refresh at ${new Date().toISOString()}`
      );
    }

    // TODO: why is this as any here and in network api backend?
    payloadCreator.dispatch(fetchProRevocationsFromProBackend() as any);
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

    // TODO: why is this as any here and in network api backend?
    payloadCreator.dispatch(fetchProStatusFromProBackend() as any);
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
    builder.addCase(fetchProRevocationsFromProBackend.fulfilled, (state, action) => {
      if (getFeatureFlag('debugServerRequests')) {
        window.log.info(
          `[proBackend / fetchProRevocationsFromProBackend] fulfilled ${new Date().toISOString()} `,
          JSON.stringify(action.payload)
        );
      }
      state.revocations = action.payload;
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
  fetchProRevocationsFromProBackend,
  fetchProStatusFromProBackend,
  refreshProProofFromProBackend,
  refreshProRevocationsFromProBackend,
  refreshProStatusFromProBackend,
};
