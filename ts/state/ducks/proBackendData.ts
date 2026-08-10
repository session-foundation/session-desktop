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
  // When the last successful fetch COMPLETED (ms, network time). 0 if we never got one this run.
  //
  // Per-run and completion-stamped, which makes it the answer to "has this process confirmed our
  // status (since some threshold)": the floor's never-confirmed-this-process exemption, the home Pro
  // CTA gate, and the grace warning's `lastFetchedMs >= renewalDueAtMs` debounce all read it.
  //
  // ⚠️ Do NOT substitute SettingsKey.proStatusLastFetchAttemptMs for any of those. That one is
  // persisted and stamped on *attempt*, because it backs the 60s floor, whose job is to bound
  // requests rather than to confirm anything. Similar names, opposite meanings.
  //
  // ⚠️ This field looks redundant next to the persisted one and is not. Deleting it as "subsumed by
  // the floor" was tried and would have shipped a permanent spinner on the Pro screen: a relaunch
  // inside 60s hits the floor, the fetch is dropped, and nothing is left to resolve the initial
  // loading state — which both the spinner and the CTAs gate on.
  //
  // WHEN DELETING IT BECOMES CORRECT, so this is a test rather than a prohibition: when no consumer
  // needs a *this-process* confirmation any more. Concretely, all three of —
  //   1. the Pro screen's loading state no longer resolves only via a completed fetch,
  //   2. the home CTAs no longer gate on one (see handleTriggeredCTAs), and
  //   3. the grace debounce has a persisted completion-stamped value to read AND it has been decided
  //      that a *previous* process's confirmation may satisfy it.
  // (3) is the one to be most careful with: accepting a prior process's confirmation for the CTA gate
  // is exactly the false-expired window that gating startup opened. Until then, keep both values.
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

/**
 * `immediate` means one thing only: bypass the status floor. It does NOT bypass the
 * single-flight guard and it does NOT touch the loading state — spinner UI is a separate concern
 * (trigger #3). Named `immediate` rather than `force` on purpose: `force` invited every routine
 * background trigger to pass it, which is how Android's 60s floor ended up dead.
 *
 * Sanctioned callers, and no others:
 *   #5 manual refresh / recover  — implied by `callerContext: 'recover'`, so a future recover caller
 *                                  gets it without having to remember
 *   #4 the while-open grace poll — a bounded poll with its own cadence and termination
 *   #7 the post-purchase poll    — N/A on Desktop: no in-app payment
 *   developer/debug refresh paths
 */
export type WithImmediate = { immediate?: boolean };

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
    //
    // `A` and `G` ride along, so every path that writes `E` writes all three from the same response.
    // This path used to write `E` alone, with two consequences: an account whose expiry came only from a
    // proof read back as terminal while it was in fact renewing (`A` is presence-only, so unwritten and
    // false are the same bit), and `E - G` could pair a fresh expiry with a grace learned in a different
    // billing period.
    //
    // ⚠️ All three writes are CONDITIONAL ON PRESENCE, and that is load-bearing rather than defensive.
    // These are advisory optionals: absent means "the backend did not say", NOT false or zero. Writing a
    // collapsed `?? false` / `?? 0` would ERASE the key — both are stored presence-only — so against a
    // backend predating either field, every proof fetch would wipe a correct value learned from
    // `get_pro_status`. That is strictly worse than not writing at all: today the value merely fails to
    // be refreshed; collapsed, it would be actively destroyed.
    if (response.accountExpiryMs !== null) {
      await UserConfigWrapperActions.setProAccessExpiry(response.accountExpiryMs);
    }
    if (response.accountAutoRenewing !== null) {
      await writeProAutoRenewingToConfig(response.accountAutoRenewing);
    }
    if (response.accountGracePeriodMs !== null) {
      await UserConfigWrapperActions.setProGracePeriod(response.accountGracePeriodMs);
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

// ===== get_pro_status refresh discipline =====
// These are a deliberate cross-client contract: Android and iOS name the same values so
// nobody tunes one platform in isolation. Change them here and the other two clients are wrong.

/** Minimum gap between *routine* status fetches. Drop-on-fresh — see statusFetchIsFloored. */
const STATUS_FLOOR_MS = 60 * DURATION.SECONDS;
/** Cold-start fetches are additionally capped to one per this interval, by the startup gate. */
const STATUS_STARTUP_MIN_INTERVAL_MS = 24 * DURATION.HOURS;
/** #6: one wake past the account horizon, so grace surfaces without the Pro page being open. */
const USER_EXPIRY_WAKE_DELAY_MS = 30 * DURATION.SECONDS;
/** The Expiring-CTA window. The startup gate's "is E within the CTA window" test uses this too. */
const PRO_EXPIRING_CTA_WINDOW_MS = 7 * DURATION.DAYS;
/** The Expired-CTA window. */
const PRO_EXPIRED_CTA_WINDOW_MS = 30 * DURATION.DAYS;

async function handleExpiryCTAs(
  accessExpiryTsMs: number,
  autoRenewing: boolean,
  status: ProStatus
) {
  const now = NetworkTime.now();

  const sevenDaysBeforeExpiry = accessExpiryTsMs - PRO_EXPIRING_CTA_WINDOW_MS;
  const thirtyDaysAfterExpiry = accessExpiryTsMs + PRO_EXPIRED_CTA_WINDOW_MS;

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

/**
 * The status floor's timestamp lives in Storage, not in `details.lastFetchedMs`, because the redux
 * value is per-run: it resets to 0 on every cold start, which is precisely the path the floor has to
 * cover. See SettingsKey.proStatusLastFetchAttemptMs, which also spells out why this value is not
 * interchangeable with the per-run, completion-stamped `details.lastFetchedMs`.
 */
function lastStatusFetchAttemptAtMs(): number {
  return (Storage.get(SettingsKey.proStatusLastFetchAttemptMs) as number | undefined) ?? 0;
}

/**
 * True when a routine status refresh should be *dropped* as too soon.
 *
 * Drop-on-fresh, deliberately NOT re-arm: a floor that rescheduled the skipped fetch would turn
 * the routine triggers into a self-sustaining once/60s poll, and during grace — when `E` sits static
 * and nothing new can arrive from a config change — that poll is pure noise. Dropping is safe
 * because status is display-only and backstopped by many triggers.
 *
 * The *proof* loop is the opposite by design (reconcileProProof reschedules rather than skips),
 * because a throttled proof acquisition must still eventually happen. Don't unify the two.
 */
function statusFetchIsFloored(): boolean {
  return NetworkTime.now() < lastStatusFetchAttemptAtMs() + STATUS_FLOOR_MS;
}

// ===== #6 — the single wake at user_expiry =====

let userExpiryWakeId: ReturnType<typeof setTimeout> | null = null;

/**
 * Schedule one status refresh shortly past the renewal date (`E - G`).
 *
 * This is the background half of surfacing grace. Desktop already refetches across the crossing
 * while the Pro page is open (`useKeepProStatusFresh`, trigger #4), but that is screen-scoped: with
 * the page closed nothing re-checks between `E` and the proof loop's wake ~1h before *proof* expiry,
 * so a renewal that failed at `E` would only surface in that final hour. Android has had this wake
 * (`E+30s`) all along; this is Desktop's equivalent.
 *
 * Only ever armed for a *future* crossing. A crossing already in the past is not replayed on every
 * launch — that would duplicate the startup gate, which is the thing that decides whether a cold
 * start is allowed to fetch at all.
 *
 * ⚠️ Note what this does NOT cover: the later transition at `E` itself, when grace ends and the account
 * genuinely expires. This is a one-shot at the renewal date, so nothing here fires at coverage end. The
 * proof loop wakes near `E` by construction — the backend issues `proof_expiry` ~1h past `E` and
 * `pro_renewal_target` is ~1h before proof expiry — and a proof outcome now writes `E`/`A`/`G`, which
 * fires the config-change trigger. But that path depends on `E` actually changing, so it covers a
 * renewal that SUCCEEDED and not one that failed. See the note on that trigger.
 */
export async function scheduleUserExpiryStatusWake(): Promise<void> {
  if (userExpiryWakeId) {
    clearTimeout(userExpiryWakeId);
    userExpiryWakeId = null;
  }
  const accessExpiryMs = await UserConfigWrapperActions.getProAccessExpiry();
  if (!accessExpiryMs) {
    return;
  }
  // Fires just past the RENEWAL DATE (`E - G`), not past coverage end. `E` is grace-inclusive, so
  // waking at `E` would arrive after the whole grace window had already elapsed — i.e. after the state
  // this wake exists to surface had come and gone.
  const gracePeriodMs = await UserConfigWrapperActions.getProGracePeriod();
  const wakeAtMs = accessExpiryMs - gracePeriodMs + USER_EXPIRY_WAKE_DELAY_MS;
  const delayMs = wakeAtMs - NetworkTime.now();
  if (delayMs <= 0) {
    return;
  }
  userExpiryWakeId = setTimeout(() => {
    // Floored, like every other routine trigger — the wake is a nudge, not a "go right now".
    window.inboxStore?.dispatch(proBackendDataActions.refreshGetProStatusFromProBackend({}) as any);
  }, delayMs);
}

// ===== The startup gate =====

/**
 * Whether a *cold start* is allowed to fetch `get_pro_status`.
 *
 * Startup's only real consumer is the home CTAs — entitlement comes from the proof, the settings
 * screen refreshes on open, and account-expiry awareness is trigger #6. So instead of fetching on
 * every launch (which is what Desktop did, and what hammers the backend for every non-Pro and every
 * comfortably-active user), decide from synced config whether a CTA could plausibly fire.
 *
 * The architect's rule, which REPLACES the spec's `E + grace <= now` test — `grace` isn't knowable
 * until you are already in it, and libsession PR #121 adds `auto_renewing` only, so there is no
 * `grace` in config to test against:
 *
 *   auto_renewing && now <  E                     -> comfortably active, no fetch
 *   auto_renewing && now >= E                     -> in/near grace, unknowable, FETCH and learn
 *                                                    `grace` from the response
 *   !auto_renewing && E within the CTA window     -> expiring, fetch / CTA
 *   !auto_renewing && now >= E                    -> expired, confirm-fetch before the Expired CTA
 *
 * Capped either way at one cold-start fetch per STATUS_STARTUP_MIN_INTERVAL_MS.
 */
async function coldStartShouldFetchProStatus(): Promise<boolean> {
  const accessExpiryMs = await UserConfigWrapperActions.getProAccessExpiry();
  if (!accessExpiryMs) {
    // Never had Pro (or `E` was cleared by an outcome that ended entitlement): nothing a CTA could
    // be about, and the proof loop owns re-entry. This is the bulk of the load the gate removes.
    return false;
  }

  const lastStartupFetchMs =
    (Storage.get(SettingsKey.proStatusLastStartupFetchMs) as number | undefined) ?? 0;
  if (NetworkTime.now() < lastStartupFetchMs + STATUS_STARTUP_MIN_INTERVAL_MS) {
    return false;
  }

  const now = NetworkTime.now();
  const autoRenewing = await getProAutoRenewingFromConfig();

  if (autoRenewing) {
    // `E` is coverage end, not the renewal date — the backend folds grace into the stored expiry for
    // auto-renewing subscriptions. So the renewal falls due at `E - G`, and comparing against `E`
    // itself would sleep through the entire grace window: exactly the state this gate exists to
    // surface. Fetch from the renewal date onward.
    //
    // `G` is synced alongside `E` precisely so a config-only caller like this one can compute it. Both
    // are milliseconds here; core stores `G` in seconds and the nodejs wrapper converts.
    const gracePeriodMs = await UserConfigWrapperActions.getProGracePeriod();
    return now >= accessExpiryMs - gracePeriodMs;
  }

  // Not auto-renewing. Expiring inside the CTA window, or already past `E` (where the fetch is the
  // confirm-before-Expired-CTA step — config can say expired while a renewal that landed on another
  // device hasn't synced yet).
  return now >= accessExpiryMs - PRO_EXPIRING_CTA_WINDOW_MS;
}

/**
 * Read `auto_renewing` (config key `A`) from synced config.
 *
 * `A` is presence-only in core: `set_pro_auto_renewing` uses `set_nonzero_int`, so writing false erases
 * the key and the getter returns false for both "not auto-renewing" and "never written".
 *
 * That ambiguity used to matter, because the proof-success path wrote `E` without `A` — so an account
 * whose `E` came only from a proof read back as terminal while it was in fact renewing. The backend now
 * sends `account_auto_renewing` on the proof response and we write `A` from it there too, so every path
 * that writes `E` also writes `A`. Absent therefore genuinely means not-renewing, and the gate's
 * `!auto_renewing` rows are correct as written.
 */
async function getProAutoRenewingFromConfig(): Promise<boolean> {
  return UserConfigWrapperActions.getProAutoRenewing();
}

/**
 * Persist `auto_renewing` into synced config, mirroring how each fetch persists `E`. Without the
 * write side the config field is never populated and the startup gate has nothing to read.
 *
 * Unconditional, and deliberately so: libSession already de-dupes a no-change write one layer down
 * (`assign_if_changed` / `erase` both no-op on a clean config), which is the same property the
 * unconditional `E` write beside it relies on. A client-side guard would add nothing, and a
 * *presence*-based one would be actively wrong — `A` is presence-only, so a `false` erases the key
 * and presence flips on every change.
 *
 * Note the config-change observer watches only `E` and `I`, so an `auto_renewing` change re-derives
 * the display without triggering a fetch — we already have the synced value.
 */
async function writeProAutoRenewingToConfig(autoRenewing: boolean): Promise<void> {
  await UserConfigWrapperActions.setProAutoRenewing(autoRenewing);
}

/**
 * The gated cold-start status refresh (trigger #1). Replaces the unconditional dispatch that used to
 * sit in startup.ts, and arms #6 for this session either way.
 */
export async function refreshProStatusOnStartupIfNeeded(): Promise<void> {
  void scheduleUserExpiryStatusWake();

  if (!(await coldStartShouldFetchProStatus())) {
    return;
  }
  await Storage.put(SettingsKey.proStatusLastStartupFetchMs, NetworkTime.now());
  // Not `immediate`: on a cold start nothing has been fetched this run, so the floor is only in play
  // if a previous run fetched within the last minute — in which case dropping it is correct.
  window.inboxStore?.dispatch(proBackendDataActions.refreshGetProStatusFromProBackend({}) as any);
}

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
              await writeProAutoRenewingToConfig(state.data.autoRenewing);
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
          // `E` may have moved, so re-aim #6 at the new horizon.
          void scheduleUserExpiryStatusWake();
        }
        // trigger a UI refresh so our state and Pro rights are up to date without a restart (animated image should stop animating)
        ConvoHub.use().get(UserUtils.getOurPubKeyStrFromCache())?.triggerUIRefresh();
        // A get_pro_status fetch may have changed config (E / prepaid / status) — re-run the proof
        // renewal loop against the fresh state.
        //
        // ⚠️ MUST stay outside the `if (state.data)` guards above — it runs on a FAILED fetch too, and
        // that is load-bearing. The status floor is armed on *attempt*, so if a failure returned here
        // without reconciling, every trigger for the next 60s would be floored and skip its reconcile
        // as well; and when the proof loop is dormant (`pro_renewal_target` null) it has no wake of its
        // own, so a nudge it misses is LOST, not delayed. Moving this inside a data guard as a tidy-up
        // ("why reconcile when we got nothing back?") is exactly how iOS acquired that bug.
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
  async ({ immediate, ...opts }: WithCallerContext & WithImmediate = {}, payloadCreator) => {
    if (getFeatureFlag('debugServerRequests')) {
      window.log.info(
        `[proBackend/refreshGetProStatusFromProBackend] starting ${new Date().toISOString()}`
      );
    }

    const state = payloadCreator.getState() as StateType;

    if (state.proBackendData.details.isFetching) {
      return;
    }

    // Three separate things can refuse to start a status fetch, and only one of them can refuse in a
    // process that has never fetched:
    //
    //   in-flight    `details.isFetching`                     per-run, so it cannot refuse first time
    //   unconfirmed  `details.lastFetchedMs`                  per-run, ditto
    //   TOO SOON     `SettingsKey.proStatusLastFetchAttemptMs` PERSISTED — outlives the process
    //
    // ⚠️ THIS EXEMPTION EXISTS BECAUSE OF THE THIRD ONE. The floor reads a timestamp written by a
    // *previous* run, so without an exemption it can decline the first fetch of a process that has no
    // status at all — turning a rate limit into a mutex on exactly the cold-start path the startup gate
    // is about. `lastFetchedMs` is per-run (0 until this process completes a fetch), so it is the right
    // signal, and it is why the per-run value is kept alongside the persisted one rather than replaced
    // by it. Cold-start load stays bounded by the 24h startup interval, which is the stronger limit.
    //
    // The visible symptom is a permanent spinner: relaunch within 60s of a previous fetch, the floor
    // drops the fetch, and nothing resolves the initial loading state, so the Pro screen spins and no
    // CTA fires — both gate on a confirmed fetch. **But the spinner is the symptom, not the reason.**
    // Fixing the spinner some other way does not make this removable; the floor would still be able to
    // refuse a never-fetched process. (This also replaces the older "on a cold start the load state is
    // Init, so the floor doesn't apply anyway", which stops being true once the timestamp is persisted.)
    const noConfirmedStatusThisProcess = state.proBackendData.details.lastFetchedMs === 0;

    // Single-flight (above) prevents *concurrent* fetches; the floor prevents *frequent* ones. They
    // are not substitutes for each other, so both apply.
    if (
      !immediate &&
      opts.callerContext !== 'recover' &&
      !noConfirmedStatusThisProcess &&
      statusFetchIsFloored()
    ) {
      if (getFeatureFlag('debugServerRequests')) {
        window.log.info(
          `[proBackend/refreshGetProStatusFromProBackend] dropped: within the ${STATUS_FLOOR_MS}ms floor`
        );
      }
      // Still reconcile the proof loop on the way out. Dropping a *status* refresh must never cost a
      // proof nudge: the loop is dormant when `pro_renewal_target` is null, so it has no wake of its
      // own and a nudge it misses is lost rather than delayed.
      //
      // Desktop does not currently need this — the trailing reconcile in the fetch callback runs even
      // on a failed fetch, so nothing arms the floor without reconciling first. But that safety is an
      // invariant a reader has to hold two facts to see, and one plausible tidy-up from breaking (see
      // the note on that call). Reconciling here makes the coverage unconditional instead, matching
      // iOS. It costs no network: the reconcile is local and separately paced by COVERED_MS/DARK_*.
      void reconcileProProof();
      return;
    }

    if (getFeatureFlag('debugServerRequests')) {
      window.log.info(
        `[proBackend/refreshGetProStatusFromProBackend] triggered refresh at ${new Date().toISOString()}`
      );
    }
    // Arm the floor on *attempt*, not on success: a failed request costs the backend the same as a
    // successful one, and recording only on success lets a failing network re-request on every
    // trigger and every cold launch. Ruled: attempt for both timestamps, no split between the 60s
    // floor and the 24h gate, on all three clients. The accepted cost is that a launch with no
    // connectivity burns its startup slot — narrowed by the never-confirmed-this-process exemption
    // above, which still lets later in-session triggers retry.
    await Storage.put(SettingsKey.proStatusLastFetchAttemptMs, NetworkTime.now());

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
    builder.addCase(fetchGetProStatusFromProBackend.rejected, (state, action) => {
      window.log.error(
        `[proBackend / fetchGetProStatusFromProBackend] rejected ${action.error.message || action.error} `
      );
      // Release the single-flight. `isFetching` is set by a dispatched action but cleared only by the
      // result object landing via `fulfilled`, and the thunk's internal try/catch covers the network
      // getter only — its `contextHandler`/`callback` run outside it. So a throw in post-processing
      // rejects here, and without this reset `isFetching` stays true for the rest of the process:
      // every later status trigger early-returns, which silently disables the floor, the gate and the
      // #6 wake all at once. `isLoading` sticks the same way, and on a first-ever fetch that is a
      // permanent spinner on the Pro screen.
      //
      // Deliberately does NOT touch `data` or `lastFetchedMs`: a failed fetch must not discard the last
      // known-good status, and it must not look like a confirmation.
      state.details = { ...state.details, isFetching: false, isLoading: false, isError: true };
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
