import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { StateType } from '../reducer';
import {
  ProProofResultType,
  ProRevocationsResultType,
  ProStatusResultType,
} from '../../session/apis/pro_backend_api/types';
import ProBackendAPI from '../../session/apis/pro_backend_api/ProBackendAPI';

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

const fetchProProofFromProBackend = createAsyncThunk(
  'proBackendData/fetchProProof',
  async (_, payloadCreator): Promise<RequestState<ProProofResultType>> => {
    try {
      if (window.sessionFeatureFlags?.debugServerRequests) {
        window.log.info(
          `[networkData/fetchInfoFromSeshServer] starting ${new Date().toISOString()}`
        );
      }

      const state = payloadCreator.getState() as StateType;
      if (state.proBackendData.proof.isFetching) {
        throw new Error('already fetching');
      }

      payloadCreator.dispatch(
        proBackendDataSlice.actions.setIsFetching({ key: 'proof', result: true })
      );
      payloadCreator.dispatch(
        proBackendDataSlice.actions.setIsLoading({
          key: 'proof',
          result: !state.proBackendData.proof.data,
        })
      );

      const response = await ProBackendAPI.getProProof();
      if (!response) {
        throw new Error('Data fetch failed');
      }

      if (response.status_code !== 200) {
        return {
          data: state.proBackendData.proof.data,
          error: 'TODO: get the error',
          isError: true,
          isFetching: false,
          isLoading: false,
          t: response.t,
        };
      }

      return {
        data: response.result,
        error: null,
        isError: false,
        isFetching: false,
        isLoading: false,
        t: response.t,
      };
    } finally {
      payloadCreator.dispatch(
        proBackendDataSlice.actions.setIsFetching({ key: 'proof', result: false })
      );
      payloadCreator.dispatch(
        proBackendDataSlice.actions.setIsLoading({ key: 'proof', result: false })
      );
    }
  }
);

const refreshProProofFromProBackend = createAsyncThunk(
  'proBackendData/refreshProProof',
  async (_opts, payloadCreator) => {
    if (window.sessionFeatureFlags?.debugServerRequests) {
      window.log.info(
        `[networkData/refreshInfoFromSeshServer] starting ${new Date().toISOString()}`
      );
    }

    const state = payloadCreator.getState() as StateType;

    if (state.proBackendData.proof.isFetching) {
      return;
    }

    if (window.sessionFeatureFlags?.debugServerRequests) {
      window.log.info(
        `[networkData/refreshInfoFromSeshServer] triggered refresh at ${new Date().toISOString()}`
      );
    }

    // TODO: why is this as any here and in network api backend?
    payloadCreator.dispatch(fetchProProofFromProBackend() as any);
  }
);

type ProBackendReducerBooleanStateAction = PayloadAction<{
  key: keyof ProBackendDataState;
  result: boolean;
}>;

export const proBackendDataSlice = createSlice({
  name: 'proBackendData',
  initialState: initialProBackendDataState,
  reducers: {
    setIsFetching(state, action: ProBackendReducerBooleanStateAction) {
      state[action.payload.key].isFetching = action.payload.result;
      return state;
    },

    setIsLoading(state, action: ProBackendReducerBooleanStateAction) {
      state[action.payload.key].isLoading = action.payload.result;
      return state;
    },
    setIsError(state, action: ProBackendReducerBooleanStateAction) {
      state[action.payload.key].isError = action.payload.result;
      return state;
    },
  },
  extraReducers: builder => {
    builder.addCase(fetchProProofFromProBackend.fulfilled, (state, action) => {
      if (window.sessionFeatureFlags?.debugServerRequests) {
        window.log.info(
          `[networkData / fetchInfoFromSeshServer] fulfilled ${new Date().toISOString()} `,
          JSON.stringify(action.payload)
        );
      }
      state.proof = action.payload;
    });
    builder.addCase(fetchProProofFromProBackend.rejected, (_state, action) => {
      window.log.error(
        `[networkData / fetchInfoFromSeshServer] rejected ${action.error.message || action.error} `
      );
    });
    builder.addCase(refreshProProofFromProBackend.fulfilled, (_state, _action) => {
      if (window.sessionFeatureFlags?.debugServerRequests) {
        window.log.info(
          `[networkData / refreshInfoFromSeshServer] fulfilled ${new Date().toISOString()} `
        );
      }
    });
    builder.addCase(refreshProProofFromProBackend.rejected, (_state, action) => {
      window.log.error(
        `[networkData / refreshInfoFromSeshServer] rejected ${JSON.stringify(action.error.message || action.error)} `
      );
    });
  },
});

export default proBackendDataSlice.reducer;
export const proBackendDataActions = {
  ...proBackendDataSlice.actions,
  fetchProProofFromProBackend,
  refreshProProofFromProBackend,
};
