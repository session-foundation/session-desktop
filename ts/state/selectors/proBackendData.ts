import { useSelector } from 'react-redux';
import type { StateType } from '../reducer';
import {
  getProStatusFromStorage,
  proBackendDataActions,
  RequestActionArgs,
  WithCallerContext,
  WithImmediate,
  type ProBackendDataState,
} from '../ducks/proBackendData';
import {
  getDataFeatureFlag,
  getFeatureFlag,
  getFeatureFlagMemo,
} from '../ducks/types/releasedFeaturesReduxTypes';
import { mockedProExpiryMs, proAutoRenewWithMock } from '../ducks/types/proMocks';
import { NetworkTime } from '../../util/NetworkTime';
import {
  formatDateWithLocale,
  formatPlanDuration,
  formatRoundedUpTimeUntilTimestamp,
} from '../../util/i18n/formatting/generics';
import {
  ProAccessVariant,
  ProPaymentProvider,
  ProStatus,
} from '../../session/apis/pro_backend_api/types';
import { isSimpleTokenNoArgs, tr } from '../../localization/localeTools';
import { getAppDispatch } from '../dispatch';
import { getCachedUserConfig } from '../../webworker/workers/browser/libsession/libsession_worker_userconfig_interface';
import { sleepFor } from '../../session/utils/Promise';

const getProBackendData = (state: StateType): ProBackendDataState => {
  return state.proBackendData;
};

export function proAccessVariantToString(variant: ProAccessVariant): string {
  switch (variant) {
    case ProAccessVariant.OneMonth:
      return '1 Month';
    case ProAccessVariant.ThreeMonth:
      return '3 Months';
    case ProAccessVariant.TwelveMonth:
      return '12 Months';
    default:
      // '' (none) or an unrecognized/future billing-period slug.
      return 'N/A';
  }
}

/**
 * Display string for a parsed plan period {planCount, planUnit} (libsession, plan grammar §1). The duration
 * units render via date-fns (localized + pluralized, unit preserved as-is — 12 months stays "12
 * months"). "lifetime" isn't a duration: use the localized `proPlanLifetime` if that Crowdin key
 * exists yet, else the English fallback (same gate as the pro_provider_* / pro_error_* stopgaps).
 */
export function planPeriodToString(
  planCount: number | undefined,
  planUnit: string | undefined
): string {
  if (!planUnit) {
    return 'N/A';
  }
  if (planUnit === 'lifetime') {
    const lifetimeToken = 'proPlanLifetime';
    return isSimpleTokenNoArgs(lifetimeToken) ? tr(lifetimeToken) : 'Lifetime';
  }
  const n = planCount ?? 0;
  switch (planUnit) {
    case 'second':
    case 'day':
    case 'week':
    case 'month':
    case 'year':
      return formatPlanDuration(n, planUnit);
    default:
      // libsession's closed grammar means we shouldn't get an unrecognized unit; degrade gracefully.
      return 'N/A';
  }
}

/**
 * Per-provider display strings. Client-owned i18n now — libsession no longer supplies them.
 * URLs are NOT here: they're only needed for link clicks and are fetched on demand via
 * ProWrapperActions.providerUrls(slug). Resolved dynamically from `pro_provider_<slug>_<suffix>` tokens
 * (a temporary stopgap injected into the generated localization; wiped by the next Crowdin sync, so
 * upstream them first), so a new provider needs only translations, not a code change.
 */
export type ProviderDisplayConstants = {
  store: string;
  platform: string;
  device: string;
  platform_account: string;
};

/**
 * Resolve one provider display field for [slug]: the localized `pro_provider_<slug>_<suffix>` if that token
 * exists, else the raw slug (an unknown/untranslated provider degrades to its slug — the same
 * "gate on the translation existing" rule used by the {pro_stores} list).
 */
function providerDisplay(
  slug: string,
  suffix: 'platform' | 'store' | 'device' | 'account'
): string {
  const token = `pro_provider_${slug}_${suffix}`;
  return isSimpleTokenNoArgs(token) ? tr(token) : slug;
}

export function getProProviderConstantsWithFallbacks(
  provider: ProPaymentProvider
): ProviderDisplayConstants {
  return {
    store: providerDisplay(provider, 'store'),
    platform: providerDisplay(provider, 'platform'),
    device: providerDisplay(provider, 'device'),
    platform_account: providerDisplay(provider, 'account'),
  };
}

type ProAccessDetailsSourceData = {
  currentStatus: ProStatus;
  autoRenew: boolean;
  inGracePeriod: boolean;
  variant: ProAccessVariant;
  expiryTimeMs: number;
  isPlatformRefundAvailable: boolean;
  provider: ProPaymentProvider;
  isLoading: boolean;
  isError: boolean;
};

type ProAccessDetails = {
  currentStatus: ProStatus;
  autoRenew: boolean;
  inGracePeriod: boolean;
  isProcessingRefund: boolean;
  variant: ProAccessVariant;
  variantString: string;
  expiryTimeMs: number;
  coverageEndMs: number;
  expiryTimeDateString: string;
  expiryTimeRelativeString: string;
  isPlatformRefundAvailable: boolean;
  provider: ProPaymentProvider;
  providerConstants: ProviderDisplayConstants;
};

// These values are used if pro isnt available or if no data is available from the backend.
export const defaultProAccessDetailsSourceData = {
  currentStatus: ProStatus.Never,
  autoRenew: true,
  inGracePeriod: false,
  variant: '',
  expiryTimeMs: 0,
  isPlatformRefundAvailable: false,
  provider: '',
  isLoading: false,
  isError: false,
} satisfies ProAccessDetailsSourceData;

export type ProcessedProStatus = {
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  // When the last successful fetch completed (ms, network time), 0 if none happened this run.
  // Note: the displayed status can be non-default with a 0 here, as it is seeded from local state
  // until a response arrives — see `displayStatusSeedFromLocalState`.
  lastFetchedMs: number;
  data: ProAccessDetails;
};

/**
 * DISPLAY, before any status response has arrived this run: what the plan state looks like from what
 * we hold locally.
 *
 * A STATUS ONLY — deliberately never a date. Only a response carries `latest_payment` and the values
 * that have to agree with it, so a date shown before one lands would be a guess dressed as a fact. On
 * the QA backend the compressed clock shortens the PROOF's lifetime without shortening the account's
 * entitlement, so seeding a date from the proof would show an account paid for a month as expiring in
 * minutes. The Pro settings screen — the only place a date is wanted — fetches on arrival, so
 * withholding it costs a moment.
 *
 * Seeded from synced config rather than from the last response persisted to disk, because a stored
 * response is never re-evaluated: it keeps asserting whatever the backend last said, for as long as
 * the client stays offline. The access expiry and the proof each carry their own timeline, so they go
 * stale honestly.
 *
 * This is DISPLAY only. It may say active while ACCESS says no (an entitlement we know about but hold
 * no usable proof for), and it may say expired while ACCESS still says yes (the overhang on a proof
 * that outlives the plan). Both are intended.
 */
function displayStatusSeedFromLocalState(): ProStatus {
  let proAccessExpiry: number | null = null;
  let proofExpiryMs: number | null = null;
  try {
    const cached = getCachedUserConfig();
    proAccessExpiry = cached.proAccessExpiry ?? null;
    proofExpiryMs = cached.proConfig?.proProof.expiryMs ?? null;
  } catch {
    // user config not initialised yet (e.g. pre-login): nothing to place on a timeline.
    return ProStatus.Never;
  }

  // One instant for both rungs. Reading the clock twice can straddle them, describing an account as it
  // never was at any single moment.
  const now = NetworkTime.now();

  // E is the PAYMENT-DUE instant, not the end of coverage — that runs to E + G, and G only ever
  // arrives on a response. Being past E therefore means "renewal due", not "lapsed", which is why this
  // seeds a status and leaves the dates to the fetch that follows.
  if (proAccessExpiry) {
    return now < proAccessExpiry ? ProStatus.Active : ProStatus.Expired;
  }

  // The proof's EXPIRY alone, deliberately — not whether it is usable. Revocation withdraws what this
  // device may do, and says nothing about whether the account is still paid: a credential can be
  // revoked and reissued while the plan runs on untouched. Reading usability here would also let an
  // ACCESS input decide a DISPLAY value, which is the separation this pair of values exists to keep.
  if (proofExpiryMs) {
    return now < proofExpiryMs ? ProStatus.Active : ProStatus.Expired;
  }

  return ProStatus.Never;
}

function processProBackendData({
  isLoading: _isLoading,
  isFetching: _isFetching,
  isError: _isError,
  lastFetchedMs,
  data,
}: ProBackendDataState['details']): ProcessedProStatus {
  const mockIsLoading = getFeatureFlag('mockProBackendLoading');
  const mockIsError = getFeatureFlag('mockProBackendError');

  const mockVariant = getDataFeatureFlag('mockProAccessVariant');
  const mockPlatform = getDataFeatureFlag('mockProPaymentProvider');
  const mockInGracePeriod = getFeatureFlag('mockCurrentUserHasProInGracePeriod');
  const mockIsPlatformRefundAvailable = !getFeatureFlag(
    'mockCurrentUserHasProPlatformRefundExpired'
  );
  const mockExpiry = mockedProExpiryMs();

  const isLoading = mockIsLoading || _isLoading;
  const isFetching = mockIsLoading || _isFetching;
  const isError = mockIsLoading ? false : mockIsError || _isError;

  const now = NetworkTime.now();

  // No response this run: seed the STATUS from config, and nothing else. See
  // `displayStatusSeedFromLocalState` for why the date is deliberately left unset.
  const seededStatus = data ? null : displayStatusSeedFromLocalState();

  const expiryTimeMs =
    mockExpiry ?? data?.expiryMs ?? defaultProAccessDetailsSourceData.expiryTimeMs;

  const latestAccess = data?.latestPayment ?? undefined;

  // The persisted response is read for the PLAN and the PROVIDER and for NOTHING ELSE. Those two alone
  // come from `latest_payment` and have no config or proof equivalent, so without this exception they
  // would read "N/A" on every cold launch until a fetch returned. Everything else here — the status,
  // the dates, the refund window — either has a local source that can be re-evaluated or must wait for
  // a response: a stored response is a snapshot of what the backend said once, not evidence about now.
  // Note in particular that `platformRefundExpiryTsMs` below reads `latestAccess`, never this.
  const storedPlanAndProvider = data ? undefined : getProStatusFromStorage()?.latestPayment;

  const provider =
    mockPlatform ??
    latestAccess?.paymentProvider ??
    storedPlanAndProvider?.paymentProvider ??
    defaultProAccessDetailsSourceData.provider;
  const variant = mockVariant ?? defaultProAccessDetailsSourceData.variant;
  // Real data carries a parsed {planCount, planUnit}; the mock still uses a legacy variant slug.
  const variantString = mockVariant
    ? proAccessVariantToString(mockVariant)
    : planPeriodToString(
        latestAccess?.planCount ?? storedPlanAndProvider?.planCount,
        latestAccess?.planUnit ?? storedPlanAndProvider?.planUnit
      );
  const isPlatformRefundAvailable =
    mockIsPlatformRefundAvailable ||
    (latestAccess?.platformRefundExpiryTsMs && now < latestAccess.platformRefundExpiryTsMs) ||
    defaultProAccessDetailsSourceData.isPlatformRefundAvailable;

  const autoRenew = proAutoRenewWithMock(
    data?.autoRenewing ?? defaultProAccessDetailsSourceData.autoRenew
  );

  // `expiry_ts` is the account's true expiry — what the user has paid through — so it is the date to
  // show, with no arithmetic. Coverage runs past it: the backend serves until `expiry_ts +
  // grace_period_duration` and judges `user_status` against that, so the grace window is `[E, E + grace)`.
  //
  // `grace_period_duration` here is the ACCOUNT-level field at the response root. `latestPayment` carries
  // one of the same name holding a store's raw declaration, NOT gated on auto-renewal — a subscriber who
  // cancels mid-retry keeps a nonzero value there, and reading it would place coverage weeks late.
  //
  // The root value is 0 whenever the subscription isn't auto-renewing, so no provider branching is needed
  // or wanted: a store that folds grace into its own expiry just sends a later `E`.
  //
  // Both values are milliseconds here; core stores `G` in seconds and the wrapper converts, so grace read
  // from *config* is on the other side of that boundary.
  const coverageEndMs = expiryTimeMs ? expiryTimeMs + (data?.gracePeriodDurationMs ?? 0) : 0;

  let inGracePeriod = mockInGracePeriod;
  if (expiryTimeMs && !mockInGracePeriod) {
    // Past the expiry but still covered. The upper bound is coverage end, not the expiry: `now >= E`
    // and `now < E` cannot both hold, so bounding this by `E` would make the indicator unreachable.
    // When grace is 0 the window is empty by construction, which is correct — an account with no grace
    // has no overdue-but-covered state to show.
    //
    // The `lastFetchedMs` term is the debounce: only surface "renewal unsuccessful" off a fetch that
    // COMPLETED at or after the crossing, never off a snapshot predating a renewal that may since have
    // landed. It is per-run and stamped on completion, so a request still in flight cannot satisfy it.
    inGracePeriod =
      autoRenew && now >= expiryTimeMs && now < coverageEndMs && lastFetchedMs >= expiryTimeMs;
  }

  // Refund-requested is now a synced config flag (UserProfile key R), not a backend response field.
  // Read it from the cached user config; libsession applies the 1-week read gate.
  let refundRequested: number | null = null;
  try {
    refundRequested = getCachedUserConfig().refundRequested;
  } catch {
    // cached user config not initialised yet (e.g. pre-login): treat as no refund in progress
  }
  const isProcessingRefund = !!refundRequested;

  return {
    data: {
      currentStatus:
        data?.userStatus ?? seededStatus ?? defaultProAccessDetailsSourceData.currentStatus,
      autoRenew,
      inGracePeriod,
      isProcessingRefund,
      variant,
      variantString,
      expiryTimeMs,
      coverageEndMs,
      // An unset expiry renders as ABSENT, never as the epoch. Formatting a 0 gave "Jan 1, 1970" on
      // every screen that shows a date before a response has landed, which is now the specified
      // pre-response state rather than a rare one. The screens carry their own loading and error
      // states, so showing nothing is the honest option.
      expiryTimeDateString: expiryTimeMs
        ? formatDateWithLocale({
            date: new Date(expiryTimeMs),
            formatStr: 'MMM d, yyyy',
          })
        : '',
      expiryTimeRelativeString: expiryTimeMs ? formatRoundedUpTimeUntilTimestamp(expiryTimeMs) : '',
      isPlatformRefundAvailable,
      provider,
      providerConstants: getProProviderConstantsWithFallbacks(provider),
    },
    isLoading,
    isFetching,
    isError,
    lastFetchedMs,
  };
}

export const getProBackendProStatus = (state: StateType): ProcessedProStatus => {
  return processProBackendData(getProBackendData(state).details);
};

export const getProBackendCurrentUserStatus = (state: StateType) => {
  return getProBackendProStatus(state).data?.currentStatus;
};

export const useProBackendProStatus = () => {
  return useSelector(getProBackendProStatus);
};

export const useProBackendCurrentUserStatus = () => {
  return useSelector(getProBackendCurrentUserStatus);
};

export function useProBackendRefetch() {
  const dispatch = getAppDispatch();

  const details = useProBackendProStatus();

  const mockSuccess = getFeatureFlagMemo('mockProRecoverButtonAlwaysSucceed');
  const mockFail = getFeatureFlagMemo('mockProRecoverButtonAlwaysFail');

  const mockRefetchSuccess = async () => {
    const setProBackendIsLoading = (props: RequestActionArgs) =>
      dispatch(proBackendDataActions.setIsLoading(props));
    const setProBackendIsError = (props: RequestActionArgs) =>
      dispatch(proBackendDataActions.setIsError(props));

    if (details.isLoading) {
      return;
    }
    setProBackendIsLoading({ key: 'details', result: true });
    setProBackendIsError({ key: 'details', result: false });
    await sleepFor(5000);
    setProBackendIsLoading({ key: 'details', result: false });
  };

  const mockRefetchFail = async () => {
    const setProBackendIsLoading = (props: RequestActionArgs) =>
      dispatch(proBackendDataActions.setIsLoading(props));
    const setProBackendIsError = (props: RequestActionArgs) =>
      dispatch(proBackendDataActions.setIsError(props));
    if (details.isLoading) {
      return;
    }
    setProBackendIsLoading({ key: 'details', result: true });
    setProBackendIsError({ key: 'details', result: false });
    await sleepFor(5000);
    setProBackendIsError({ key: 'details', result: true });
    setProBackendIsLoading({ key: 'details', result: false });
  };

  const refetch = (args: WithCallerContext & WithImmediate = {}) => {
    if (details.isError || mockFail) {
      void mockRefetchFail();
      return;
    }

    if (mockSuccess) {
      void mockRefetchSuccess();
      return;
    }
    dispatch(proBackendDataActions.refreshGetProStatusFromProBackend(args) as any);
  };

  return refetch;
}
