import { minimumGuardCount, ONION_REQUEST_HOPS } from '../../onions/onionPathConstants';

/**
 * If we get less than this snode in a swarm, we fetch new snodes for this pubkey
 */
const minSwarmSnodeCount = 3;

/**
 * If we get less than minSnodePoolCount we consider that we need to fetch the new snode pool from a seed node
 * and not from those snodes.
 */

export const minSnodePoolCount = minimumGuardCount * (ONION_REQUEST_HOPS + 1) * 2;

/**
 * If we get less than this amount of snodes (24), lets try to get an updated list from those while we can
 */
const minSnodePoolCountBeforeRefreshFromSnodes = minSnodePoolCount * 2;

/**
 * If we do a request to fetch nodes from snodes and they don't return at least
 * the same `requiredSnodesForAgreement` snodes we consider that this is not a valid return.
 *
 * Too many nodes are not shared for this call to be trustworthy
 */
const requiredSnodesForAgreement = 24;

export const SnodePoolConstants = {
  // constants
  minSnodePoolCount,
  minSnodePoolCountBeforeRefreshFromSnodes,
  requiredSnodesForAgreement,
  minSwarmSnodeCount,
};
