import type { WithMasterPrivKeyHex } from 'libsession_util_nodejs';
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
import { ProStatusResultType } from '../../session/apis/pro_backend_api/schemas';
import { proErrorMessage } from '../../session/apis/pro_backend_api/proErrorMessage';
import { Storage } from '../../util/storage';
import { NetworkTime } from '../../util/NetworkTime';
import { DURATION } from '../../session/constants';
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
  // When the last successful fetch completed (ms, network time). 0 if we never got one this run.
  // Used to throttle the opportunistic refresh done when a screen that shows this data is opened.
  lastFetchedMs: number;
  data: D | null;
};

const defaultRequestState = {
  isFetching: false,
  isLoading: false,
  isError: false,
  isEnabled: false,
  error: null,
  lastFetchedMs: 0,
  data: null,
} satisfies RequestState;

export type RequestActionArgs = {
  key: keyof ProBackendDataState;
  result: boolean;
};

type ReducerBooleanStateAction = PayloadAction<RequestActionArgs>;

// The payload held under each pro-backend request key. Each one is a libsession-parsed response
// struct, so it carries the response header (§5) that createProBackendFetchAsyncThunk reads below:
// adding a key whose payload has no `status`/`errorCode`/`error` fails to compile there.
type ProBackendDataPayloads = {
  details: ProStatusResultType;
};

export type ProBackendDataState = {
  [K in keyof ProBackendDataPayloads]: RequestState<ProBackendDataPayloads[K]>;
};

export const initialProBackendDataState: ProBackendDataState = {
  details: defaultRequestState,
};

type PayloadCreatorType = Parameters<Parameters<typeof createAsyncThunk>['1']>['1'];

// The getter returns a libsession-parsed response struct (or null on transport failure). Every parsed
// struct carries the response header (§5): `status` ('ok' on success) + an optional machine `errorCode` slug
// and an English diagnostic `error`.
type CreateProBackendFetchAsyncThunk<K extends keyof ProBackendDataPayloads> = {
  key: K;
  getter: () => Promise<ProBackendDataPayloads[K] | null>;
  payloadCreator: PayloadCreatorType;
  contextHandler?: (state: ProBackendDataState[K]) => Promise<void>;
  // Runs at the end of the function, as long as the function doesn't early return because it was already fetching.
  callback?: (state: ProBackendDataState[K]) => Promise<ProBackendDataState[K]>;
};

export type WithCallerContext = { callerContext?: 'recover' };

async function createProBackendFetchAsyncThunk<K extends keyof ProBackendDataPayloads>({
  key,
  getter,
  payloadCreator,
  contextHandler,
  callback,
}: CreateProBackendFetchAsyncThunk<K>): Promise<ProBackendDataState[K]> {
  const debug = getFeatureFlag('debugServerRequests');
  if (debug) {
    window?.log?.debug(`[${key}] starting ${new Date().toISOString()}`);
  }

  const state = payloadCreator.getState() as StateType;
  const initialState = state.proBackendData[key];
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
      // null == transport failure (or a non-200 the glue swallowed); the selector falls back to the
      // last details persisted in storage, so surfacing this as a hard error is fine.
      throw new Error('Data fetch failed');
    }

    // App-level failure = status !== 'ok'. Keep the raw backend diagnostic for logging, but surface a
    // user-facing message mapped from the `errorCode` slug to a localized `pro_error_<slug>` string
    // (falling back to the diagnostic, then a generic message).
    const diagnostic =
      response.status === 'ok' ? null : (response.error ?? response.errorCode ?? 'request failed');
    const error =
      response.status === 'ok' ? null : proErrorMessage(response.errorCode, response.error);

    if (diagnostic && debug) {
      window?.log?.error(diagnostic);
    }

    result = {
      data: error ? result.data : response,
      error,
      isError: !!error,
      isFetching: false,
      isLoading: false,
      isEnabled: true,
      lastFetchedMs: error ? initialState.lastFetchedMs : NetworkTime.now(),
    };
  } catch (e) {
    window?.log?.error(e);
    result = {
      data: null,
      error: e.message,
      isError: true,
      isFetching: false,
      isLoading: false,
      isEnabled: true,
      lastFetchedMs: 0,
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

async function putProStatusInStorage(details: ProStatusResultType) {
  // We persist, verbatim, the JS object the libsession-util-nodejs glue produced from the backend
  // response (not a raw libsession struct). See getProStatusFromStorage for the transition reminder
  // that applies before adding any REQUIRED field to this shape.
  await Storage.put(SettingsKey.proStatus, details);
}

/** A currently-usable proof is held (unexpired). Revocation is a separate clear path. */
function haveValidProof(): boolean {
  const proof = getCachedUserConfig().proConfig?.proProof;
  return !!proof && proof.expiryMs > NetworkTime.now();
}

/**
 * Apply one generate_pro_proof outcome to config (see the ON_COMPLETE rules in
 * agent-comms/pro-proof-renewal-loop-design.md §4). A stale response must never reduce coverage:
 * upgrades are gated on a strictly-newer expiry, clears on there being no valid proof to protect.
 */
async function applyProofOutcome(
  response: Awaited<ReturnType<typeof ProBackendAPI.generateProProof>>,
  rotatingSeedHex: string
): Promise<void> {
  if (!response) {
    // network/transient: nothing to write
    return;
  }
  if (response.status === 'ok') {
    const proProof = response.proof;
    const current = getCachedUserConfig().proConfig?.proProof;
    // Upgrade guard: only replace the proof if it extends coverage (monotonic merge; same-period
    // races round to the same expiry → byte-identical → no-op).
    if (!current || proProof.expiryMs > current.expiryMs) {
      const { proConfig, proAccessExpiry, proProfileBitset } = getCachedUserConfig();
      // First-ever proof: enable the pro badge feature.
      if (!proConfig && !proAccessExpiry && !proProfileBitset) {
        await UserConfigWrapperActions.setProBadge(true);
      }
      await UserConfigWrapperActions.setProConfig({ proProof, rotatingSeedHex });
    }
    // Refresh cached access-expiry from the advisory account_expiry (decoupled from the proof guard,
    // so a mid-period horizon extension is still picked up). Guaranteed present on a success parse.
    if (response.accountExpiryMs !== null) {
      await UserConfigWrapperActions.setProAccessExpiry(response.accountExpiryMs);
    }
    return;
  }
  // Non-ok: the machine slug (error_code) decides.
  switch (response.errorCode) {
    case 'subscription_expired':
      // The sub genuinely lapsed. Don't wipe a fresh proof a re-subscribe just landed.
      if (!haveValidProof()) {
        if (response.accountExpiryMs !== null) {
          await UserConfigWrapperActions.setProAccessExpiry(response.accountExpiryMs);
        }
        await UserConfigWrapperActions.removeProConfig();
      }
      break;
    case 'not_subscribed':
      // Clear the (absent) credential AND the access-expiry (E), but leave pro_prepaid so a pending
      // purchase keeps polling. Clearing E is required: libsession's renewal target now fires on
      // "future E but no proof", so a stale future E left here would spin.
      if (!haveValidProof()) {
        await UserConfigWrapperActions.removeProConfig();
        await UserConfigWrapperActions.setProAccessExpiry(null);
      }
      break;
    case 'revoked':
      // Terminal: revocation kills even an unexpired proof (bypasses the downgrade guard). With the
      // proof gone we must also clear E, or the renewal target (future E, no proof) would spin.
      await UserConfigWrapperActions.removeProConfig();
      await UserConfigWrapperActions.setProAccessExpiry(null);
      break;
    default:
      // Unrecognized error_code: fail closed, non-destructively — treat as transient (no write/clear).
      window?.log?.warn(
        `[proProof] unrecognized generate_pro_proof error_code: ${response.errorCode}`
      );
      break;
  }
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

let firstFetchProStatusHappened = false;
// ===== Pro proof renewal reconcile loop (agent-comms/pro-proof-renewal-loop-design.md) =====
const DARK_STEP_MS = 15 * DURATION.SECONDS;
const DARK_CAP_MS = 15 * DURATION.MINUTES;
const COVERED_MS = 60 * DURATION.SECONDS;

let reconcileWakeId: ReturnType<typeof setTimeout> | null = null;
let lastProofRequestAt = -Infinity;
let darkAttempt = 0;

function scheduleReconcileWake(atMs: number) {
  if (reconcileWakeId) {
    clearTimeout(reconcileWakeId);
  }
  reconcileWakeId = setTimeout(
    () => {
      void reconcileProProof();
    },
    Math.max(atMs - NetworkTime.now(), 0)
  );
}

async function requestAndApplyProof(): Promise<void> {
  try {
    const masterPrivKeyHex = await getProMasterKeyHex();
    // Deterministic rotating key for now; libsession owns the rotation schedule.
    const { rotatingSeedHex, rotatingPrivKeyHex } = await UserUtils.deriveCurrentProRotatingKey();
    const response = await ProBackendAPI.generateProProof({ masterPrivKeyHex, rotatingPrivKeyHex });
    await applyProofOutcome(response, rotatingSeedHex);
    // Reflect any proof/status change in the UI without a restart.
    ConvoHub.use().get(UserUtils.getOurPubKeyStrFromCache())?.triggerUIRefresh();
  } catch (e) {
    window?.log?.error('[proProof] generate_pro_proof request failed', e);
    // transient: nothing to write
  }
  // Re-derive from fresh config: success -> far-future target; failure -> backed-off retry.
  void reconcileProProof();
}

/**
 * The renewal loop. Timing + whether-to-renew are entirely libsession's (the gated
 * `pro_renewal_target`); the client only schedules a wake and, when due, fires a bare
 * `generate_pro_proof`. Single-flight is best-effort (an overlap with a slow in-flight request is
 * accepted — the §4 monotonic merge no-ops the late reply). Holds no durable state.
 */
export async function reconcileProProof(): Promise<void> {
  if (reconcileWakeId) {
    clearTimeout(reconcileWakeId);
    reconcileWakeId = null;
  }
  const now = NetworkTime.now();
  const target = await UserConfigWrapperActions.getProRenewalTarget(now);
  if (target === null) {
    // DORMANT (not Pro / no pending purchase, OR a valid proof with entitlement ending — riding out).
    // NOTE: DORMANT is not "not Pro" — never gate Pro UI on this; re-entry is trigger-only.
    darkAttempt = 0;
    return;
  }
  if (target > now) {
    // Not yet due: one wake (preemptive renewal / woke-early / another device renewed).
    darkAttempt = 0;
    scheduleReconcileWake(target);
    return;
  }
  // Due.
  const covered = haveValidProof();
  if (covered) {
    darkAttempt = 0;
  }
  const interval = covered ? COVERED_MS : Math.min(DARK_STEP_MS * darkAttempt, DARK_CAP_MS);
  if (now - lastProofRequestAt < interval) {
    // Spacing / in-flight / awaiting a possibly-lost completion.
    scheduleReconcileWake(lastProofRequestAt + interval);
    return;
  }
  lastProofRequestAt = now;
  if (!covered) {
    darkAttempt += 1;
  }
  // A lost/frozen completion is re-checked at this wake.
  scheduleReconcileWake(
    now + (covered ? COVERED_MS : Math.min(DARK_STEP_MS * darkAttempt, DARK_CAP_MS))
  );
  void requestAndApplyProof();
}

const fetchGetProStatusFromProBackend = createAsyncThunk(
  'proBackendData/fetchGetProStatus',
  async (
    { callerContext: context, ...args }: WithMasterPrivKeyHex & WithCallerContext,
    payloadCreator
  ): Promise<ProBackendDataState['details']> => {
    return createProBackendFetchAsyncThunk({
      key: 'details',
      getter: () => ProBackendAPI.getProStatus(args),
      payloadCreator,
      callback: async state => {
        if (state.data) {
          switch (state.data.userStatus) {
            case ProStatus.Active:
              window.log.debug(`[handleBackendProStatusChange] ProStatus.Active`);
              // Keep the cached access-expiry (E) fresh from the account horizon (catches a
              // horizon-only change the renewal path wouldn't). The proof itself is (re)obtained by
              // the reconcile loop, triggered below.
              await UserConfigWrapperActions.setProAccessExpiry(state.data.expiryMs);
              break;

            case ProStatus.Never:
            case ProStatus.Expired:
              window.log.debug(`[handleBackendProStatusChange] ProStatus.${state.data.userStatus}`);
              // No/ended entitlement. Clear — but never wipe a currently-valid proof (a stale status
              // read vs a fresh proof another device just landed); the proof lifecycle is otherwise
              // the reconcile loop's.
              if (!haveValidProof()) {
                await handleClearProProof();
              }
              break;

            default:
              // Opaque/unknown status: we have no basis to conclude the subscription ended, and
              // handleClearProProof() writes SYNCED user config — clearing here would erase a valid
              // proof across ALL the user's devices just because this (possibly older) client didn't
              // recognise a new status slug. Leave the proof untouched: entitlement is governed by
              // the proof's own signature + expiry (hasValidCurrentProProof), and the backend simply
              // won't refresh it (or will revoke it) if the account has genuinely lapsed.
              window.log.warn(
                `[handleBackendProStatusChange] unknown pro userStatus: ${state.data.userStatus}; leaving proof untouched`
              );
              break;
          }
          await handleExpiryCTAs(
            state.data.expiryMs,
            state.data.autoRenewing,
            state.data.userStatus
          );
          // on the first fetch of our pro status after a restart, we want to show the CTAs if needed
          if (window.inboxStore?.dispatch && !firstFetchProStatusHappened) {
            void handleTriggeredCTAs(window.inboxStore?.dispatch, false);
          }
          firstFetchProStatusHappened = true;
        }

        if (state.data) {
          await putProStatusInStorage(state.data);
        }
        // trigger a UI refresh so our state and Pro rights are up to date without a restart (animated image should stop animating)
        ConvoHub.use().get(UserUtils.getOurPubKeyStrFromCache())?.triggerUIRefresh();
        // A get_pro_status fetch may have changed config (E / prepaid / status) — re-run the proof
        // renewal loop against the fresh state.
        void reconcileProProof();
        return state;
      },
      contextHandler: async state => {
        if (context === 'recover') {
          if (state.data?.userStatus === ProStatus.Active) {
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

const refreshGetProStatusFromProBackend = createAsyncThunk(
  'proBackendData/refreshGetProStatus',
  async (opts: WithCallerContext = {}, payloadCreator) => {
    if (getFeatureFlag('debugServerRequests')) {
      window.log.info(
        `[proBackend/refreshGetProStatusFromProBackend] starting ${new Date().toISOString()}`
      );
    }

    const state = payloadCreator.getState() as StateType;

    if (state.proBackendData.details.isFetching) {
      return;
    }

    if (getFeatureFlag('debugServerRequests')) {
      window.log.info(
        `[proBackend/refreshGetProStatusFromProBackend] triggered refresh at ${new Date().toISOString()}`
      );
    }
    const masterPrivKeyHex = await UserUtils.getProMasterKeyHex();
    payloadCreator.dispatch(fetchGetProStatusFromProBackend({ ...opts, masterPrivKeyHex }) as any);
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
    builder.addCase(fetchGetProStatusFromProBackend.rejected, (_state, action) => {
      window.log.error(
        `[proBackend / fetchGetProStatusFromProBackend] rejected ${action.error.message || action.error} `
      );
    });
    builder.addCase(fetchGetProStatusFromProBackend.fulfilled, (state, action) => {
      if (getFeatureFlag('debugServerRequests')) {
        window.log.info(
          `[proBackend / fetchGetProStatusFromProBackend] fulfilled ${new Date().toISOString()} `,
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
  fetchGetProStatusFromProBackend,
  refreshGetProStatusFromProBackend,
};
