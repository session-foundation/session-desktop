import type { WithMasterPrivKeyHex } from 'libsession_util_nodejs';
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { isUndefined } from 'lodash';
import type { StateType } from '../reducer';
import ProBackendAPI from '../../session/apis/pro_backend_api/ProBackendAPI';
import { getFeatureFlag } from './types/releasedFeaturesReduxTypes';
import { mockedProExpiryMs, proAutoRenewWithMock, proStatusWithMock } from './types/proMocks';
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
import { LibSessionUtil } from '../../session/utils/libsession/libsession_utils';
import {
  handleTriggeredCTAs,
  markProStatusConfirmedThisRun,
} from '../../components/dialog/SessionCTA';

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
  // Per-run and completion-stamped: the answer to "has this process confirmed our status", which the
  // floor's never-confirmed exemption, the home Pro CTA gate and the grace warning's debounce all read.
  //
  // Not interchangeable with SettingsKey.proStatusLastFetchAttemptMs, which is persisted and stamped on
  // *attempt* because it backs the 60s floor. Similar names, opposite meanings.
  //
  // Deleting this as "subsumed by the floor" ships a permanent spinner: a relaunch inside 60s hits the
  // floor, the fetch is dropped, and nothing resolves the initial loading state, which both the spinner
  // and the CTAs gate on. It becomes removable once no consumer needs a *this-process* confirmation —
  // and note that letting a previous process's confirmation satisfy the CTA gate reopens the
  // false-expired window that gating startup created.
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
 * `immediate` means one thing only: bypass the status floor. It does not bypass the single-flight guard
 * and does not touch the loading state. The name is load-bearing: a permissive one like `force` reads as
 * something any routine trigger may pass, and a floor every caller bypasses is dead code.
 *
 * Sanctioned callers and no others: manual refresh/recover (implied by `callerContext: 'recover'`), the
 * bounded while-open grace poll, and developer/debug paths.
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

export function getProStatusFromStorage(): ProStatusResultType | null {
  const response = Storage.get(SettingsKey.proStatus);
  if (!response) {
    return null;
  }
  // We persist, verbatim, the JS object the libsession-util-nodejs glue produced from the backend
  // response (see putProStatusInStorage) — not a raw libsession struct — and cast it back to the
  // CURRENT ProStatusResultType (an alias of the glue's GetProStatusResponse). session-desktop and
  // libsession-util-nodejs ship in lockstep, so within a single build the producer, the type and this
  // consumer can't drift — but a cache written by an OLDER build can.
  //
  // ⚠️ TRANSITION REQUIRED IF YOU ADD A REQUIRED FIELD to this shape: an upgraded client would read a
  // stale-shape cache here and cast it to the new type with that field undefined (the Array.isArray
  // check below validates only the top level, not individual fields). Handle it as part of that change —
  // e.g. drop this cache behind a stored shape/version marker, or keep the new field optional at this
  // boundary. It's a transient, re-fetched cache, so drop-and-refetch is the simplest transition. This
  // is left as a reminder rather than pre-built, since pre-building would just be guessing at the shape.
  if (typeof response === 'object' && response !== null && 'userStatus' in response) {
    return response as ProStatusResultType;
  }
  void Storage.remove(SettingsKey.proStatus);
  window?.log?.error('pro status in storage were malformed; removing.');
  return null;
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
/**
 * Put a Pro config write on disk, now rather than whenever something else happens to.
 *
 * A setter leaves its value in the in-memory wrapper, and the only writer of the dump is `UserSyncJob`,
 * whose periodic tick does not exist until the 20s timeout in `doAppStartUp` has scheduled the first
 * one. A process that ends before then loses the write outright.
 *
 * Local durability only — deliberately not a push. The wrapper records that a change still needs
 * pushing and that state rides the dump, so the ordinary sync job sends this whenever it next runs. The
 * delay before that first job is not a gap to be worked around: it is there so a client that is still
 * receiving its own config does not publish a partial one over it.
 *
 * Call once per write group, not per setter. `E`, `A` and `G` are only jointly meaningful and are always
 * written together, and each dump costs a worker round trip plus an IPC round trip to the main process.
 *
 * ⚠️ Never throws. A failed dump is a transient IPC/DB problem and the value is still correct in the
 * wrapper, so the next dump carries it; throwing here would abort the rest of the caller's write group
 * and leave `E` stored without the `A` and `G` that qualify it — the mismatch the callers go out of
 * their way to avoid.
 */
export async function persistProConfigWrite(): Promise<void> {
  try {
    await LibSessionUtil.saveDumpsToDb(UserUtils.getOurPubKeyStrFromCache());
  } catch (e) {
    window?.log?.warn(`persistProConfigWrite: saving the config dump failed: ${e.message}`);
  }
}

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
    // Refresh cached access-expiry from the advisory account_expiry (decoupled from the proof guard, so
    // a mid-period horizon extension is still picked up). `A` and `G` ride along, and must: otherwise
    // `E + G` pairs a fresh expiry with a grace from a different billing period, and an unwritten `A`
    // reads as not-renewing.
    //
    // All three writes belong inside the success branch. On a failure outcome core never fills
    // `accountAutoRenewing`/`accountGracePeriodMs`, so its struct defaults (`false`/`0`) come through,
    // indistinguishable from a backend that said "not renewing, no grace" — and both keys are
    // presence-only, so writing those would erase what a `get_pro_status` fetch had learned.
    //
    // `accountExpiryMs` is nullable — absent on `not_subscribed` and `revoked` — hence its guard.
    if (response.accountExpiryMs !== null) {
      await UserConfigWrapperActions.setProAccessExpiry(response.accountExpiryMs);
    }
    await writeProAutoRenewingToConfig(response.accountAutoRenewing);
    await UserConfigWrapperActions.setProGracePeriod(response.accountGracePeriodMs);
    await persistProConfigWrite();
    return;
  }
  // Non-ok: the machine slug (error_code) decides.
  switch (response.errorCode) {
    case 'subscription_expired':
      // Lapsed, so not entitled — the same conclusion as the two outcomes below, and cleared the same
      // way. A past expiry left in config has nothing left to compute: every window here is derived
      // from `E`, and a lapse changes the grace and the renewing flag while typically leaving `E`
      // itself alone, so refreshing only `E` would pair it with a grace the backend has stopped
      // honouring. Clearing erases `A` and `G` alongside it instead, leaving absent keys rather than
      // stored zeroes. Don't wipe a fresh proof a re-subscribe just landed.
      if (!haveValidProof()) {
        await UserConfigWrapperActions.removeProConfig();
        await UserConfigWrapperActions.setProAccessExpiry(null);
        await persistProConfigWrite();
        // Entitlement ended, and nothing observes that: the config watch that would refresh our status
        // runs on incoming merges, so a local write reaches no one. The Expired CTA needs a status fetch
        // to be raised at all — it is written by one — and the clear above leaves the cold-start gate
        // without a horizon to decide from, so this is the only edge from "we just lapsed" to "find out
        // what to show". Floored like every routine trigger: when a status fetch has just run, this is
        // dropped, which is right — that fetch already had the chance to raise it.
        window.inboxStore?.dispatch(
          proBackendDataActions.refreshGetProStatusFromProBackend({}) as any
        );
      }
      break;
    case 'not_subscribed':
      // Clear the (absent) credential AND the access-expiry (E), but leave pro_prepaid so a pending
      // purchase keeps polling. Clearing E is required: libsession's renewal target now fires on
      // "future E but no proof", so a stale future E left here would spin.
      if (!haveValidProof()) {
        await UserConfigWrapperActions.removeProConfig();
        await UserConfigWrapperActions.setProAccessExpiry(null);
        await persistProConfigWrite();
      }
      break;
    case 'revoked':
      // Terminal: revocation kills even an unexpired proof (bypasses the downgrade guard). With the
      // proof gone we must also clear E, or the renewal target (future E, no proof) would spin.
      await UserConfigWrapperActions.removeProConfig();
      await UserConfigWrapperActions.setProAccessExpiry(null);
      await persistProConfigWrite();
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
  await persistProConfigWrite();
}

// ===== get_pro_status refresh discipline =====
// Named rather than inlined because these are a cross-client contract, not local tuning: the same
// quantities carry the same names on the other clients so that one platform cannot be retuned in
// isolation. A change here needs the same change there, or the clients disagree about the same instant.

/**
 * Minimum gap between *routine* status fetches. Drop-on-fresh — see statusFetchIsFloored.
 *
 * A scheduled wake depends on this not being crossed: scheduleUserExpiryStatusWake arms two instants `G`
 * apart, both through the floored path, so when `G < STATUS_FLOOR_MS` the second fires and its fetch is
 * dropped with no log line to say so. `G` is at least an hour in production and ~10s on a compressed test
 * backend, whose scaled clock this constant does not participate in — override it by env var for those
 * runs rather than shortening it.
 */
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
  gracePeriodDurationMs: number,
  autoRenewing: boolean,
  status: ProStatus
) {
  const now = NetworkTime.now();

  // The Expiring window is anchored at `E`: "your payment is due soon" is a statement about the payment
  // date, so coverage doesn't enter into it.
  const sevenDaysBeforeExpiry = accessExpiryTsMs - PRO_EXPIRING_CTA_WINDOW_MS;
  // The Expired window is anchored at coverage end. The backend reports `Expired` only once coverage has
  // ended, at `E + G`, so measuring the 30 days from `E` instead shortens the window by exactly `G` —
  // and closes it entirely when `G >= 30d`, which a store grace period can reach.
  const expiredCTADeadlineMs = accessExpiryTsMs + gracePeriodDurationMs + PRO_EXPIRED_CTA_WINDOW_MS;

  const proExpiringSoonCTA = !isUndefined(Storage.get(SettingsKey.proExpiringSoonCTA));
  const proExpiredCTA = !isUndefined(Storage.get(SettingsKey.proExpiredCTA));

  // Remove the pro expired cta item if the user gets pro again
  if (status === ProStatus.Active && proExpiredCTA) {
    await Storage.remove(SettingsKey.proExpiredCTA);
  }

  // `status` is the authority on whether the account has lapsed, and it accounts for revocation, which no
  // date arithmetic here can see: a refund or chargeback reports Expired while the paid term is still in
  // the future. Keyed on the status alone, so it must run ahead of the date chain below — a revoked
  // account sits inside the active or expiring window and would be handled as one.
  if (status === ProStatus.Expired && now < expiredCTADeadlineMs) {
    if (!proExpiredCTA) {
      await Storage.put(SettingsKey.proExpiredCTA, true);
      // Shown again in a later cycle if needed.
      if (proExpiringSoonCTA) {
        await Storage.remove(SettingsKey.proExpiringSoonCTA);
      }
    }
    return;
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
  }
}

/**
 * Arm the expiry CTAs from the mocks alone, with no backend round trip.
 *
 * The CTA decision on Desktop is *persisted*, not derived: `handleExpiryCTAs` writes
 * `SettingsKey.proExpiringSoonCTA` from a fetched response, and `handleTriggeredCTAs` later reads the
 * mark. A mock applied where status is *selected* therefore lands downstream of the decision, which is
 * why the existing mocks can render a Pro screen but cannot arm this CTA. iOS reaches the same place
 * with `LoadingState.simulate(.success)`.
 *
 * This deliberately runs the real `handleExpiryCTAs` rather than seeding the stored flag: the seven-day
 * and thirty-day boundaries, and the clearing when an account goes active again, are the behaviour a
 * spec exists to exercise.
 *
 * Returns whether it handled startup, so the caller can skip the real fetch — letting both run would
 * have a genuine response overwrite the mocked decision moments later.
 */
export async function applyMockedProStatusAtStartup(
  dispatch: Parameters<typeof handleTriggeredCTAs>[0]
): Promise<boolean> {
  if (!getFeatureFlag('mockProBackendSuccess')) {
    return false;
  }

  let configExpiry: number | null = null;
  // `G` only ever reaches config from a real response, so a mocked run usually has none and the
  // Expired window falls back to being measured from `E` alone. Read from the same place as the
  // expiry rather than mocked separately: the two are written together, and a grace period that
  // disagreed with the expiry beside it is not a state the backend can produce.
  let configGraceMs = 0;
  try {
    const cached = getCachedUserConfig();
    configExpiry = cached.proAccessExpiry ?? null;
    configGraceMs = cached.proGracePeriod ?? 0;
  } catch {
    // config not initialised yet: the mocked expiry is the only source, which is the normal case here.
  }
  const expiryMs = mockedProExpiryMs() ?? configExpiry ?? 0;
  if (!expiryMs) {
    // Every branch of handleExpiryCTAs is relative to the expiry, so without one it is a no-op and a
    // spec would see nothing with no indication why.
    window?.log?.warn(
      'mockProBackendSuccess is set but no expiry is known: set SESSION_PRO_ACCESS_EXPIRY'
    );
  }

  await handleExpiryCTAs(
    expiryMs,
    configGraceMs,
    proAutoRenewWithMock(true),
    proStatusWithMock(ProStatus.Active)
  );
  // A simulated success confirms a status as far as the CTAs are concerned: the whole point is to reach
  // them without a round trip, and the guard they sit behind asks whether a status is known, not whether
  // the network produced it.
  markProStatusConfirmedThisRun();
  void handleTriggeredCTAs(dispatch, false);
  firstFetchProStatusHappened = true;
  return true;
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
 * Drop-on-fresh, not re-arm: rescheduling the skipped fetch would turn the routine triggers into a
 * self-sustaining once/60s poll, and during grace `E` sits static so it would carry nothing new. Safe
 * because status is display-only and backstopped by many triggers.
 *
 * The proof loop is deliberately the opposite — a throttled proof acquisition must still eventually
 * happen — so don't unify the two.
 */
function statusFetchIsFloored(): boolean {
  return NetworkTime.now() < lastStatusFetchAttemptAtMs() + STATUS_FLOOR_MS;
}

// ===== #6 — the single wake at user_expiry =====

let userExpiryWakeIds: Array<ReturnType<typeof setTimeout>> = [];

/**
 * Schedule the background status refreshes around the end of a billing period.
 *
 * With the Pro page closed, nothing else re-checks between the expiry and the proof loop's own wake.
 *
 * Two instants, `E + 30s` and `(E + G) + 30s`, collapsing to one when `G` is zero. The second is not
 * redundant: the proof loop wakes near `E` by construction, but that chain fires only when `E` actually
 * changes, so it covers a renewal that succeeded and not one that failed.
 *
 * Re-derived on every call, so a renewal that advances `E` cannot leave a wake armed against the old
 * horizon.
 *
 * Both instants emit through the floored path and are `G` apart, so a short `G` drops the second one's
 * fetch — see STATUS_FLOOR_MS.
 */
export async function scheduleUserExpiryStatusWake(): Promise<void> {
  // Always clear before re-deriving. This function is called on startup and after every successful
  // fetch, so a renewal that advances `E` re-arms both instants against the NEW horizon; leaving a
  // stale wake armed would fire at an instant that no longer means anything.
  userExpiryWakeIds.forEach(clearTimeout);
  userExpiryWakeIds = [];

  const accessExpiryMs = await UserConfigWrapperActions.getProAccessExpiry();
  if (!accessExpiryMs) {
    return;
  }
  const gracePeriodMs = (await UserConfigWrapperActions.getProGracePeriod()) ?? 0;
  const coverageEndMs = accessExpiryMs + gracePeriodMs;

  // Two instants, because two distinct transitions matter and neither implies the other:
  //
  //   expiry (E)              did the charge succeed, or has it silently failed?
  //   coverage end (E + G)    did grace run out without a recovery?
  //
  // Only one when `G` is zero, which is every non-auto-renewing account: the two collapse to the same
  // moment and scheduling both would just double the fetch.
  const wakeAtMs = [accessExpiryMs];
  if (coverageEndMs !== accessExpiryMs) {
    wakeAtMs.push(coverageEndMs);
  }

  const now = NetworkTime.now();
  wakeAtMs.forEach(atMs => {
    const delayMs = atMs + USER_EXPIRY_WAKE_DELAY_MS - now;
    if (delayMs <= 0) {
      // Already past. Not replayed on every launch — that is the startup gate's job, and it is the
      // thing that decides whether a cold start may fetch at all.
      return;
    }
    userExpiryWakeIds.push(
      setTimeout(() => {
        // Floored, like every other routine trigger — a nudge, not a "go right now".
        window.inboxStore?.dispatch(
          proBackendDataActions.refreshGetProStatusFromProBackend({}) as any
        );
      }, delayMs)
    );
  });
}

// ===== The startup gate =====

/**
 * Record the startup gate's verdict, the row that produced it, and the values that row read.
 *
 * A gate that declines silently is indistinguishable from one that never ran, so a log line that only
 * said "no fetch" would not be worth its cost — the reason and the inputs are the whole point. Every
 * row logs, including the ones that allow the fetch, because "which row let this through" is the same
 * question asked from the other side.
 *
 * Pass-through: it returns what it is given, so it cannot move the gate's answer.
 */
function logGateDecision(
  shouldFetch: boolean,
  reason: string,
  inputs: Record<string, unknown>
): boolean {
  const values = Object.entries(inputs)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ');
  window?.log?.debug(
    `[proStartupGate] ${shouldFetch ? 'FETCH' : 'no fetch'}: ${reason} — ${values}`
  );
  return shouldFetch;
}

/**
 * Whether a *cold start* is allowed to fetch `get_pro_status`.
 *
 * Startup's only consumer is the home CTAs — entitlement comes from the proof and the settings screen
 * refreshes on open — so decide from synced config whether a CTA could plausibly fire, rather than
 * fetching on every launch for every non-Pro and comfortably-active user.
 *
 *   now >= E + G + 30d                            -> lapsed too long ago for any CTA, no fetch
 *   auto_renewing && now <  E                     -> comfortably active, no fetch
 *   auto_renewing && now >= E                     -> in grace or past it, unknowable from config,
 *                                                    FETCH and learn which from the response
 *   !auto_renewing && E within the CTA window     -> expiring, fetch / CTA
 *   !auto_renewing && now >= E                    -> expired, confirm-fetch before the Expired CTA
 *
 * Only the upper bound uses `G`: grace and post-coverage both resolve to "fetch", so the lower bounds
 * need only "has the paid term ended", while "how long ago did this lapse" is measured from `E + G`.
 *
 * Capped either way at one cold-start fetch per STATUS_STARTUP_MIN_INTERVAL_MS.
 */
async function coldStartShouldFetchProStatus(): Promise<boolean> {
  // The interval cap comes first so that it bounds every row below it, including the no-expiry row, which
  // is keyed on a stored flag rather than on a horizon and would otherwise fetch on every single launch.
  const lastStartupFetchMs =
    (Storage.get(SettingsKey.proStatusLastStartupFetchMs) as number | undefined) ?? 0;
  const nowAtEntry = NetworkTime.now();
  if (nowAtEntry < lastStartupFetchMs + STATUS_STARTUP_MIN_INTERVAL_MS) {
    return logGateDecision(false, 'inside the minimum interval since the last cold-start fetch', {
      now: nowAtEntry,
      lastStartupFetchMs,
      minIntervalMs: STATUS_STARTUP_MIN_INTERVAL_MS,
    });
  }

  const accessExpiryMs = await UserConfigWrapperActions.getProAccessExpiry();
  if (!accessExpiryMs) {
    // No expiry in config: Pro was never held, or an outcome that ended entitlement cleared it. There is
    // no window left to compute — every bound below is derived from `E` — so the only thing that can still
    // want a fetch is an Expired CTA already latched by an earlier fetch. It gates on a status confirmed in
    // *this* process, so without a fetch here it can never be shown and the flag would sit set forever.
    const latchedExpiredCTA = Storage.get(SettingsKey.proExpiredCTA);
    return logGateDecision(
      !isUndefined(latchedExpiredCTA),
      'no access expiry in config, so only a latched Expired CTA can still want a fetch',
      { now: nowAtEntry, accessExpiryMs, latchedExpiredCTA, lastStartupFetchMs }
    );
  }

  const now = NetworkTime.now();
  const autoRenewing = await getProAutoRenewingFromConfig();

  // The upper bound, and the one place this gate needs to know how LONG grace runs rather than just
  // that the paid term has ended. Past the last instant an Expired CTA could be raised there is nothing
  // left to learn, so an account that lapsed long ago must stop fetching — otherwise it fetches once
  // per STATUS_STARTUP_MIN_INTERVAL_MS forever, for a CTA that can no longer fire.
  //
  // Measured from coverage end, not from `E`: an account is not treated as lapsed until `E + G`, so
  // measuring the elapsed time from `E` would shorten a renewing account's window by exactly its grace
  // period. `G` is 0 when not auto-renewing, which makes this `E + 30d` for those accounts.
  const gracePeriodMs = (await UserConfigWrapperActions.getProGracePeriod()) ?? 0;
  const inputs = { now, accessExpiryMs, autoRenewing, gracePeriodMs, lastStartupFetchMs };
  if (now >= accessExpiryMs + gracePeriodMs + PRO_EXPIRED_CTA_WINDOW_MS) {
    return logGateDecision(false, 'lapsed longer ago than any CTA window reaches back', inputs);
  }

  if (autoRenewing) {
    // `E` is the account's true expiry — what has been paid for. Past it the renewal has either landed
    // (and `E` should have moved) or it hasn't, and config alone cannot tell which, so fetch and find
    // out. The lower bound is `E` and not coverage end: both sides of `E + G` want a fetch — inside
    // grace to surface "renewal unsuccessful", past it to surface Expired — so the only instant that
    // changes the answer is `E` itself.
    return logGateDecision(
      now >= accessExpiryMs,
      'auto-renewing, so nothing to learn until the paid term has ended',
      inputs
    );
  }

  // Not auto-renewing. Expiring inside the CTA window, or already past `E` (where the fetch is the
  // confirm-before-Expired-CTA step — config can say expired while a renewal that landed on another
  // device hasn't synced yet).
  return logGateDecision(
    now >= accessExpiryMs - PRO_EXPIRING_CTA_WINDOW_MS,
    'not auto-renewing, so the expiring-soon window is the lower bound',
    inputs
  );
}

/**
 * Read `auto_renewing` (config key `A`) from synced config.
 *
 * `A` is presence-only in core: `set_pro_auto_renewing` uses `set_nonzero_int`, so writing false erases
 * the key and the getter returns false for both "not auto-renewing" and "never written".
 *
 * That ambiguity is harmless because an `A` without an `E` beside it is not reachable here: the only two
 * paths that write `E` — the status fetch and a successful proof — write `A` from the same response, and
 * every outcome that ends entitlement *clears* `E`, which erases `A` and `G` with it. A new writer of `E`
 * has to carry the renewing flag, or that stops being true.
 */
async function getProAutoRenewingFromConfig(): Promise<boolean> {
  return UserConfigWrapperActions.getProAutoRenewing();
}

/**
 * Persist `auto_renewing` into synced config, mirroring how each fetch persists `E`.
 *
 * Unconditional: libSession de-dupes a no-change write one layer down. A *presence*-based guard would be
 * actively wrong — `A` is presence-only, so a `false` erases the key and presence flips on every change.
 */
async function writeProAutoRenewingToConfig(autoRenewing: boolean): Promise<void> {
  await UserConfigWrapperActions.setProAutoRenewing(autoRenewing);
}

/**
 * The gated cold-start status refresh (trigger #1). Arms #6 for this session whether or not the gate
 * allows the fetch.
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
              //
              // All three are written from the SAME response, which is the only way they are jointly
              // meaningful: `E + G` is coverage end, so a fresh `E` beside a `G` left over from an
              // earlier subscription state describes an instant that was never true. `G` is the
              // ACCOUNT-level `gracePeriodDurationMs` at the response root — not `latestPayment`'s
              // field of the same name, which is one store's raw declaration and is not gated on
              // auto-renewal.
              await UserConfigWrapperActions.setProAccessExpiry(state.data.expiryMs);
              await writeProAutoRenewingToConfig(state.data.autoRenewing);
              await UserConfigWrapperActions.setProGracePeriod(state.data.gracePeriodDurationMs);
              await persistProConfigWrite();
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
          // The mocks have to be applied here too, not only in the settings selector: this reads the
          // raw fetched response, so without them a mocked expiry or status never reaches the code
          // that arms the CTAs and neither expiry CTA is reachable from a test.
          await handleExpiryCTAs(
            mockedProExpiryMs() ?? state.data.expiryMs,
            state.data.gracePeriodDurationMs,
            proAutoRenewWithMock(state.data.autoRenewing),
            proStatusWithMock(state.data.userStatus)
          );
          markProStatusConfirmedThisRun();
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
        // ("why reconcile when we got nothing back?") is what reintroduces it.
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

    // Of the three things that can refuse a status fetch, only the floor's persisted timestamp can
    // refuse in a process that has never fetched — `isFetching` and `lastFetchedMs` are both per-run. So
    // without this exemption the floor becomes a mutex on the cold-start path rather than a rate limit.
    // Cold-start load stays bounded by the 24h startup interval, which is the stronger limit.
    //
    // Fixing the resulting spinner elsewhere would not make this removable: the floor would still be
    // able to refuse a never-fetched process.
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
      // the note on that call). Reconciling here makes that coverage unconditional rather than
      // inferred. It costs no network: the reconcile is local and separately paced by COVERED_MS/DARK_*.
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
