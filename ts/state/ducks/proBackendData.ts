import type { ProProof, WithMasterPrivKeyHex } from 'libsession_util_nodejs';
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { isUndefined } from 'lodash';
import type { StateType } from '../reducer';
import ProBackendAPI from '../../session/apis/pro_backend_api/ProBackendAPI';
import { getFeatureFlag } from './types/releasedFeaturesReduxTypes';
import { UserUtils } from '../../session/utils';
import { getProMasterKeyHex } from '../../session/utils/User';
import { updateLocalizedPopupDialog } from './modalDialog';
import { showLinkVisitWarningDialog } from '../../components/dialog/OpenUrlModal';
import { ProStatus } from '../../session/apis/pro_backend_api/types';
import { SettingsKey } from '../../data/settings-key';
import { ProDetailsResultType } from '../../session/apis/pro_backend_api/schemas';
import { Storage } from '../../util/storage';
import { NetworkTime } from '../../util/NetworkTime';
import { assertUnreachable } from '../../types/sqlSharedTypes';
import { DURATION } from '../../session/constants';
import { SessionBackendBaseResponseType } from '../../session/apis/session_backend_server';
import {
  getCachedUserConfig,
  UserConfigWrapperActions,
} from '../../webworker/workers/browser/libsession/libsession_worker_userconfig_interface';
import { ConvoHub } from '../../session/conversations';
import { handleTriggeredCTAs } from '../../components/dialog/SessionCTA';

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
  details: RequestState<ProDetailsResultType>;
};

export const initialProBackendDataState: ProBackendDataState = {
  details: defaultRequestState,
};

type ApiResponse<T> = SessionBackendBaseResponseType & {
  result: T;
};

type PayloadCreatorType = Parameters<Parameters<typeof createAsyncThunk>['1']>['1'];

type CreateProBackendFetchAsyncThunk<D> = {
  key: keyof ProBackendDataState;
  getter: () => Promise<ApiResponse<D> | null>;
  payloadCreator: PayloadCreatorType;
  contextHandler?: (state: RequestState<D>) => Promise<void>;
  // Runs at the end of the function, as long as the function doesn't early return because it was already fetching.
  callback?: (state: RequestState<D>) => Promise<RequestState<D>>;
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
    window?.log?.debug(`[${key}] starting ${new Date().toISOString()}`);
  }

  const state = payloadCreator.getState() as StateType;
  const initialState = state.proBackendData[key] as RequestState<D>;
  let result = initialState;
  try {
    if (initialState.isFetching) {
      if (debug) {
        window?.log?.debug(
          `[${key}] already fetching! returning no-op ${new Date().toISOString()}`
        );
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

    let error = response.error ?? null;

    if (response.status_code !== 200) {
      if (!error) {
        error = `Received ${response.status_code} status code with no error message`;
      }
      result = {
        data: result.data,
        error,
        isError: true,
        isFetching: false,
        isLoading: false,
        t: response.t,
        isEnabled: true,
      };
    }

    if (error && debug) {
      window?.log?.error(error);
    }

    result = {
      data: error ? result.data : response.result,
      error,
      isError: !!error,
      isFetching: false,
      isLoading: false,
      t: response.t,
      isEnabled: true,
    };
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
    result = await callback(result);
  }

  return result;
}

async function putProDetailsInStorage(details: ProDetailsResultType) {
  await Storage.put(SettingsKey.proDetails, details);
}

async function handleNewProProof(rotatingPrivKeyHex: string): Promise<ProProof | null> {
  const masterPrivKeyHex = await getProMasterKeyHex();
  const response = await ProBackendAPI.generateProProof({
    masterPrivKeyHex,
    rotatingPrivKeyHex,
  });
  if (response?.status_code === 200) {
    const proProof = {
      expiryMs: response.result.expiry_unix_ts_ms,
      genIndexHashB64: response.result.gen_index_hash_b64,
      rotatingPubkeyHex: response.result.rotating_pkey_hex,
      version: response.result.version,
      signatureHex: response.result.sig_hex,
    } satisfies ProProof;
    const { proConfig, proAccessExpiry, proProfileBitset } = getCachedUserConfig();
    // If we have a new proof but it seems that we never had one before, set the pro badge feature as enabled
    if (!proConfig && !proAccessExpiry && !proProfileBitset) {
      await UserConfigWrapperActions.setProBadge(true);
    }
    await UserConfigWrapperActions.setProConfig({ proProof, rotatingPrivKeyHex });

    return proProof;
  }
  window?.log?.error('failed to get new pro proof: ', response);
  return null;
}

async function handleClearProProof() {
  await UserConfigWrapperActions.removeProConfig();
  await UserConfigWrapperActions.setProAccessExpiry(null);
}

async function handleExpiryCTAs(
  accessExpiryTsMs: number,
  autoRenewing: boolean,
  status: ProStatus
) {
  const now = NetworkTime.now();

  const sevenDaysBeforeExpiry = accessExpiryTsMs - 7 * DURATION.DAYS;
  const thirtyDaysAfterExpiry = accessExpiryTsMs + 30 * DURATION.DAYS;

  const proExpiringSoonCTA = !isUndefined(Storage.get(SettingsKey.proExpiringSoonCTA));
  const proExpiredCTA = !isUndefined(Storage.get(SettingsKey.proExpiredCTA));

  // Remove the pro expired cta item if the user gets pro again
  if (status === ProStatus.Active && proExpiredCTA) {
    await Storage.remove(SettingsKey.proExpiredCTA);
  }

  if (now < sevenDaysBeforeExpiry) {
    // More than 7 days before expiry, remove CTA items if they exist. This means the items were set for a previous cycle of pro access.
    if (proExpiringSoonCTA) {
      await Storage.remove(SettingsKey.proExpiringSoonCTA);
    }
    if (proExpiredCTA) {
      await Storage.remove(SettingsKey.proExpiredCTA);
    }
  } else if (sevenDaysBeforeExpiry < now && now < accessExpiryTsMs) {
    // Between 7 days before expiry and expiry, Expiring Soon CTA needs to be marked to be shown if not already. Only shown if not auto-renewing
    if (status === ProStatus.Active && !autoRenewing && !proExpiringSoonCTA) {
      await Storage.put(SettingsKey.proExpiringSoonCTA, true);
    }
  } else if (accessExpiryTsMs < now && now < thirtyDaysAfterExpiry) {
    // Between expiry and 30 days after expiry, Expired CTA needs to be marked to be shown if not already
    if (status === ProStatus.Expired && !proExpiredCTA) {
      await Storage.put(SettingsKey.proExpiredCTA, true);
      // The expiring soon CTA should be removed if it's set as we want to show it again in the future if needed
      if (proExpiringSoonCTA) {
        await Storage.remove(SettingsKey.proExpiringSoonCTA);
      }
    }
  }
}

let firstFetchProDetailsHappened = false;
let lastKnownProofExpiryTimestamp: number | null = null;
let scheduledProofExpiryTaskTimestamp: number | null = null;
let scheduledProofExpiryTaskId: ReturnType<typeof setTimeout> | null = null;
let scheduledAccessExpiryTaskTimestamp: number | null = null;
let scheduledAccessExpiryTaskId: ReturnType<typeof setTimeout> | null = null;

function scheduleRefresh(timestampMs: number) {
  const delay = Math.max(timestampMs - NetworkTime.now(), 15 * DURATION.SECONDS);
  window?.log?.info(`Scheduling a pro details refresh in ${delay}ms for ${timestampMs}`);
  return setTimeout(() => {
    window?.inboxStore?.dispatch(
      proBackendDataActions.refreshGetProDetailsFromProBackend({}) as any
    );
  }, delay);
}

async function fetchNewProof(rotatingPrivKeyHex: string) {
  try {
    const newProof = await handleNewProProof(rotatingPrivKeyHex);
    if (newProof) {
      return newProof.expiryMs;
    }
  } catch (e) {
    window?.log?.error(e);
  }
  return null;
}

async function handleProProof(accessExpiryTsMs: number, autoRenewing: boolean, status: ProStatus) {
  if (status !== ProStatus.Active) {
    return;
  }

  const proConfig = getCachedUserConfig().proConfig;

  const rotatingPrivKeyHex =
    proConfig?.rotatingPrivKeyHex ?? (await UserUtils.getProRotatingPrivateKeyHex());

  const cachedProofExpiry = proConfig?.proProof.expiryMs;

  // We want to fetch a new pro proof when:
  // 1. we don't have one yet
  // 2. we have one that has already expired
  // 3. we have one that is expiring soon (within the next 60 minutes)
  const now = NetworkTime.now();
  let refreshedProofExpiry: number | null = null;

  const shouldRefreshNoProProof = !proConfig || !proConfig.proProof; // case 1: we don't have a pro proof yet
  const shouldRefreshProofExpired = proConfig && proConfig.proProof.expiryMs < now; // case 2: we have a pro proof that has expired
  const shouldRefreshProofExpiresSoon = // case 3: we have a pro proof that is expiring soon
    proConfig &&
    proConfig.proProof.expiryMs < now + DURATION.HOURS && // the cached proof expires in the next 60 minutes
    accessExpiryTsMs > now + DURATION.HOURS && // the access expiry expires in more than 60 minutes
    autoRenewing;

  if (shouldRefreshNoProProof || shouldRefreshProofExpired || shouldRefreshProofExpiresSoon) {
    refreshedProofExpiry = await fetchNewProof(rotatingPrivKeyHex);
    if (refreshedProofExpiry) {
      await UserConfigWrapperActions.setProAccessExpiry(refreshedProofExpiry);
    }
  }

  // fallback to the cached expiry if we didn't get a new one
  if (!refreshedProofExpiry) {
    refreshedProofExpiry = cachedProofExpiry ?? null;
  }

  const accessExpiryRefreshTimestamp = accessExpiryTsMs + 30 * DURATION.SECONDS;
  if (accessExpiryRefreshTimestamp !== scheduledAccessExpiryTaskTimestamp) {
    if (scheduledAccessExpiryTaskId) {
      clearTimeout(scheduledAccessExpiryTaskId);
    }
    scheduledAccessExpiryTaskTimestamp = accessExpiryRefreshTimestamp;
    scheduledAccessExpiryTaskId = scheduleRefresh(scheduledAccessExpiryTaskTimestamp);
  }

  if (
    refreshedProofExpiry &&
    (!scheduledProofExpiryTaskTimestamp || refreshedProofExpiry !== lastKnownProofExpiryTimestamp)
  ) {
    if (scheduledProofExpiryTaskId) {
      clearTimeout(scheduledProofExpiryTaskId);
    }
    // Random number of minutes between 10 and 60
    const minutes = Math.floor(Math.random() * 51) + 10;
    lastKnownProofExpiryTimestamp = refreshedProofExpiry;
    scheduledProofExpiryTaskTimestamp = refreshedProofExpiry - minutes * DURATION.MINUTES;
    scheduledProofExpiryTaskId = scheduleRefresh(scheduledProofExpiryTaskTimestamp);
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
      getter: () => ProBackendAPI.getProDetails(args),
      payloadCreator,
      callback: async state => {
        if (state.data) {
          if (state.data.error_report === 1) {
            state.isError = true;
            state.error = 'Backend unable to process current state, please try again later.';
            // NOTE: we want to continue processing the state, as even if there was an error we need to try to handle the pro proofs.
          }
          switch (state.data.status) {
            case ProStatus.Active:
              window.log.debug(`[handleBackendProStatusChange] ProStatus.Active`);
              await handleProProof(
                state.data.expiry_unix_ts_ms,
                state.data.auto_renewing,
                state.data.status
              );
              break;

            case ProStatus.NeverBeenPro:
              window.log.debug(`[handleBackendProStatusChange] ProStatus.NeverBeenPro`);
              await handleClearProProof();
              break;

            case ProStatus.Expired:
              window.log.debug(`[handleBackendProStatusChange] ProStatus.Expired`);

              await handleClearProProof();
              break;

            default:
              assertUnreachable(state.data.status, 'handleBackendProStatusChange');
              break;
          }
          await handleExpiryCTAs(
            state.data.expiry_unix_ts_ms,
            state.data.auto_renewing,
            state.data.status
          );
          // on the first fetch of our pro details after a restart, we want to show the CTAs if needed
          if (window.inboxStore?.dispatch && !firstFetchProDetailsHappened) {
            void handleTriggeredCTAs(window.inboxStore?.dispatch, false);
          }
          firstFetchProDetailsHappened = true;
        }

        if (state.data) {
          await putProDetailsInStorage(state.data);
        }
        // trigger a UI refresh so our state and Pro rights are up to date without a restart (animated image should stop animating)
        ConvoHub.use().get(UserUtils.getOurPubKeyStrFromCache())?.triggerUIRefresh();
        return state;
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

const refreshGetProDetailsFromProBackend = createAsyncThunk(
  'proBackendData/refreshGetProDetails',
  async (opts: WithCallerContext = {}, payloadCreator) => {
    if (!getFeatureFlag('proAvailable')) {
      return;
    }

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
    reset(state, action: PayloadAction<{ key: keyof ProBackendDataState }>) {
      state[action.payload.key] = defaultRequestState;
      return state;
    },
  },
  extraReducers: builder => {
    builder.addCase(fetchGetProDetailsFromProBackend.rejected, (_state, action) => {
      window.log.error(
        `[proBackend / fetchGetProDetailsFromProBackend] rejected ${action.error.message || action.error} `
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
  },
});

export default proBackendDataSlice.reducer;
export const proBackendDataActions = {
  ...proBackendDataSlice.actions,
  fetchGetProDetailsFromProBackend,
  refreshGetProDetailsFromProBackend,
};
