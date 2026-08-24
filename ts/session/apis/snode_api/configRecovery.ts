/* eslint-disable no-await-in-loop */
import AbortController from 'abort-controller';
import { PubkeyType } from 'libsession_util_nodejs';
import { chunk, isEmpty } from 'lodash';
import { UserUtils } from '../../utils';
import type { ConfigWrapperUser } from '../../../webworker/workers/browser/libsession_worker_functions';
import { UserGenericWrapperActions } from '../../../webworker/workers/browser/libsession_worker_interface';
import { LibSessionUtil } from '../../utils/libsession/libsession_utils';
import { DURATION, TTL_DEFAULT } from '../../constants';
import { NetworkTime } from '../../../util/NetworkTime';
import { MessageSender } from '../../sending/MessageSender';
import { timeoutWithAbort } from '../../utils/Promise';
import {
  DeleteHashesFromUserNodeSubRequest,
  MAX_SUBREQUESTS_COUNT,
  StoreUserConfigSubRequest,
} from './SnodeRequestTypes';
import { ConfigExpiryDetection } from './configExpiryDetection';
import { ed25519Str } from '../../utils/String';

type SnodeSubRequestForRecovery = StoreUserConfigSubRequest | DeleteHashesFromUserNodeSubRequest;

/**
 * Putting a config message back on the swarm after it expired from it.
 *
 * The whole thing rests on config encryption being deterministic: re-storing an *unchanged* config
 * produces the identical message hash it had before, so this is the same message going back where
 * it was, not a new one competing with existing state. Which is why nothing here is allowed to
 * dirty a config to force an upload — that would bump the seqno and trigger a merge, and turn a
 * repair into the destructive thing this design exists to avoid.
 *
 * See CONFIG_EXPIRY_DETECTION_SPEC.md §4 (guards) and §5 (the action).
 *
 * Note: group configs are detected but NOT recovered here. The NodeJS wrapper's
 * `MetaGroupWrapper::push()` returns null for any sub-config whose `needs_push()` is false, and
 * §4.2 only lets us re-store a config that is clean — i.e. exactly when it returns null. There is
 * no way to reach the bytes until the wrapper exposes an unconditional serialise.
 *
 * When that lands and group recovery is wired up, note that the obsolete-hash handling below does
 * *not* carry over unchanged. A group member holds its configs read-only, and `push()` hands back
 * the superseded hashes only `if (!is_readonly())` while clearing them either way
 * (`base.cpp:809-813`). So on the member path an empty list is the expected result, not a sign
 * anything failed — and a member could not act on it anyway, since its subaccount token carries
 * Read+Write but not Delete. Member-driven recovery re-stores but never prunes; the superseded
 * messages wait for an admin's next push.
 */

/**
 * None of this state is persisted, deliberately rather than merely unimplemented: guard §4.1 asks
 * what has happened since this process started, so a verdict reloaded from disk would be answering
 * that question about a previous run.
 *
 * The scoping is NOT uniform across these declarations, though it reads as if it should be and it
 * once was — the two Sets below are session-scoped, `hashSettledAt` is time-bounded.
 */
const swarmsLevelWithLocalState = new Set<string>();
const swarmsWithIncompleteMerge = new Set<string>();
/**
 * hash -> when it was settled, for either of two reasons that must not be conflated with a FAILED
 * store (which stays retryable — §5.5 as amended in spec v40):
 *   - it was stored successfully; or
 *   - a guard ruled it out.
 *
 * ⚠️ A Map rather than a Set, and "at" rather than "this session", because the bar is TIME-BOUNDED
 * — see HASH_BAR_MS. This was first written as a permanent, session-scoped bar, justified by the
 * claim that no guard's verdict can change within a session. That sentence is false on any session
 * measured in hours, which on Desktop is all of them (§5.3, no foreground gate): a kicked group can
 * be rejoined, a destroyed one replaced, a dirty config settle. Re-examining a guard costs no
 * network call, so a permanent bar buys nothing and silently withdraws the device.
 */
const hashSettledAt = new Map<string, number>();
const missingHashesByPubkey = new Map<string, Set<string>>();
const recoveryAttemptsBySwarm = new Map<
  string,
  { consecutiveFailures: number; lastAttemptAt: number }
>();

/**
 * §5.5 — recovery attempts for one swarm are RATE-LIMITED, deliberately not capped.
 *
 * Releasing a failed attempt for retry and bounding the retries are a pair; either alone is wrong.
 * Without the release, a partial failure is banked as done and never repaired. Without the bound, a
 * persistently-failing store is retried on every poll — every few seconds — which is the re-push
 * storm this design exists to avoid.
 *
 * ⚠️ Why a backoff and NOT a "give up after N rounds" cap, which is what this was first written as:
 * a cap re-creates the very exclusion §5.5 was corrected to remove, one layer up. Three transient
 * network failures would withdraw the device for the rest of the session — and a Desktop session can
 * be days — while intermittent connectivity correlates with having been offline long enough for the
 * config to expire in the first place. So the cap would exclude exactly the population the feature
 * exists for (spec §4.4a). A backoff bounds the RATE without ever excluding anyone.
 *
 * Note the real request count is NOT one per attempt: `sendEncryptedDataToSnode` wraps each send in
 * pRetry with `retries: 2`, so the worst case is 3 attempts x (parts + 1 delete) per entry below.
 * That wrapper lives in MessageSender, a long way from here, and is easy not to know about.
 */
/**
 * Read the clock through an indirection so the backoff is testable without faking global timers —
 * freezing Date breaks mocha's own timeout accounting. Mirrors the `getNow` argument the store
 * sub-requests already take. Local scheduling only, so Date.now is correct here rather than
 * NetworkTime: nothing is compared against a value that came from the network.
 */
let nowMs: () => number = () => Date.now();

/**
 * §5.5 — how long a successfully re-stored hash is barred from being re-stored again.
 *
 * ⚠️ NOT "for the session". A session is unbounded in time and the config TTL is 30 days, so on
 * Desktop — which per §5.3 has no foreground gate and runs for weeks by design — a session-scoped
 * bar can outlive the TTL. The hash would then expire from the swarm a second time and the bar
 * would block the very recovery that should put it back, on exactly the long-lived sessions where
 * configs expire. §4.4a again.
 *
 * One hour, standardised across the three clients. The figure is NOT load-bearing — the property
 * is "hours" — so don't tune it as though something depends on it. It errs short because the two
 * failure modes are asymmetric: too long re-creates the defect this bound exists to fix, while too
 * short costs a byte-identical, idempotent re-store that changes nothing. When one side costs
 * correctness and the other costs a redundant request, err toward the request.
 */
const HASH_BAR_MS = 1 * DURATION.HOURS;

const RECOVERY_BACKOFF_BASE_MS = 60 * DURATION.SECONDS;
const RECOVERY_BACKOFF_CEILING_MS = 30 * DURATION.MINUTES;

/**
 * How long to wait before the next recovery round for a swarm, given consecutive FAILED rounds.
 * 60s doubling, ceilinged at 30 minutes, reset to zero by any successful store (spec §5.4).
 *
 * ⚠️ The ceiling bounds the INTERVAL, never the NUMBER OF ATTEMPTS. This must not become a
 * consecutive-failure cap: that is the §4.4a shape this feature has already produced twice, and it
 * would exclude exactly the swarms most in need of repair. A permanently failing swarm keeps being
 * retried, just rarely — ~48 rounds a day rather than ~1,440.
 *
 * Growth matters more here than on mobile: per §5.3 Desktop has no foreground gate, so a "session"
 * is however long the app stays open, which is days rather than minutes.
 */
function backoffMsFor(consecutiveFailures: number) {
  if (consecutiveFailures <= 0) {
    return 0;
  }
  return Math.min(
    RECOVERY_BACKOFF_BASE_MS * 2 ** (consecutiveFailures - 1),
    RECOVERY_BACKOFF_CEILING_MS
  );
}

/**
 * Guard §4.1 — our local state must be level with the swarm before anything may be re-stored.
 * That stops a long-offline device putting back state that has since been deliberately changed:
 * the dangerous ordering is re-storing while the swarm still holds config we haven't merged.
 *
 * A successful poll makes us level in one of two ways, and BOTH count:
 *
 * - it returned config messages and we merged them; or
 * - it returned no config messages at all, so there is nothing on the swarm we haven't already
 *   incorporated.
 *
 * The second one is not a technicality — it is the case this whole feature exists for. A device
 * whose config has expired gets *nothing* back, so a guard that waits for a merge would never fire
 * for exactly the devices being repaired, and would do it silently: detection runs, the guard
 * declines, no error, no failing test. Requiring a merge is why this function is not called
 * `markSwarmMerged`.
 *
 * A failed or errored poll counts for neither.
 */
function markLocalStateLevelWithSwarm(pubkey: string) {
  if (swarmsWithIncompleteMerge.has(pubkey)) {
    // withdrawn for the session — see markMergeIncompleteForSwarm
    return;
  }
  swarmsLevelWithLocalState.add(pubkey);
}

/**
 * Withdraw a swarm for the rest of the session, because we fetched config we could not take in.
 *
 * This has to be STICKY, and the reason is not obvious. The lastHash cursor advances when a message
 * is *fetched*, inside pollNodeForKey, before the merge is even attempted. So a message we failed to
 * merge sits behind the cursor and the swarm never sends it again — which means the very next poll
 * returns nothing, looks perfectly clean, and would re-authorise recovery over state we know we
 * never incorporated. The failure doesn't just go unreported, it becomes unreachable: after that
 * second poll there is no error, no log and no state anywhere recording that anything was missed.
 *
 * A per-poll check alone is therefore cosmetic. Note the fix is NOT to advance the cursor only on a
 * successful merge — that would re-fetch a permanently unmergeable message forever. Recovery is a
 * best-effort repair, so deferring it to the next app start costs almost nothing, where acting on a
 * view we know to be incomplete is the thing guard §4.1 exists to prevent.
 *
 * ⚠️ Known correlated exclusion — recorded in spec §4.1, found via the §4.4a lens. "Deferred to the
 * next app start" is only true for a
 * TRANSIENT merge failure. If a config message on the swarm is *permanently* unmergeable — corrupt,
 * or written by a client newer than we can parse — then every session fetches it, fails, and
 * withdraws this swarm again, so recovery never runs on that device for that swarm. Ever. And a
 * device holding an unmergeable config is plausibly one whose state needs repairing.
 *
 * Kept anyway, because the alternative is re-storing over state we know we could not read, which is
 * worse than not repairing. Named here so nobody later re-derives it as harmless.
 */
function markMergeIncompleteForSwarm(pubkey: string) {
  swarmsWithIncompleteMerge.add(pubkey);
  swarmsLevelWithLocalState.delete(pubkey);
}

function localStateIsLevelWithSwarm(pubkey: string) {
  return swarmsLevelWithLocalState.has(pubkey);
}

/**
 * Detection runs on every poll, including ones we won't act on. Recording it separately from
 * acting on it is what lets §4.1 hold without throwing the detection away.
 */
function recordDetection(pubkey: string, detection: ConfigExpiryDetection) {
  if (detection.status !== 'conclusive') {
    // 'unavailable' and 'inconclusive' are not evidence of anything.
    return;
  }

  if (!detection.missingHashes.length) {
    // Deliberately NOT clearing what earlier polls recorded. A hash that was successfully re-stored
    // is already filtered out by hashSettledAt, and one whose store FAILED is exactly
    // the thing we want a later poll to retry — bounded by MAX_RECOVERY_ROUNDS_PER_SWARM rather
    // than by forgetting it. So a clearing step could only ever destroy findings, including on a
    // wrongly-conclusive result, without ever preventing a redundant re-store.
    return;
  }

  const known = missingHashesByPubkey.get(pubkey) ?? new Set<string>();
  detection.missingHashes.forEach(hash => known.add(hash));
  missingHashesByPubkey.set(pubkey, known);
}

/**
 * Drop bars that have expired, rather than merely reading past them.
 *
 * The read below already ignores an expired entry, so omitting this looks correct and leaks for the
 * life of the process instead. And the population it leaks against is long-lived sessions — which
 * is exactly the population the time-bound was added for, so the leak would target the same people
 * as the defect it fixes.
 */
function pruneExpiredBars() {
  const now = nowMs();
  hashSettledAt.forEach((settledAt, hash) => {
    if (now - settledAt >= HASH_BAR_MS) {
      hashSettledAt.delete(hash);
    }
  });
}

function getMissingHashes(pubkey: string) {
  return [...(missingHashesByPubkey.get(pubkey) ?? [])];
}

/**
 * Which of our user configs need putting back, given the hashes reported missing.
 *
 * Applies guard §4.2 (clean only) and §4.3 (current hashes only — `activeHashes()` *is* the set of
 * hashes the device believes are current, so a hash that has since been superseded simply isn't in
 * it any more).
 */
async function userVariantsNeedingRestore(missingHashes: Array<string>) {
  const needingRestore: Array<ConfigWrapperUser> = [];
  // the missing hashes a restorable variant actually claims. Anything left over was ruled out by a
  // guard rather than merely un-attempted, which is a different outcome — see recoverIfNeeded.
  const coveredHashes = new Set<string>();
  // an inspection that THREW is not a guard rejection; that variant stays retryable
  let inspectedEverything = true;

  for (let index = 0; index < LibSessionUtil.requiredUserVariants.length; index++) {
    const variant = LibSessionUtil.requiredUserVariants[index];

    try {
      // §4.2: recovery re-uploads existing state, it never creates new state. A config with
      // pending changes will be pushed by the UserSyncJob anyway, which supersedes this.
      if (await UserGenericWrapperActions.needsPush(variant)) {
        continue;
      }

      const activeHashes = await UserGenericWrapperActions.activeHashes(variant);

      const claimed = activeHashes.filter(hash => missingHashes.includes(hash));
      if (claimed.length) {
        needingRestore.push(variant);
        claimed.forEach(hash => coveredHashes.add(hash));
      }
    } catch (e) {
      inspectedEverything = false;
      window.log.warn(
        `ConfigRecovery: could not inspect user variant ${variant}: ${e.message}. Skipping it.`
      );
    }
  }

  return { needingRestore, coveredHashes, inspectedEverything };
}

/**
 * @returns `stored` — every part of every config landed, which is what §5.5 bars a hash on (§3.4:
 * a multipart config counts as stored only when all its parts do).
 * @returns `anyPartLanded` — at least one store sub-request came back 200. Deliberately separate:
 * a multipart config that repeatedly half-lands is making PROGRESS, not failing, because the parts
 * that stored are barred and the next round is strictly smaller. Backing off there would penalise a
 * swarm for converging, on a swarm we can demonstrably reach.
 */
async function restoreUserConfigs(
  variants: Array<ConfigWrapperUser>
): Promise<{ stored: boolean; anyPartLanded: boolean }> {
  const us = UserUtils.getOurPubKeyStrFromCache() as PubkeyType;

  /** one entry per config we are putting back, so success can be attributed per config */
  const restores: Array<{
    variant: ConfigWrapperUser;
    stores: Array<StoreUserConfigSubRequest>;
    obsoleteHashes: Array<string>;
    activeHashes: Array<string>;
  }> = [];

  for (let index = 0; index < variants.length; index++) {
    const variant = variants[index];
    const { data, hashes, namespace } = await UserGenericWrapperActions.push(variant);

    restores.push({
      variant,
      // §3.4: every part of a multipart config goes back, not just the parts reported missing. The
      // present ones re-encrypt to the same bytes, so they cost a no-op TTL refresh — and
      // `activeHashes()` is unordered, so a part hash can't be mapped to its index here anyway.
      stores: data.map(
        ciphertext =>
          new StoreUserConfigSubRequest({
            encryptedData: ciphertext,
            namespace,
            ttlMs: TTL_DEFAULT.CONFIG_MESSAGE,
            getNow: NetworkTime.now,
          })
      ),
      // §5.1: push() drains the config's obsolete-hash list and clears it unconditionally, so this
      // is the only time we will ever see these. Held per-config rather than pooled, because the
      // delete must only cover configs whose stores actually landed.
      obsoleteHashes: hashes,
      activeHashes: await UserGenericWrapperActions.activeHashes(variant),
    });
  }

  const allStores = restores.flatMap(r => r.stores);
  if (!allStores.length) {
    return { stored: false, anyPartLanded: false };
  }

  // The batch endpoint takes at most MAX_SUBREQUESTS_COUNT sub-requests INCLUSIVE, and an oversized
  // one is rejected outright — a parse_error against the whole batch. (Our own helper throws before
  // sending, which is worse for being silent: the throw lands in recoverIfNeeded's catch and an
  // affected account simply never recovers.)
  //
  // So split across batches rather than dropping anything. §3.4 governs when a multipart config
  // COUNTS AS STORED, not which transport its parts travel in. Skipping instead would make a config
  // over ~1.5MB permanently unrecoverable.
  const landed = new Map<StoreUserConfigSubRequest, boolean>();

  const sendBatch = async (batch: Array<SnodeSubRequestForRecovery>) => {
    const controller = new AbortController();
    const result = await timeoutWithAbort(
      MessageSender.sendEncryptedDataToSnode({
        sortedSubRequests: batch,
        destination: us,
        method: 'sequence',
        abortSignal: controller.signal,
        allow401s: false,
      }),
      30 * DURATION.SECONDS,
      controller
    );

    if (!result || result.length !== batch.length) {
      window.log.warn(
        `ConfigRecovery: unexpected result length for ${ed25519Str(us)}: expected ${batch.length} but got ${result?.length}`
      );
      return false;
    }

    // A batch reports PER SUB-REQUEST, so the right number of results says nothing about whether
    // they succeeded — reading the length alone would take a partial store for a complete one.
    batch.forEach((request, i) => {
      if (request instanceof StoreUserConfigSubRequest) {
        landed.set(request, result[i].code === 200);
      }
    });

    return result.every(m => m.code === 200);
  };

  const storeBatches = chunk(allStores, MAX_SUBREQUESTS_COUNT);
  window.log.info(
    `ConfigRecovery: re-storing ${allStores.length} config message(s) for ${ed25519Str(us)} in ${storeBatches.length} batch(es) (variants: ${variants.join(', ')})`
  );

  for (let i = 0; i < storeBatches.length; i++) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await sendBatch(storeBatches[i]);
    if (!ok) {
      break; // later batches are pointless, and the delete below is now narrower
    }
  }

  const fullyLanded = restores.filter(r => r.stores.every(store => landed.get(store) === true));
  const anyPartLanded = [...landed.values()].some(Boolean);

  // §5.1, as amended: the delete covers only the configs that FULLY landed. An obsolete hash whose
  // replacement did not store is the swarm's only older copy of that config — deleting it would
  // leave a seed restore in that window with nothing rather than something stale. And in the case
  // §5.1 was actually written for the delete is a no-op anyway: an obsolete hash is never
  // TTL-extended (active_hashes() covers _curr_hashes only), so if the CURRENT hash lived long
  // enough to expire, its predecessor necessarily expired before it.
  const deletableHashes = fullyLanded.flatMap(r => r.obsoleteHashes);

  if (deletableHashes.length) {
    // eslint-disable-next-line no-await-in-loop
    await sendBatch([
      new DeleteHashesFromUserNodeSubRequest({ messagesHashes: [...new Set(deletableHashes)] }),
    ]);
  }

  fullyLanded.forEach(r => r.activeHashes.forEach(hash => hashSettledAt.set(hash, nowMs())));

  if (fullyLanded.length) {
    // push() mutated the wrappers (it drained their obsolete hashes), so that has to reach disk.
    await LibSessionUtil.saveDumpsToDb(us);
  }

  return { stored: fullyLanded.length === restores.length, anyPartLanded };
}

/**
 * Act on whatever detection has recorded for this swarm. Safe to call on every poll — the guards
 * below are what make it a no-op almost every time.
 *
 * Note on §5.3 ("foreground only"): that rule exists because on mobile the largest recovery
 * coincides with a constrained background execution window. Desktop has no such window — the
 * process is either running and polling or not running at all — so there is nothing here to
 * defer to. Gating on window focus would only stop a minimised client from repairing itself.
 */
async function recoverIfNeeded(pubkey: string) {
  try {
    if (!UserUtils.isUsFromCache(pubkey)) {
      // group configs are detected but not recoverable on Desktop yet — see the note at the top.
      return false;
    }

    // §4.1
    if (!localStateIsLevelWithSwarm(pubkey)) {
      return false;
    }

    const missingHashes = getMissingHashes(pubkey).filter(
      // §5.5 — barred for a bounded interval rather than for the session
      hash => {
        const settledAt = hashSettledAt.get(hash);
        return settledAt === undefined || nowMs() - settledAt >= HASH_BAR_MS;
      }
    );

    pruneExpiredBars();

    if (isEmpty(missingHashes)) {
      return false;
    }

    const { needingRestore, coveredHashes, inspectedEverything } =
      await userVariantsNeedingRestore(missingHashes);

    // "not stored" is three outcomes, not two. A hash no restorable config claims was ruled out by a
    // guard — not active any more, or belonging to a dirty config that will be pushed under a new
    // hash anyway — so it is SETTLED rather than retryable. Folding these into "failed" costs no
    // requests, because the rejection happens before any network call, which is exactly why it does
    // not look like a problem: what it actually does is re-examine and re-log the same detection on
    // every poll, forever.
    // Settled here means barred for HASH_BAR_MS, NOT for the session — a guard's verdict CAN change
    // over hours (v66), so the bar buys quiet without withdrawing the hash permanently.
    // An inspection that THREW is not a guard verdict, so nothing is settled on that pass.
    if (inspectedEverything) {
      missingHashes
        .filter(hash => !coveredHashes.has(hash))
        .forEach(hash => hashSettledAt.set(hash, nowMs()));
    }

    if (!needingRestore.length) {
      // nothing attemptable, so no network call and no backoff slot consumed
      return false;
    }

    // §5.5 — the other half of releasing a failed attempt. A store that keeps failing leaves its
    // hashes unmarked so the next poll retries, which is correct; unbounded, that retry is every few
    // seconds forever. Rate-limited rather than capped, so a device with flaky connectivity keeps
    // getting chances instead of being written off for the session.
    const previous = recoveryAttemptsBySwarm.get(pubkey);
    const consecutiveFailures = previous?.consecutiveFailures ?? 0;
    if (previous && nowMs() - previous.lastAttemptAt < backoffMsFor(consecutiveFailures)) {
      return false;
    }

    const { stored, anyPartLanded } = await restoreUserConfigs(needingRestore);

    // §5.4 — reset on PROGRESS, not on completion. Gated on its own value rather than reusing the
    // one that bars hashes: those answer different questions, and letting a single boolean serve
    // both is how this ended up backing off against a swarm that was converging.
    recoveryAttemptsBySwarm.set(pubkey, {
      consecutiveFailures: anyPartLanded ? 0 : consecutiveFailures + 1,
      lastAttemptAt: nowMs(),
    });

    return stored;
  } catch (e) {
    window.log.warn(`ConfigRecovery: recoverIfNeeded for ${ed25519Str(pubkey)} failed:`, e.message);
    return false;
  }
}

/**
 * Exported for tests only — the sets above are process-lifetime state by design.
 */
function setNowForTesting(fn: () => number) {
  nowMs = fn;
}

function resetForTesting() {
  nowMs = () => Date.now();
  swarmsLevelWithLocalState.clear();
  swarmsWithIncompleteMerge.clear();
  recoveryAttemptsBySwarm.clear();
  hashSettledAt.clear();
  missingHashesByPubkey.clear();
}

/** exported for tests only — the leak this guards is otherwise unobservable from outside */
function barredHashCountForTesting() {
  return hashSettledAt.size;
}

export const ConfigRecovery = {
  barredHashCountForTesting,
  markLocalStateLevelWithSwarm,
  setNowForTesting,
  markMergeIncompleteForSwarm,
  localStateIsLevelWithSwarm,
  recordDetection,
  getMissingHashes,
  recoverIfNeeded,
  resetForTesting,
};
