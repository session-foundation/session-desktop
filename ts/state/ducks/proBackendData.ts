import type {
  ProProof,
  WithMasterPrivKeyHex,
  WithRotatingPrivKeyHex,
} from 'libsession_util_nodejs';
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { StateType } from '../reducer';
import ProBackendAPI from '../../session/apis/pro_backend_api/ProBackendAPI';
import { getFeatureFlag } from './types/releasedFeaturesReduxTypes';
import { UserUtils } from '../../session/utils';
import { getProRotatingPrivateKeyHex, getProMasterKeyHex } from '../../session/utils/User';
import { updateLocalizedPopupDialog } from './modalDialog';
import { showLinkVisitWarningDialog } from '../../components/dialog/OpenUrlModal';
import { ProStatus } from '../../session/apis/pro_backend_api/types';
import { SettingsKey } from '../../data/settings-key';
import {
  ProProofResultType,
  ProDetailsResultType,
} from '../../session/apis/pro_backend_api/schemas';
import { UserConfigWrapperActions } from '../../webworker/workers/browser/libsession_worker_interface';
import { Storage } from '../../util/storage';
import { NetworkTime } from '../../util/NetworkTime';
import { assertUnreachable } from '../../types/sqlSharedTypes';


type RequestState<D = unknown> = {
  isFetching: boolean;
  // Shortcut for `isFetching && !data`
  isLoading: boolean;
  // Shortcut for `!!error`
  isError: boolean;
  // True if the request has been made
  isEnabled: boolean;
  error: string | null;
  t: number;
  data: D | null;
};

const defaultRequestState = {
  isFetching: false,
  isLoading: false,
  isError: false,
  isEnabled: false,
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
  details: RequestState<ProDetailsResultType>;
};

export const initialProBackendDataState: ProBackendDataState = {
  proof: defaultRequestState,
  details: defaultRequestState,
};

type ApiResponse<T> = {
  status_code: number;
  t: number;
  result: T;
};

type PayloadCreatorType = Parameters<Parameters<typeof createAsyncThunk>['1']>['1'];

type CreateProBackendFetchAsyncThunk<D> = {
  key: keyof ProBackendDataState;
  getter: () => Promise<ApiResponse<D> | null>;
  payloadCreator: PayloadCreatorType;
  contextHandler?: (state: RequestState<D>) => Promise<void>;
  // Runs at the end of the function, as long as the function doesn't early return because it was already fetching.
  callback?: (initialState: RequestState<D>, state: RequestState<D>) => Promise<void>;
};

export type WithCallerContext = { callerContext?: 'recover' };

async function createProBackendFetchAsyncThunk<D>({
  key,
  getter,
  payloadCreator,
  contextHandler,
  callback,
}: CreateProBackendFetchAsyncThunk<D>): Promise<RequestState<D>> {
  const debug = getFeatureFlag('debugServerRequests');
  if (debug) {
    window?.log?.info(`[${key}] starting ${new Date().toISOString()}`);
  }

  const state = payloadCreator.getState() as StateType;
  const initialState = state.proBackendData[key] as RequestState<D>;
  let result = initialState;
  try {
    if (initialState.isFetching) {
      if (debug) {
        window?.log?.info(`[${key}] already fetching! returning no-op ${new Date().toISOString()}`);
      }
      // no operation
      return result;
    }

    if (!result.isEnabled) {
      payloadCreator.dispatch(
        proBackendDataSlice.actions.setIsLoading({
          key,
          result: true,
        })
      );
      payloadCreator.dispatch(proBackendDataSlice.actions.setIsEnabled({ key, result: true }));
    }
    payloadCreator.dispatch(proBackendDataSlice.actions.setIsFetching({ key, result: true }));

    const response = await getter();
    if (!response) {
      throw new Error('Data fetch failed');
    }

    if (response.status_code !== 200) {
      result = {
        data: result.data,
        error: 'TODO: get the error',
        isError: true,
        isFetching: false,
        isLoading: false,
        t: response.t,
        isEnabled: true,
      };
    } else {
      result = {
        data: response.result as D,
        error: null,
        isError: false,
        isFetching: false,
        isLoading: false,
        t: response.t,
        isEnabled: true,
      };
    }
  } catch (e) {
    window?.log?.error(e);
    result = {
      data: null as D,
      error: e.message,
      isError: true,
      isFetching: false,
      isLoading: false,
      t: 0,
      isEnabled: true,
    };
  }

  if (contextHandler) {
    await contextHandler(result);
  }

  if (callback) {
    await callback(initialState, result);
  }

  return result;
}

const fetchGenerateProProofFromProBackend = createAsyncThunk(
  'proBackendData/fetchGenerateProProof',
  async (
    args: WithMasterPrivKeyHex & WithRotatingPrivKeyHex,
    payloadCreator
  ): Promise<RequestState<ProProofResultType>> => {
    return createProBackendFetchAsyncThunk({
      key: 'proof',
      getter: () => ProBackendAPI.generateProProof(args),
      payloadCreator,
    });
  }
);

/** TODO: work out where and if we need this
function getProDetailsFromStorage() {
  const response = Storage.get(SettingsKey.proDetails);
  if (!response) {
    return null;
  }
  const result = ProDetailsResultSchema.safeParse(response);
  if (result.success) {
    return result.data;
  }
  window?.log?.error('failed to parse pro details from storage: ', result.error)
  return null;
}

*/

async function putProDetailsInStorage(details: ProDetailsResultType) {
  await Storage.put(SettingsKey.proDetails, details);
}

async function handleNewProProof(rotatingPrivKeyHex: string) {
  const masterPrivKeyHex = await getProMasterKeyHex();
  const response = await ProBackendAPI.generateProProof({
    masterPrivKeyHex,
    rotatingPrivKeyHex,
  });
  if (response?.status_code === 200) {
    const proProof = {
      expiryMs: response.result.expiry_unix_ts_ms,
      genIndexHashB64: response.result.gen_index_hash,
      rotatingPubkeyHex: response.result.rotating_pkey,
      version: response.result.version,
      signatureHex: response.result.sig,
    } satisfies ProProof;
    await UserConfigWrapperActions.setProConfig({ proProof, rotatingPrivKeyHex });
  } else {
    window?.log?.error('failed to get new pro proof: ', response);
  }
}

async function handleClearProProof() {
  // TODO: remove pro proof from user config
}

async function handleExpired() {
  // TODO: handle expired and expiring soon CTAs
}

async function handleProProof(accessExpiry: number, autoRenewing: boolean) {
  const proConfig = await UserConfigWrapperActions.getProConfig();
  const now = NetworkTime.now();

  // TODO: add buffer time to check expiry at least 1 min diff
  if (!proConfig || proConfig.proProof.expiryMs < now || (autoRenewing && accessExpiry < now)) {
    const rotatingPrivKeyHex =
      proConfig?.rotatingPrivKeyHex ?? (await UserUtils.getProRotatingPrivateKeyHex());
    await handleNewProProof(rotatingPrivKeyHex);
  }
}

const fetchGetProDetailsFromProBackend = createAsyncThunk(
  'proBackendData/fetchGetProDetails',
  async (
    { callerContext: context, ...args }: WithMasterPrivKeyHex & WithCallerContext,
    payloadCreator
  ): Promise<RequestState<ProDetailsResultType>> => {
    return createProBackendFetchAsyncThunk({
      key: 'details',
      getter: () => ProBackendAPI.getProStatus(args),
      payloadCreator,
      callback: async (_initialState, state) => {
        // TODO: work out if we actually need to know the previous state
        // const previousState = initialState.isEnabled && initialState.data ? initialState.data : getProDetailsFromStorage();

        if (state.data) {
          switch (state.data.status) {
            case ProStatus.Active:
              await handleProProof(state.data.expiry_unix_ts_ms, state.data.auto_renewing);
              break;

            case ProStatus.NeverBeenPro:
              await handleClearProProof();
              break;

            case ProStatus.Expired:
              await handleClearProProof();
              await handleExpired();
              break;

            default:
              assertUnreachable(state.data.status, 'handleBackendProStatusChange');
              break;
          }
        }

        if (state.data) {
          await putProDetailsInStorage(state.data);
        }
      },
      contextHandler: async state => {
        if (context === 'recover') {
          if (state.data?.status === ProStatus.Active) {
            payloadCreator.dispatch(
              updateLocalizedPopupDialog({
                title: { token: 'proAccessRestored' },
                description: { token: 'proAccessRestoredDescription' },
              })
            );
          } else {
            payloadCreator.dispatch(
              updateLocalizedPopupDialog({
                title: { token: 'proAccessNotFound' },
                description: { token: 'proAccessNotFoundDescription' },
                overrideButtons: [
                  {
                    label: { token: 'helpSupport' },
                    dataTestId: 'pro-backend-error-support-button',
                    onClick: () => {
                      showLinkVisitWarningDialog(
                        'https://sessionapp.zendesk.com/hc/sections/4416517450649-Support',
                        payloadCreator.dispatch
                      );
                    },
                    closeAfterClick: true,
                  },
                  {
                    label: { token: 'close' },
                    dataTestId: 'modal-close-button',
                    closeAfterClick: true,
                  },
                ],
              })
            );
          }
        }
      },
    });
  }
);

const refreshGenerateProProofFromProBackend = createAsyncThunk(
  'proBackendData/refreshGenerateProProof',
  async (_opts, payloadCreator) => {
    if (getFeatureFlag('debugServerRequests')) {
      window.log.info(
        `[proBackend/refreshGeneraeteProProofFromProBackend] starting ${new Date().toISOString()}`
      );
    }

    const state = payloadCreator.getState() as StateType;

    if (state.proBackendData.proof.isFetching) {
      return;
    }

    if (getFeatureFlag('debugServerRequests')) {
      window.log.info(
        `[proBackend/refreshGenerateProProofFromProBackend] triggered refresh at ${new Date().toISOString()}`
      );
    }

    const masterPrivKeyHex = await UserUtils.getProMasterKeyHex();
    const rotatingPrivKeyHex = await getProRotatingPrivateKeyHex();

    payloadCreator.dispatch(
      fetchGenerateProProofFromProBackend({ masterPrivKeyHex, rotatingPrivKeyHex }) as any
    );
  }
);

const refreshGetProDetailsFromProBackend = createAsyncThunk(
  'proBackendData/refreshGetProDetails',
  async (opts: WithCallerContext = {}, payloadCreator) => {
    if (getFeatureFlag('debugServerRequests')) {
      window.log.info(
        `[proBackend/refreshGetProDetailsFromProBackend] starting ${new Date().toISOString()}`
      );
    }

    const state = payloadCreator.getState() as StateType;

    if (state.proBackendData.details.isFetching) {
      return;
    }

    if (getFeatureFlag('debugServerRequests')) {
      window.log.info(
        `[proBackend/refreshGetProDetailsFromProBackend] triggered refresh at ${new Date().toISOString()}`
      );
    }
    const masterPrivKeyHex = await UserUtils.getProMasterKeyHex();
    payloadCreator.dispatch(fetchGetProDetailsFromProBackend({ ...opts, masterPrivKeyHex }) as any);
  }
);

export const proBackendDataSlice = createSlice({
  name: 'proBackendData',
  initialState: initialProBackendDataState,
  reducers: {
    setIsEnabled(state, action: ReducerBooleanStateAction) {
      state[action.payload.key].isEnabled = action.payload.result;
      return state;
    },
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
    builder.addCase(fetchGenerateProProofFromProBackend.fulfilled, (state, action) => {
      if (getFeatureFlag('debugServerRequests')) {
        window.log.info(
          `[proBackend / fetchGenerateProProofFromProBackend] fulfilled ${new Date().toISOString()} `,
          JSON.stringify(action.payload)
        );
      }
      state.proof = action.payload;
    });
    builder.addCase(fetchGenerateProProofFromProBackend.rejected, (_state, action) => {
      window.log.error(
        `[proBackend / fetchGenerateProProofFromProBackend] rejected ${action.error.message || action.error} `
      );
    });

    builder.addCase(fetchGetProDetailsFromProBackend.fulfilled, (state, action) => {
      if (getFeatureFlag('debugServerRequests')) {
        window.log.info(
          `[proBackend / fetchGetProDetailsFromProBackend] fulfilled ${new Date().toISOString()} `,
          JSON.stringify(action.payload)
        );
      }
      state.details = action.payload;
    });
    builder.addCase(refreshGenerateProProofFromProBackend.fulfilled, (_state, _action) => {
      if (getFeatureFlag('debugServerRequests')) {
        window.log.info(
          `[proBackend / refreshGenerateProProofFromProBackend] fulfilled ${new Date().toISOString()} `
        );
      }
    });
    builder.addCase(refreshGenerateProProofFromProBackend.rejected, (_state, action) => {
      window.log.error(
        `[proBackend / refreshGenerateProProofFromProBackend] rejected ${JSON.stringify(action.error.message || action.error)} `
      );
    });
  },
});

export default proBackendDataSlice.reducer;
export const proBackendDataActions = {
  ...proBackendDataSlice.actions,
  fetchGenerateProProofFromProBackend,
  fetchGetProDetailsFromProBackend,
  refreshGenerateProProofFromProBackend,
  refreshGetProDetailsFromProBackend,
};
