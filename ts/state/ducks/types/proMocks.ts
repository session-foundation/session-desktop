import { ProStatus } from '../../../session/apis/pro_backend_api/types';
import { NetworkTime } from '../../../util/NetworkTime';
import {
  getDataFeatureFlag,
  getFeatureFlag,
  MockProAccessExpiryOptions,
  MockProProofOptions,
} from './releasedFeaturesReduxTypes';

/**
 * One definition of what the Pro mocks mean, shared by everything that has to honour them.
 *
 * There are three consumers and they are reached by different paths — the settings selector, the
 * `useHasPro` gate, and the CTA arming inside the get_pro_status thunk, which reads the raw fetched
 * response rather than the selector's output. Each applying its own overrides is how the CTAs ended up
 * unreachable from a mock while the settings screen honoured it.
 */

function mockedProAccessExpiryDuration(variant: MockProAccessExpiryOptions): number | null {
  switch (variant) {
    case MockProAccessExpiryOptions.P7D:
      return 7 * 24 * 60 * 60 * 1000;
    case MockProAccessExpiryOptions.P29D:
      return 29 * 24 * 60 * 60 * 1000;
    case MockProAccessExpiryOptions.P30D:
      return 30 * 24 * 60 * 60 * 1000;
    case MockProAccessExpiryOptions.P30DT1S:
      return 30 * 24 * 60 * 61 * 1000;
    case MockProAccessExpiryOptions.P90D:
      return 90 * 24 * 60 * 60 * 1000;
    case MockProAccessExpiryOptions.P300D:
      return 300 * 24 * 60 * 60 * 1000;
    case MockProAccessExpiryOptions.P365D:
      return 365 * 24 * 60 * 60 * 1000;
    case MockProAccessExpiryOptions.P24DT1M:
      return 24 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000;
    case MockProAccessExpiryOptions.PT24H1M:
      return 24 * 60 * 60 * 1000 + 60 * 60 * 1000;
    case MockProAccessExpiryOptions.PT23H59M:
      return 23 * 60 * 60 * 1000 + 59 * 60 * 1000;
    case MockProAccessExpiryOptions.PT33M:
      return 33 * 60 * 1000;
    case MockProAccessExpiryOptions.PT1M:
      return 1 * 60 * 1000;
    case MockProAccessExpiryOptions.PT10S:
      return 10 * 1000;
    default:
      return null;
  }
}

/**
 * The mocked access expiry as an absolute timestamp, or null when unmocked.
 *
 * Measured from `NetworkTime.now()`, not `Date.now()`: every consumer compares this against network
 * time, so a device clock offset would otherwise move a mocked "expires in N" by that offset relative
 * to the window judging it. Harmless at N = 30 days, decisive at the sub-minute options.
 *
 * The extra -250ms keeps the rendered duration rounding up to the mocked value rather than losing a
 * unit to render lag.
 */
export function mockedProExpiryMs(): number | null {
  const variant = getDataFeatureFlag('mockProAccessExpiry');
  if (variant === null) {
    return null;
  }
  const duration = mockedProAccessExpiryDuration(variant);
  return duration === null ? null : NetworkTime.now() - 250 + duration;
}

/** The Pro status to project, given the one the backend actually reported. */
export function proStatusWithMock(actual: ProStatus): ProStatus {
  return getDataFeatureFlag('mockProCurrentStatus') ?? actual;
}

/**
 * Whether our Pro ACCESS should be treated as granted, given what the proof actually says.
 *
 * Driven by its OWN mock, not by the status mock. A mocked run holds no signed credential, so without a
 * lever of its own every ACCESS surface would be dark in every mocked run — but tying it to the status
 * mock instead would make the one interesting state unexpressible: a plan reading active while no usable
 * proof exists, which is where a message is accepted at the Pro length and silently truncated for every
 * recipient. Two levers, set independently, so a test can ask for either or for the disagreement.
 *
 * Applied at the single ACCESS function rather than at each caller, so rendering and enforcement can
 * never differ about what a mocked run is entitled to. Unmocked — every real client — ACCESS is the
 * proof and nothing else.
 */
export function proAccessWithMock(actual: boolean): boolean {
  const mocked = getDataFeatureFlag('mockProProof');
  if (mocked === null) {
    return actual;
  }
  return mocked === MockProProofOptions.Valid;
}

/** Whether the plan should be treated as auto-renewing, given what the backend actually reported. */
export function proAutoRenewWithMock(actual: boolean): boolean {
  return getFeatureFlag('mockCurrentUserHasProCancelled') ? false : actual;
}
