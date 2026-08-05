import { isArray, isEmpty } from 'lodash';
import { ExpireMessageResultItem, ExpireMessagesResultsContent } from './types';

/**
 * Deciding whether a config message has expired from the swarm, from the response to the `expire`
 * request we piggyback on every poll.
 *
 * This is a normative rule shared with iOS and Android — see
 * `CONFIG_EXPIRY_DETECTION_SPEC.md`. The three clients each implement it separately, so if you
 * change the behaviour here it has to change there too. Every rule below has a test vector.
 */

export type ConfigExpiryDetection =
  /**
   * The response cannot answer the question. Either we didn't ask for `extend` (so the server
   * omits `unchanged` entirely and every hash we didn't update *looks* missing), or no
   * sub-response was usable. Nothing may be marked missing from this.
   */
  | { status: 'unavailable' }
  /**
   * Every snode either failed or timed out. Distinct from "nothing is missing": we simply have no
   * evidence either way.
   */
  | { status: 'inconclusive' }
  | { status: 'conclusive'; missingHashes: Array<string> };

/**
 * A sub-response contributes to the decision only if the snode actually answered.
 *
 * `failed: true` may come with `timeout`, `code`, `reason`, `bad_peer_response` or
 * `query_failure` — none of that matters, `failed` alone is enough to exclude it. Treating a
 * timeout as "that snode doesn't have the message" would turn every network blip into a re-push
 * storm, which is the single worst thing this code could do.
 */
function isEligible(subResponse: ExpireMessageResultItem | undefined): subResponse is Eligible {
  if (!subResponse || subResponse.failed || !isArray(subResponse.updated)) {
    return false;
  }
  // The server sets `unchanged` whenever the request set `extend` (or `shorten`), even when it is
  // empty. So if the key is absent, this response cannot tell presence from absence and has to be
  // excluded rather than read as "nothing was unchanged".
  return !!subResponse.unchanged;
}

type Eligible = ExpireMessageResultItem & { unchanged: Record<string, number> };

function subResponseHolds(subResponse: Eligible, hash: string) {
  return subResponse.updated.includes(hash) || hash in subResponse.unchanged;
}

/**
 * @param requestedHashes the hashes the `expire` sub-request asked about
 * @param swarm the per-snode `swarm` dict from the recursive `expire` response
 * @param requestSetExtend whether the request we are reading the response of set `extend: true`.
 * Note: this must be what *we* sent. The server silently forces extend-only semantics for a group
 * member's subaccount without telling us, and does *not* return `unchanged` in that case.
 */
export function detectMissingConfigHashes({
  requestedHashes,
  swarm,
  requestSetExtend,
}: {
  requestedHashes: Array<string>;
  swarm: ExpireMessagesResultsContent | null | undefined;
  requestSetExtend: boolean;
}): ConfigExpiryDetection {
  if (isEmpty(requestedHashes)) {
    // We asked about nothing, so we learned nothing. The tempting short-circuit here is
    // "no hashes requested, therefore none are missing" — but reporting that as *conclusive* makes
    // detection the authority for a swarm it has no information about, and under §3.5 a conclusive
    // result outranks the empty-fetch check. That check is precisely the one that should decide
    // when we hold no hashes, and it could then never be reached.
    return { status: 'inconclusive' };
  }

  if (!requestSetExtend) {
    return { status: 'unavailable' };
  }

  if (!swarm || isEmpty(swarm)) {
    return { status: 'inconclusive' };
  }

  const eligible = Object.values(swarm).filter(isEligible);

  if (!eligible.length) {
    return { status: 'inconclusive' };
  }

  // One eligible snode reporting a hash absent is enough (D1). Presence elsewhere does not
  // override it: re-storing is idempotent, so a false positive costs one redundant request,
  // whereas waiting for a consensus leans on the swarm replication that is itself the unreliable
  // part here.
  const missingHashes = requestedHashes.filter(hash =>
    eligible.some(subResponse => !subResponseHolds(subResponse, hash))
  );

  return { status: 'conclusive', missingHashes };
}
