/* eslint-disable no-await-in-loop */
import AbortController from 'abort-controller';
import { GroupPubkeyType, PubkeyType } from 'libsession_util_nodejs';
import { chunk, isEmpty } from 'lodash';
import { UserUtils } from '../../utils';
import type { ConfigWrapperUser } from '../../../webworker/workers/browser/libsession_worker_functions';
import {
  MetaGroupWrapperActions,
  UserGenericWrapperActions,
  UserGroupsWrapperActions,
} from '../../../webworker/workers/browser/libsession_worker_interface';
import { LibSessionUtil } from '../../utils/libsession/libsession_utils';
import { DURATION, TTL_DEFAULT } from '../../constants';
import { NetworkTime } from '../../../util/NetworkTime';
import { MessageSender } from '../../sending/MessageSender';
import { timeoutWithAbort } from '../../utils/Promise';
import {
  DeleteHashesFromGroupNodeSubRequest,
  DeleteHashesFromUserNodeSubRequest,
  MAX_SUBREQUESTS_COUNT,
  StoreGroupInfoSubRequest,
  StoreGroupKeysSubRequest,
  StoreGroupMembersSubRequest,
  StoreUserConfigSubRequest,
} from './SnodeRequestTypes';
import { ConfigExpiryDetection } from './configExpiryDetection';
import { ed25519Str, fromBase64ToArray } from '../../utils/String';
import { PubKey } from '../../types';
import { ConvoHub } from '../../conversations';
import { SnodePool } from './snodePool';
import { SnodeAPIRetrieve } from './retrieveRequest';
import { SnodeNamespaces } from './namespaces';

type SnodeSubRequestForRecovery = StoreUserConfigSubRequest | DeleteHashesFromUserNodeSubRequest;

type StoreGroupConfigSubRequestForRecovery =
  | StoreGroupInfoSubRequest
  | StoreGroupMembersSubRequest
  | StoreGroupKeysSubRequest;
type GroupSubRequestForRecovery =
  | StoreGroupConfigSubRequestForRecovery
  | DeleteHashesFromGroupNodeSubRequest;

/**
 * An ACCOUNT pubkey — our own (`05…`) or a group's (`03…`). Never a snode's ed25519 key.
 *
 * Spelled out because everything here is "per swarm", and a swarm is identified by the account
 * whose swarm it is; a bare `string` left a reader working that out from the call sites.
 */
type AccountPubkey = PubkeyType | GroupPubkeyType;

/**
 * Putting a config message back on the swarm after it expired from it.
 *
 * The whole thing rests on config encryption being deterministic: re-storing an *unchanged* config
 * produces the identical message hash it had before, so this is the same message going back where
 * it was, not a new one competing with existing state. Which is why nothing here is allowed to
 * dirty a config to force an upload — that would bump the seqno and trigger a merge, and turn a
 * repair into the destructive thing this design exists to avoid.
 *
 * Both our own configs and a group's are recovered here. The two differ only in how a config is
 * inspected and put back, so the guards and the bookkeeping are shared and the split happens as
 * late as possible.
 *
 * Three things about the group path are easy to mistake for bugs:
 *   - `GroupKeys` is recoverable ONLY from retained bytes. A keys message is admin-signed and its
 *     padding derives from the group secret key, so nobody can regenerate one — but bytes already
 *     held push back verbatim and land on the same hash, which is what lets a MEMBER repair a
 *     group's keys. Where no bytes are held it is unrecoverable BY THIS DEVICE and settles; another
 *     peer holding them can still put them back.
 *   - a MEMBER gets an empty obsolete-hash list. `push()` hands the superseded hashes back only
 *     `if (!is_readonly())` while clearing them either way (`base.cpp:809-813`), so empty is the
 *     expected result rather than a sign anything failed.
 *   - a member could not act on a non-empty list anyway: its subaccount token carries Read+Write
 *     but not Delete. Member-driven recovery re-stores and never prunes; the superseded messages
 *     wait for an admin's next push.
 */

/**
 * None of this state is persisted, deliberately rather than merely unimplemented: the level-with-swarm rule asks
 * what has happened since this process started, so a verdict reloaded from disk would be answering
 * that question about a previous run.
 *
 * The scoping is NOT uniform across these declarations, though it reads as if it should be and it
 * once was — the two Sets below are session-scoped, `hashSettledAt` is time-bounded.
 *
 * SESSION-SCOPED HERE MEANS PROCESS-LIFETIME, WHICH ON DESKTOP IS WEEKS. Nothing ages these Sets
 * out: `swarmsLevelWithLocalState` is added to on the first good poll of the process and removed
 * only by the sticky merge-incomplete withdrawal. So `localStateIsLevelWithSwarm` answers "was
 * level at SOME POINT since startup", never "is level now", and the staleness it permits is
 * unbounded.
 *
 * That is correct for what reads it today: recovery is a cheap, idempotent re-store, so acting on
 * a stale verdict costs a redundant request. It is NOT correct for anything irreversible or
 * externally visible — a force-rekey encrypts to THIS DEVICE'S view of the members, so a stale
 * "level" verdict authorises a write from a members list we already know may be behind, and
 * silently drops anyone added since. That fails OPEN.
 *
 * Before reading either Set, check its lifetime against what YOU are about to do with it rather
 * than against what its existing caller does. `hashSettledAt` was made time-bounded for exactly
 * this reason and the same reasoning was never applied one declaration up.
 */
/**
 * pubkey -> the poll token that was current when we last marked this swarm level.
 *
 * A Map rather than a Set because two different consumers ask two different questions of it, and
 * one field answers both:
 *
 *   has(pubkey)                  "were we EVER level this session"  — recovery's precondition
 *   stored === current token     "are we level AS OF THIS POLL"     — the force rekey's
 *
 * Recovery is a cheap idempotent re-store, so acting on a stale verdict costs a redundant request
 * and the sticky question is right for it. A rekey encrypts to this device's view of the members
 * and cannot be undone, so it needs the poll-scoped one. Same value, two readings — deliberately
 * NOT two fields, or they would drift.
 */
const swarmsLevelWithLocalState = new Map<AccountPubkey, number>();
/**
 * pubkey -> a token that changes every time a poll begins for that swarm.
 *
 * Per swarm, not global: a poll of some other pubkey must not invalidate this one's mark.
 */
const currentPollToken = new Map<AccountPubkey, number>();
const swarmsWithIncompleteMerge = new Set<AccountPubkey>();
/**
 * hash -> when it was settled, for either of two reasons that must not be conflated with a FAILED
 * store, which stays retryable:
 *   - it was stored successfully; or
 *   - a guard ruled it out.
 *
 * A Map rather than a Set, and "at" rather than "this session", because the bar is TIME-BOUNDED
 * — see HASH_BAR_MS. This was first written as a permanent, session-scoped bar, justified by the
 * claim that no guard's verdict can change within a session. That sentence is false on any session
 * measured in hours, which on Desktop is all of them (there is no foreground gate): a kicked group can
 * be rejoined, a destroyed one replaced, a dirty config settle. Re-examining a guard costs no
 * network call, so a permanent bar buys nothing and silently withdraws the device.
 */
const hashSettledAt = new Map<string, number>();
const missingHashesByPubkey = new Map<AccountPubkey, Set<string>>();
/**
 * Swarms with a recovery round currently running — see the guard at the top of recoverIfNeeded.
 *
 * Holds the round's promise rather than just a marker, so a caller that wants to know when the
 * round finishes can await it. Nothing in production does (the poller deliberately does not wait),
 * but it is what lets a test assert on the outcome of an unawaited round without sleeping.
 */
const recoveryInFlight = new Map<AccountPubkey, Promise<boolean>>();
/**
 * Groups where a keys backfill has run and the bytes are STILL absent.
 *
 * In memory on purpose. A persisted record would be a sticky negative — it would let the rekey fire
 * on evidence gathered weeks ago, after the swarm has changed underneath it. Forgetting on restart
 * delays the rekey by one poll cycle, which is the safe direction for the one irreversible,
 * externally visible write in this feature.
 */
const keysBackfillFailedAt = new Map<GroupPubkeyType, number>();
const recoveryAttemptsBySwarm = new Map<
  AccountPubkey,
  { consecutiveFailures: number; lastAttemptAt: number }
>();

/**
 * Recovery attempts for one swarm are RATE-LIMITED, deliberately not capped.
 *
 * Releasing a failed attempt for retry and bounding the retries are a pair; either alone is wrong.
 * Without the release, a partial failure is banked as done and never repaired. Without the bound, a
 * persistently-failing store is retried on every poll — every few seconds — which is the re-push
 * storm this design exists to avoid.
 *
 * Why a backoff and NOT a "give up after N rounds" cap, which is what this was first written as:
 * a cap re-creates the very exclusion the rate limit was corrected to remove, one layer up. Three transient
 * network failures would withdraw the device for the rest of the session — and a Desktop session can
 * be days — while intermittent connectivity correlates with having been offline long enough for the
 * config to expire in the first place. So the cap would exclude exactly the population the feature
 * exists for. A backoff bounds the RATE without ever excluding anyone.
 *
 * That test — WHICH POPULATION DOES THIS EXCLUDE, AND DOES IT CORRELATE WITH NEEDING THE REPAIR? —
 * is worth applying to any bound added here. It has caught this same mistake twice.
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
 * How long a successfully re-stored hash is barred from being re-stored again.
 *
 * NOT "for the session". A session is unbounded in time and the config TTL is 30 days, so on
 * Desktop — which has no foreground gate and runs for weeks by design — a session-scoped
 * bar can outlive the TTL. The hash would then expire from the swarm a second time and the bar
 * would block the very recovery that should put it back, on exactly the long-lived sessions where
 * configs expire: the bound would exclude exactly the population it exists to serve.
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
 * 60s doubling, ceilinged at 30 minutes, reset to zero by any successful store.
 *
 * The ceiling bounds the INTERVAL, never the NUMBER OF ATTEMPTS. This must not become a
 * consecutive-failure cap: that is the exclusion shape this feature has already produced twice, and it
 * would exclude exactly the swarms most in need of repair. A permanently failing swarm keeps being
 * retried, just rarely — ~48 rounds a day rather than ~1,440.
 *
 * Growth matters more here than on mobile: Desktop has no foreground gate, so a "session"
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
 * Our local state must be level with the swarm before anything may be re-stored.
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
/**
 * Called when a poll STARTS for this swarm. Everything marked level before now becomes stale for
 * any consumer asking the poll-scoped question.
 */
function beginPollForSwarm(pubkey: AccountPubkey) {
  currentPollToken.set(pubkey, (currentPollToken.get(pubkey) ?? 0) + 1);
}

function markLocalStateLevelWithSwarm(pubkey: AccountPubkey) {
  if (swarmsWithIncompleteMerge.has(pubkey)) {
    // withdrawn for the session — see markMergeIncompleteForSwarm
    return;
  }
  swarmsLevelWithLocalState.set(pubkey, currentPollToken.get(pubkey) ?? 0);
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
 * view we know to be incomplete is the thing this precondition exists to prevent.
 *
 * Known correlated exclusion, found by asking which population this excludes. "Deferred to the
 * next app start" is only true for a
 * TRANSIENT merge failure. If a config message on the swarm is *permanently* unmergeable — corrupt,
 * or written by a client newer than we can parse — then every session fetches it, fails, and
 * withdraws this swarm again, so recovery never runs on that device for that swarm. Ever. And a
 * device holding an unmergeable config is plausibly one whose state needs repairing.
 *
 * Kept anyway, because the alternative is re-storing over state we know we could not read, which is
 * worse than not repairing. Named here so nobody later re-derives it as harmless.
 */
function markMergeIncompleteForSwarm(pubkey: AccountPubkey) {
  swarmsWithIncompleteMerge.add(pubkey);
  swarmsLevelWithLocalState.delete(pubkey);
}

function localStateIsLevelWithSwarm(pubkey: AccountPubkey) {
  return swarmsLevelWithLocalState.has(pubkey);
}

/**
 * Were we level as of the poll currently running for this swarm — not merely at some point since
 * the process started?
 *
 * Fails CLOSED. A swarm we have never polled, never marked, or withdrawn answers false, because
 * the only consumer is an irreversible write and "we do not know" must not read as "yes".
 */
function localStateIsLevelAsOfCurrentPoll(pubkey: AccountPubkey) {
  const markedAt = swarmsLevelWithLocalState.get(pubkey);
  const current = currentPollToken.get(pubkey);

  return markedAt !== undefined && current !== undefined && markedAt === current;
}

/**
 * Detection runs on every poll, including ones we won't act on. Recording it separately from
 * acting on it is what lets the precondition hold without throwing the detection away.
 */
function recordDetection(pubkey: AccountPubkey, detection: ConfigExpiryDetection) {
  if (detection.status !== 'conclusive') {
    // 'unavailable' and 'inconclusive' are not evidence of anything.
    return;
  }

  if (!detection.missingHashes.length) {
    // Deliberately NOT clearing what earlier polls recorded. A hash whose store FAILED is exactly
    // the thing we want a later poll to retry, and forgetting it is not how that retry is bounded —
    // the backoff is. So a clearing step here could only destroy findings, including on a
    // wrongly-conclusive result, without ever preventing a redundant re-store. Hashes are dropped
    // once SETTLED instead — see pruneSettledDetections.
    return;
  }

  const known = missingHashesByPubkey.get(pubkey) ?? new Set<string>();
  detection.missingHashes.forEach(hash => known.add(hash));
  missingHashesByPubkey.set(pubkey, known);
}

/**
 * Drop detections we have finished with, so the accumulator cannot grow for the life of the process.
 *
 * Same leak `pruneExpiredBars` was written for, one map over and against the same population: hashes
 * rotate on every re-push, and a Desktop session runs for days by design, so every superseded hash
 * would otherwise be retained forever.
 *
 * Only settled hashes are dropped. A hash still awaiting a retry must stay, or the retry never
 * happens — this prunes what is done with, never what is outstanding.
 */
function pruneSettledDetections(pubkey: AccountPubkey) {
  const known = missingHashesByPubkey.get(pubkey);
  if (!known) {
    return;
  }
  known.forEach(hash => {
    if (hashSettledAt.has(hash)) {
      known.delete(hash);
    }
  });
  if (!known.size) {
    missingHashesByPubkey.delete(pubkey);
  }
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

function getMissingHashes(pubkey: AccountPubkey) {
  return [...(missingHashesByPubkey.get(pubkey) ?? [])];
}

/**
 * Which of our user configs need putting back, given the hashes reported missing.
 *
 * Applies two guards: clean configs only, and current hashes only (`activeHashes()` *is* the set of
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
      // Clean only: recovery re-uploads existing state, it never creates new state. A config with
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
 * @returns `stored` — every part of every config landed, which is what bars a hash from retry (
 * a multipart config counts as stored only when all its parts do).
 * @returns `progressed` — at least one config landed IN FULL, so its hashes are now barred and the
 * next round is strictly smaller. Deliberately separate from `stored`: a swarm where one of several
 * configs succeeded is converging, and backing off would penalise it for that.
 *
 * `progressed` must mean "a hash became BARRED", never "some sub-request returned 200". Every part
 * of a multipart config goes back on every attempt, so a config whose parts half-land sends the
 * IDENTICAL request next round; if that counted as progress, one part that always succeeds beside
 * one that always fails would reset the failure counter forever — nothing barred, `backoffMsFor(0)`
 * is 0, a full re-send on every poll. Measured at 10 rounds / 10 sends / 0 barred. Only a hash
 * becoming barred makes the next round smaller, so only that is progress.
 */
async function restoreUserConfigs(
  variants: Array<ConfigWrapperUser>
): Promise<{ stored: boolean; progressed: boolean }> {
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
      // Every part of a multipart config goes back, not just the parts reported missing. The
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
      // push() drains the config's obsolete-hash list and clears it unconditionally, so this
      // is the only time we will ever see these. Held per-config rather than pooled, because the
      // delete must only cover configs whose stores actually landed.
      obsoleteHashes: hashes,
      activeHashes: await UserGenericWrapperActions.activeHashes(variant),
    });
  }

  const allStores = restores.flatMap(r => r.stores);
  if (!allStores.length) {
    return { stored: false, progressed: false };
  }

  // The batch endpoint takes at most MAX_SUBREQUESTS_COUNT sub-requests INCLUSIVE, and an oversized
  // one is rejected outright — a parse_error against the whole batch. (Our own helper throws before
  // sending, which is worse for being silent: the throw lands in recoverIfNeeded's catch and an
  // affected account simply never recovers.)
  //
  // So split across batches rather than dropping anything. The all-parts rule governs when a config
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
  const progressed = fullyLanded.length > 0;

  // The delete covers only the configs that FULLY landed. An obsolete hash whose
  // replacement did not store is the swarm's only older copy of that config — deleting it would
  // leave a seed restore in that window with nothing rather than something stale. And in the case
  // the sweep was actually written for, the delete is a no-op anyway: an obsolete hash is never
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

  return { stored: fullyLanded.length === restores.length, progressed };
}

/** the group sub-configs recovery can put back */
type RestorableGroupConfig = 'groupInfo' | 'groupMember' | 'groupKeys';

/**
 * Which of a group's sub-configs claim one of the missing hashes.
 *
 * GroupKeys is restorable only if we RETAINED ITS BYTES. A keys message is admin-signed and padded
 * from the group secret key, so nobody can regenerate one — but bytes already held can be pushed
 * back verbatim and land on the same hash, which is what lets a MEMBER repair a group's keys rather
 * than only an admin. Where we hold no bytes (a message loaded before the wrapper retained them),
 * it is unrecoverable by this device and settles, exactly as before.
 */
async function groupConfigsNeedingRestore(groupPk: GroupPubkeyType, missingHashes: Array<string>) {
  const needingRestore: Array<RestorableGroupConfig> = [];
  const coveredHashes = new Set<string>();
  /** every keys hash gone AND we hold no bytes — the group is expired as far as this device goes */
  let keysUnrecoverableHere = false;

  try {
    const group = await UserGroupsWrapperActions.getGroup(groupPk);

    // We are no longer entitled to write to this swarm, and for a destroyed group there is
    // nothing to put back. Note both flags: `kicked` is false when the group was `destroyed`, so
    // checking one alone silently misses the other population.
    if (!group || group.kicked || group.destroyed) {
      return { needingRestore, coveredHashes, inspectedEverything: true, keysUnrecoverableHere };
    }

    // Clean configs only — but this gate does NOT apply to GroupKeys.
    //
    // The gate exists so local state cannot overwrite newer remote state. Keys recovery replays the
    // exact bytes the swarm already had — byte-identical, same hash — so it cannot overwrite
    // anything, and a pending rekey produces a NEW message at a NEW generation, which says nothing
    // about whether the retained ones are stale. Gating keys on a dirty groupInfo would be a
    // correlated exclusion: a group with pending changes is exactly a group in active use.
    const dirty = await MetaGroupWrapperActions.needsPush(groupPk);

    // Only hashes the wrapper still considers active. Per-config, because the answer differs
    // per config: `activeHashes()` merges all three and cannot tell a restorable groupInfo hash
    // from an unrestorable groupKeys one.
    const byConfig = await MetaGroupWrapperActions.activeHashesByConfig(groupPk);

    const missingKeysHashes = byConfig.groupKeys.filter(hash => missingHashes.includes(hash));

    // EVERY keys hash we asked about is gone. That — and only that — is what decides an expired
    // group: one surviving keys hash still lets a new device in, which is why a partial miss is not
    // expired.
    const allKeysMissing =
      byConfig.groupKeys.length > 0 && missingKeysHashes.length === byConfig.groupKeys.length;

    if (missingKeysHashes.length) {
      const retained = await MetaGroupWrapperActions.activeKeyMessages(groupPk);

      if (isEmpty(retained)) {
        // Unrecoverable BY THIS DEVICE rather than unrecoverable: another peer holding the bytes can
        // still put them back. Covered so it settles instead of being re-examined every poll.
        missingKeysHashes.forEach(hash => coveredHashes.add(hash));
        keysUnrecoverableHere = allKeysMissing;
        window.log.warn(
          `ConfigRecovery: ${missingKeysHashes.length} GroupKeys hash(es) missing for ${ed25519Str(groupPk)} and no retained bytes — cannot repair from here`
        );
      } else {
        needingRestore.push('groupKeys');
        missingKeysHashes.forEach(hash => coveredHashes.add(hash));
      }
    }

    if (!dirty) {
      (['groupInfo', 'groupMember'] as const).forEach(config => {
        const claimed = byConfig[config].filter(hash => missingHashes.includes(hash));
        if (claimed.length) {
          needingRestore.push(config);
          claimed.forEach(hash => coveredHashes.add(hash));
        }
      });
    }

    return { needingRestore, coveredHashes, inspectedEverything: true, keysUnrecoverableHere };
  } catch (e) {
    // as on the user path: a throw is not a guard verdict, so nothing settles on this pass
    window.log.warn(
      `ConfigRecovery: could not inspect group ${ed25519Str(groupPk)}: ${e.message}. Skipping it.`
    );
    return {
      needingRestore: [],
      coveredHashes,
      inspectedEverything: false,
      keysUnrecoverableHere: false,
    };
  }
}

/**
 * Put a group's clean `groupInfo`/`groupMember` configs back on its swarm.
 *
 * Returns the same pair as the user path — see `restoreUserConfigs` for what `stored` and
 * `progressed` mean and why they are separate.
 */
async function restoreGroupConfigs(
  groupPk: GroupPubkeyType,
  configs: Array<RestorableGroupConfig>
): Promise<{ stored: boolean; progressed: boolean }> {
  const group = await UserGroupsWrapperActions.getGroup(groupPk);
  if (!group) {
    return { stored: false, progressed: false };
  }

  const needsPushed = configs.some(c => c !== 'groupKeys');

  // `pushForRecovery` ignores needs_push() and hands back groupInfo and groupMember only. Keys are
  // NOT in it and cannot be: it re-serialises current state, and a keys message is admin-signed
  // with padding derived from the group secret key, so a member could not produce a valid one.
  //
  // It DRAINS the obsolete-hash list despite reading like a query, because it calls push()
  // underneath. So this is the only time we will see those hashes — and it is why it is only called
  // when a config that needs it is actually being restored.
  const pushed = needsPushed ? await MetaGroupWrapperActions.pushForRecovery(groupPk) : null;

  const byConfig = await MetaGroupWrapperActions.activeHashesByConfig(groupPk);

  // Keys come from retained BYTES rather than from a re-serialise — that is the whole mechanism.
  //
  // ALL retained messages go back, not only the ones reported missing. A generation is the full
  // rekey plus every supplemental issued against it, and a member who receives only part of a
  // generation does not get the key — so a partial re-store can leave the group unreadable for
  // someone. Re-storing everything is a superset of "every message of the affected generation",
  // which is what the rule requires; the extras are byte-identical no-op TTL refreshes.
  // (The accessor is keyed by hash and carries no generation, so grouping by generation is not
  // expressible here. Re-storing all of them is correct regardless of how they group.)
  const keyMessages = configs.includes('groupKeys')
    ? await MetaGroupWrapperActions.activeKeyMessages(groupPk)
    : {};

  const storeArgs = {
    groupPk,
    secretKey: group.secretKey,
    authData: group.authData,
    ttlMs: TTL_DEFAULT.CONFIG_MESSAGE,
    getNow: NetworkTime.now,
  };

  type GroupRestore = {
    config: RestorableGroupConfig;
    stores: Array<StoreGroupConfigSubRequestForRecovery>;
    obsoleteHashes: Array<string>;
    activeHashes: Array<string>;
  };

  const restores: Array<GroupRestore> = configs.map((config): GroupRestore => {
    if (config === 'groupKeys') {
      return {
        config,
        stores: Object.values(keyMessages).map(
          encryptedData => new StoreGroupKeysSubRequest({ ...storeArgs, encryptedData })
        ),
        // a keys message supersedes nothing, so there is never anything to prune here
        obsoleteHashes: [] as Array<string>,
        activeHashes: Object.keys(keyMessages),
      };
    }

    return {
      config,
      // Every part goes back again here, not just the parts reported missing.
      stores: (pushed?.[config].data ?? []).map(encryptedData =>
        config === 'groupInfo'
          ? new StoreGroupInfoSubRequest({ ...storeArgs, encryptedData })
          : new StoreGroupMembersSubRequest({ ...storeArgs, encryptedData })
      ),
      obsoleteHashes: pushed?.[config].hashes ?? [],
      activeHashes: byConfig[config],
    };
  });

  const allStores = restores.flatMap(r => r.stores);
  if (!allStores.length) {
    return { stored: false, progressed: false };
  }

  const landed = new Map<StoreGroupConfigSubRequestForRecovery, boolean>();

  const sendBatch = async (batch: Array<GroupSubRequestForRecovery>) => {
    const controller = new AbortController();
    const result = await timeoutWithAbort(
      MessageSender.sendEncryptedDataToSnode({
        sortedSubRequests: batch,
        destination: groupPk,
        method: 'sequence',
        abortSignal: controller.signal,
        allow401s: false,
      }),
      30 * DURATION.SECONDS,
      controller
    );

    if (!result || result.length !== batch.length) {
      window.log.warn(
        `ConfigRecovery: unexpected result length for ${ed25519Str(groupPk)}: expected ${batch.length} but got ${result?.length}`
      );
      return false;
    }

    batch.forEach((request, i) => {
      if (
        request instanceof StoreGroupInfoSubRequest ||
        request instanceof StoreGroupMembersSubRequest ||
        request instanceof StoreGroupKeysSubRequest
      ) {
        landed.set(request, result[i].code === 200);
      }
    });

    return result.every(m => m.code === 200);
  };

  const storeBatches = chunk(allStores, MAX_SUBREQUESTS_COUNT);
  window.log.info(
    `ConfigRecovery: re-storing ${allStores.length} config message(s) for group ${ed25519Str(groupPk)} in ${storeBatches.length} batch(es) (configs: ${configs.join(', ')})`
  );

  for (let i = 0; i < storeBatches.length; i++) {
    const ok = await sendBatch(storeBatches[i]);
    if (!ok) {
      break;
    }
  }

  const fullyLanded = restores.filter(r => r.stores.every(store => landed.get(store) === true));
  const progressed = fullyLanded.length > 0;

  // Same sweep rule as the user path, but note what it means for a MEMBER, because it looks like a
  // bug from either side:
  //   - push() hands the superseded hashes back only `if (!is_readonly())` while clearing them
  //     either way, so a member gets an EMPTY list. That is the expected result, not a failure.
  //   - a member could not act on a non-empty one anyway: its subaccount token carries Read+Write
  //     but NOT Delete, so the delete would 401.
  // Member-driven recovery therefore re-stores but never prunes; the superseded messages wait for
  // an admin's next push. Only attempt the delete when we hold the admin key.
  const adminSecretKey = group.secretKey?.length ? group.secretKey : null;
  const deletableHashes = adminSecretKey ? fullyLanded.flatMap(r => r.obsoleteHashes) : [];

  if (adminSecretKey && deletableHashes.length) {
    await sendBatch([
      new DeleteHashesFromGroupNodeSubRequest({
        messagesHashes: [...new Set(deletableHashes)],
        groupPk,
        secretKey: adminSecretKey,
      }),
    ]);
  }

  fullyLanded.forEach(r => r.activeHashes.forEach(hash => hashSettledAt.set(hash, nowMs())));

  // A landed keys re-store clears an existing expired flag EAGERLY rather than leaving it to the
  // poller's reactive clear. That path fires when config messages are received — but we just
  // re-stored messages we already hold, so we may never receive or re-handle them, and the flag
  // would stay set forever over keys that are back on the swarm.
  if (fullyLanded.some(r => r.config === 'groupKeys')) {
    try {
      const convo = ConvoHub.use().get(groupPk);
      if (convo?.getIsExpired03Group()) {
        window.log.info(
          `ConfigRecovery: keys restored for ${ed25519Str(groupPk)} — clearing its expired flag`
        );
        convo.setIsExpired03Group(false);
        await convo.commit();
      }
    } catch (e) {
      // best-effort: the repair itself succeeded, and the reactive path may still clear it
      window.log.warn(
        `ConfigRecovery: could not clear expired flag for ${ed25519Str(groupPk)}: ${e.message}`
      );
    }
  }

  if (fullyLanded.length) {
    // pushForRecovery mutated the wrapper (it drained the obsolete hashes), so that has to persist
    await LibSessionUtil.saveDumpsToDb(groupPk);
  }

  return { stored: fullyLanded.length === restores.length, progressed };
}

/**
 * Act on whatever detection has recorded for this swarm. Safe to call on every poll — the guards
 * below are what make it a no-op almost every time.
 *
 * Note on the "foreground only" rule the mobile clients follow: it exists because on mobile the largest recovery
 * coincides with a constrained background execution window. Desktop has no such window — the
 * process is either running and polling or not running at all — so there is nothing here to
 * defer to. Gating on window focus would only stop a minimised client from repairing itself.
 */
async function recoverIfNeeded(pubkey: AccountPubkey) {
  // The caller does not await us — see the note at the call site in swarmPolling — so a round can
  // still be in flight when the next poll comes round. A round that has not finished has not
  // settled its hashes yet, so without this the second poll re-reads the same missing hashes and
  // issues the same stores. Deterministic encryption makes those idempotent, so nothing corrupts;
  // what it costs is duplicate traffic and doubled batch pressure aimed at the one swarm we already
  // know is struggling.
  // Check-then-set with no await between them, so the two cannot interleave.
  if (recoveryInFlight.has(pubkey)) {
    return false;
  }
  const round = runRecoveryRound(pubkey);
  recoveryInFlight.set(pubkey, round);

  try {
    return await round;
  } finally {
    // `finally`, not the end of the try: runRecoveryRound catches its own errors, but an in-flight
    // entry that leaked on any path would withdraw the swarm permanently — the exclusion shape this
    // design has already produced twice.
    recoveryInFlight.delete(pubkey);
  }
}

async function runRecoveryRound(pubkey: AccountPubkey): Promise<boolean> {
  try {
    const isUs = UserUtils.isUsFromCache(pubkey);
    if (!isUs && !PubKey.is03Pubkey(pubkey)) {
      // neither our swarm nor a group's: nothing here knows how to recover it
      return false;
    }

    // Nothing may be re-stored until we know our local state is level with the swarm — otherwise
    // we would be re-uploading a view we already know is behind.
    if (!localStateIsLevelWithSwarm(pubkey)) {
      return false;
    }

    const missingHashes = getMissingHashes(pubkey).filter(
      // barred for a bounded interval rather than for the session
      hash => {
        const settledAt = hashSettledAt.get(hash);
        return settledAt === undefined || nowMs() - settledAt >= HASH_BAR_MS;
      }
    );

    // ORDER MATTERS, and it is the only reason this works. `pruneSettledDetections` reads
    // `hashSettledAt` to decide what is finished with; `pruneExpiredBars` removes entries from it.
    // Run the other way round, a bar that has just expired takes its hash out of `hashSettledAt`
    // first, the detection then looks unfinished, and it is retained forever — the leak survives
    // with both pruners present and looking correct.
    pruneSettledDetections(pubkey);
    pruneExpiredBars();

    if (isEmpty(missingHashes)) {
      return false;
    }

    // The guards above and the bookkeeping below are identical for both; only the inspection and
    // the restore know the difference between a user config and a group sub-config.
    const inspection = isUs
      ? await userVariantsNeedingRestore(missingHashes)
      : await groupConfigsNeedingRestore(pubkey as GroupPubkeyType, missingHashes);
    const { needingRestore, coveredHashes, inspectedEverything } = inspection;

    // Every keys hash gone and no bytes held: nothing here can repair it, so raise the banner. This
    // is the only place it is raised from detection — the poller's empty-fetch branch cannot see
    // this case at all, because it requires holding NO config hashes and we hold plenty.
    if (!isUs && 'keysUnrecoverableHere' in inspection && inspection.keysUnrecoverableHere) {
      await setGroupExpired(pubkey as GroupPubkeyType, true);
    }

    // "not stored" is three outcomes, not two. A hash no restorable config claims was ruled out by a
    // guard — not active any more, or belonging to a dirty config that will be pushed under a new
    // hash anyway — so it is SETTLED rather than retryable. Folding these into "failed" costs no
    // requests, because the rejection happens before any network call, which is exactly why it does
    // not look like a problem: what it actually does is re-examine and re-log the same detection on
    // every poll, forever.
    // Settled here means barred for HASH_BAR_MS, NOT for the session — a guard's verdict CAN change
    // over hours, so the bar buys quiet without withdrawing the hash permanently.
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

    // The other half of releasing a failed attempt. A store that keeps failing leaves its
    // hashes unmarked so the next poll retries, which is correct; unbounded, that retry is every few
    // seconds forever. Rate-limited rather than capped, so a device with flaky connectivity keeps
    // getting chances instead of being written off for the session.
    const previous = recoveryAttemptsBySwarm.get(pubkey);
    const consecutiveFailures = previous?.consecutiveFailures ?? 0;
    if (previous && nowMs() - previous.lastAttemptAt < backoffMsFor(consecutiveFailures)) {
      return false;
    }

    const keysWereRestorable = !isUs && needingRestore.includes('groupKeys' as never);

    const { stored, progressed } = isUs
      ? await restoreUserConfigs(needingRestore as Array<ConfigWrapperUser>)
      : await restoreGroupConfigs(
          pubkey as GroupPubkeyType,
          needingRestore as Array<RestorableGroupConfig>
        );

    // We held the bytes and the re-store did not land, so the keys are still gone from the swarm
    // and still not back. Deferring the banner was right while we had a repair in hand; once that
    // repair fails the user needs to know. A later successful round clears it eagerly.
    if (keysWereRestorable && !stored) {
      await setGroupExpired(pubkey as GroupPubkeyType, true);
    }

    // Reset on PROGRESS, not on completion — but progress means "something got BARRED", not
    // "something returned 200". Those differ exactly when a multipart config half-lands, and that
    // is the case that matters: all parts go back on every attempt, so a half-landing config sends
    // the identical request next round. Treating that as progress reset the counter forever and
    // re-sent in full on every poll.
    // Still gated on its own value rather than reusing `stored`: with several configs, one landing
    // in full genuinely shrinks the next round even though the swarm is not finished.
    recoveryAttemptsBySwarm.set(pubkey, {
      consecutiveFailures: progressed ? 0 : consecutiveFailures + 1,
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
  currentPollToken.clear();
  swarmsWithIncompleteMerge.clear();
  recoveryAttemptsBySwarm.clear();
  hashSettledAt.clear();
  missingHashesByPubkey.clear();
  recoveryInFlight.clear();
  keysBackfillFailedAt.clear();
}

/**
 * Do we hold the bytes to put this group's keys messages back ourselves?
 *
 * The poller asks before flagging a group expired. "Expired" means not recoverable BY THIS DEVICE,
 * so a device retaining the keys messages must not raise it — it is about to repair the group.
 *
 * Deliberately tolerant: any failure to answer returns false, which keeps the existing behaviour
 * rather than suppressing a flag we cannot justify suppressing.
 */
/**
 * Which of a group's active keys hashes we hold NO BYTES for.
 *
 * `activeHashesByConfig().groupKeys` names every keys message still active; `activeKeyMessages()`
 * returns only the ones whose bytes libSession retained. A hash in the first and not the second is
 * a message that is still on the swarm and that we could not put back if it ever expired.
 */
async function keysHashesWeLackBytesFor(groupPk: GroupPubkeyType) {
  const byConfig = await MetaGroupWrapperActions.activeHashesByConfig(groupPk);
  const retained = await MetaGroupWrapperActions.activeKeyMessages(groupPk);

  return byConfig.groupKeys.filter(hash => !(hash in retained));
}

/**
 * Re-fetch and re-merge a group's keys messages so libSession retains their bytes.
 *
 * PROACTIVE, NOT ON DETECTION, and that distinction is the whole value. Detection fires when the
 * swarm has already LOST a hash — by then there is nothing left to fetch and this can do nothing.
 * This fires while the message is still there, which is the only window in which it works.
 *
 * Re-loading a keys message we already hold the key for is a no-op for KEY STATE (insert_key
 * early-returns) but NOT for RETENTION: that early-return path still stores the bytes and flags a
 * dump. So this is cheap and safe against a group whose keys are perfectly healthy.
 *
 * @returns whether we now hold bytes for every active keys hash.
 */
async function backfillGroupKeys(groupPk: GroupPubkeyType): Promise<boolean> {
  if (isEmpty(await keysHashesWeLackBytesFor(groupPk))) {
    return true;
  }

  const swarm = await SnodePool.getSwarmFor(groupPk);
  const targetNode = swarm[0];
  if (!targetNode) {
    // Not an attempt — we never asked anyone. Throwing keeps the caller from recording a failure
    // for a group we learned nothing about.
    throw new Error('backfillGroupKeys: no snode in swarm');
  }

  // The retrieve layer DIRECTLY, never the poll wrapper. `pollNodeForKey` writes the namespace
  // cursor from whatever it fetched (swarmPolling.ts:902), and this asks with NO last_hash, so
  // routing through it would advance the cursor past messages the poll never consumed. Nothing
  // below the retrieve writes the cursor — the only writers are that call site and the Data helper
  // it calls — so staying outside it is sufficient here, which is not true on every platform.
  const results = await SnodeAPIRetrieve.retrieveNextMessagesNoRetries(
    targetNode,
    groupPk,
    [{ lastHash: '', namespace: SnodeNamespaces.ClosedGroupKeys }],
    UserUtils.getOurPubKeyStrFromCache(),
    null,
    true
  );

  const keysMessages = (results ?? [])
    .filter(r => r.namespace === SnodeNamespaces.ClosedGroupKeys)
    .flatMap(r => r.messages?.messages ?? [])
    .filter(m => !!m?.data && !!m?.hash && !!m?.storedAt)
    .map(m => ({
      data: fromBase64ToArray(m.data),
      hash: m.hash,
      // `storedAt` is when the snode stored it, which is what the merge wants — NOT the envelope
      // timestamp. The normal poll path uses the same field for keys messages.
      timestampMs: m.storedAt,
    }));

  if (isEmpty(keysMessages)) {
    return false;
  }

  await MetaGroupWrapperActions.metaMerge(groupPk, {
    groupInfo: [],
    groupKeys: keysMessages,
    groupMember: [],
  });

  // The merge alone is not enough, and the difference is invisible in-process. Retention lives in
  // the config DUMP, so bytes captured by a merge that never persists die with the process: the
  // backfill appears to work and silently does not, and any test asserting within one run passes
  // either way.
  await LibSessionUtil.saveDumpsToDb(groupPk);

  return isEmpty(await keysHashesWeLackBytesFor(groupPk));
}

/**
 * The entry point the poller calls. Records the outcome so the rekey can tell "a backfill has run
 * and nothing can restore these" from "a backfill has never run" — two states no other predicate
 * distinguishes.
 */
async function backfillGroupKeysIfNeeded(groupPk: GroupPubkeyType) {
  try {
    const lastFailure = keysBackfillFailedAt.get(groupPk);
    if (lastFailure !== undefined && nowMs() - lastFailure < HASH_BAR_MS) {
      return;
    }

    if (await backfillGroupKeys(groupPk)) {
      // CLEARED on success rather than left alone. This record is read as "this device cannot
      // repair this group", and a device that just retained the bytes plainly can.
      keysBackfillFailedAt.delete(groupPk);
      return;
    }

    // Means ATTEMPTED AND THE BYTES ARE STILL ABSENT — not "the fetch came back empty". A fetch
    // returning messages that still do not restore the bytes is equally a failed attempt, and
    // recording only the empty case leaves the group looking un-attempted forever while re-fetching
    // the same useless messages every eligible poll.
    // The two are indistinguishable in any fixture where the swarm holds nothing, which is the
    // first fixture anyone writes — so the test that separates them needs a swarm that returns
    // something.
    keysBackfillFailedAt.set(groupPk, nowMs());
  } catch (e) {
    // A throw is not an attempt: we never learned whether the bytes are obtainable, so recording a
    // failure would let the rekey act on evidence we do not have.
    window.log.warn(
      `ConfigRecovery: keys backfill for ${ed25519Str(groupPk)} failed: ${e.message}`
    );
  }
}

/** Has a backfill run for this group and still come up short? Read by the rekey's precondition. */
function keysBackfillHasFailedFor(groupPk: GroupPubkeyType) {
  return keysBackfillFailedAt.has(groupPk);
}

/**
 * Raise or clear a group's expired banner.
 *
 * "Expired" means its keys are gone from the swarm and **this device cannot put them back** — so it
 * is a not-available-to-you-right-now signal, not a statement about the group. A peer that still
 * holds the bytes clears it by re-storing them.
 */
async function setGroupExpired(groupPk: GroupPubkeyType, expired: boolean) {
  try {
    const convo = ConvoHub.use().get(groupPk);
    if (!convo || convo.getIsExpired03Group() === expired) {
      return;
    }
    window.log.info(
      `ConfigRecovery: marking ${ed25519Str(groupPk)} ${expired ? 'EXPIRED' : 'not expired'}`
    );
    convo.setIsExpired03Group(expired);
    await convo.commit();
  } catch (e) {
    window.log.warn(
      `ConfigRecovery: could not set expired flag for ${ed25519Str(groupPk)}: ${e.message}`
    );
  }
}

async function canRepairGroupKeys(groupPk: GroupPubkeyType) {
  try {
    return !isEmpty(await MetaGroupWrapperActions.activeKeyMessages(groupPk));
  } catch (e) {
    window.log.warn(
      `ConfigRecovery: canRepairGroupKeys failed for ${ed25519Str(groupPk)}: ${e.message}`
    );
    return false;
  }
}

/**
 * Exported for tests only. The poller does not await recovery, so a test that drives a poll has to
 * be able to wait for the round it started; without this it would have to sleep and hope.
 * Resolves immediately when no round is running.
 */
async function waitForRecoveryForTesting(pubkey: AccountPubkey) {
  await recoveryInFlight.get(pubkey);
}

/** exported for tests only — as with the bars, this leak is invisible from outside */
function trackedDetectionCountForTesting(pubkey: AccountPubkey) {
  return missingHashesByPubkey.get(pubkey)?.size ?? 0;
}

/** exported for tests only — the leak this guards is otherwise unobservable from outside */
function barredHashCountForTesting() {
  return hashSettledAt.size;
}

export const ConfigRecovery = {
  barredHashCountForTesting,
  trackedDetectionCountForTesting,
  markLocalStateLevelWithSwarm,
  beginPollForSwarm,
  localStateIsLevelAsOfCurrentPoll,
  setNowForTesting,
  markMergeIncompleteForSwarm,
  localStateIsLevelWithSwarm,
  recordDetection,
  getMissingHashes,
  recoverIfNeeded,
  canRepairGroupKeys,
  backfillGroupKeysIfNeeded,
  keysBackfillHasFailedFor,
  resetForTesting,
  waitForRecoveryForTesting,
};
