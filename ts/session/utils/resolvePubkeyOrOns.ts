import { toASCII } from 'punycode';

import { PubKey } from '../types';
import { ONSResolve } from '../apis/snode_api/onsResolve';
import { NotFoundError, SnodeResponseError } from './errors';
import { tr } from '../../localization/localeTools';

/**
 * Result of {@link resolvePubkeyOrOns}.
 * - `resolved`: `pubkey` is a valid, non-blinded Account ID (hex string) ready to be used.
 * - `error`: `error` is a localized, user-displayable message explaining why it failed.
 */
export type ResolvedPubkeyOrOns =
  | { type: 'resolved'; pubkey: string }
  | { type: 'error'; error: string };

/**
 * Shared resolution for anywhere we accept "an Account ID or an ONS name".
 *
 * Given a raw user input, this:
 *  1. trims + punycode-normalizes it,
 *  2. returns it as-is if it is already a valid non-blinded Account ID,
 *  3. rejects hex-but-invalid keys (e.g. blinded / wrong length) and 03-group keys,
 *  4. otherwise treats it as an ONS name (must match {@link ONSResolve.onsNameRegex} —
 *     dotted inputs like `name.loki` are rejected, matching Session's ONS format) and
 *     resolves it over the network.
 *
 * Never throws: failures come back as `{ type: 'error', error }` with a localized message.
 * This mirrors the New Message overlay flow so both call sites behave identically.
 */
export async function resolvePubkeyOrOns(input: string): Promise<ResolvedPubkeyOrOns> {
  const trimmed = toASCII(input.trim());

  if (!trimmed.length) {
    return { type: 'error', error: tr('accountIdErrorInvalid') };
  }

  const validationError = PubKey.validateWithErrorNoBlinding(trimmed);
  if (!validationError) {
    return { type: 'resolved', pubkey: trimmed };
  }

  // hex-but-invalid (blinded / wrong length) or 03-group key: not an ONS name, reject as-is
  if ((PubKey.validate(trimmed) && validationError) || PubKey.is03Pubkey(trimmed)) {
    return { type: 'error', error: validationError };
  }

  // does it even look like an ONS name? (no dots, see Session's ONS format)
  const mightBeOnsName = new RegExp(ONSResolve.onsNameRegex, 'g').test(trimmed);
  if (!mightBeOnsName) {
    return { type: 'error', error: tr('onsErrorNotRecognized') };
  }

  try {
    const resolvedSessionID = await ONSResolve.getSessionIDForOnsName(trimmed);
    if (PubKey.validateWithErrorNoBlinding(resolvedSessionID)) {
      return { type: 'error', error: tr('onsErrorNotRecognized') };
    }
    return { type: 'resolved', pubkey: resolvedSessionID };
  } catch (e) {
    return {
      type: 'error',
      error:
        e instanceof SnodeResponseError
          ? tr('onsErrorUnableToSearch')
          : e instanceof NotFoundError
            ? tr('onsErrorNotRecognized')
            : tr('onsErrorUnableToSearch'),
    };
  }
}
