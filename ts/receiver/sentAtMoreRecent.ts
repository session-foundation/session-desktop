import { isNumber } from 'lodash';

import { Storage } from '../util/storage';
// eslint-disable-next-line import/no-unresolved, import/extensions
import { ConfigWrapperUser } from '../webworker/workers/browser/libsession_worker_functions';

import { getSettingsKeyFromLibsessionWrapper } from './configMessage';

/**
 * If we merged a more recent wrapper, we must not apply the changes from some incoming messages as it would override a change already set in the wrapper.
 *
 * This is mostly to take care of the link a device logic, where we apply the changes from a wrapper, and then start polling from our swarm namespace 0.
 * Some messages on our swarm might unhide a contact which was marked hidden after that message was already received on another device. Same for groups left/joined etc.
 *
 * @returns true if the user config release is live AND the latest processed corresponding wrapper is supposed to have already included the changes this message did.
 * So if that message should not make any changes to the data tracked in the wrappers (just add messages if needed, but don't set members, unhide contact etc).
 */
export async function sentAtMoreRecentThanWrapper(
  envelopeSentAtMs: number,
  variant: ConfigWrapperUser
): Promise<'unknown' | 'wrapper_more_recent' | 'envelope_more_recent'> {
  const settingsKey = getSettingsKeyFromLibsessionWrapper(variant);
  if (!settingsKey) {
    return 'unknown';
  }
  const latestProcessedEnvelope = Storage.get(settingsKey);
  if (!isNumber(latestProcessedEnvelope) || !latestProcessedEnvelope) {
    // We want to process the message if we do not have valid data in the db.
    // Also, we DO want to process a message if we DO NOT have a latest processed timestamp for that wrapper yet
    return 'envelope_more_recent';
  }

  // this must return true if the message we are considering should have already been handled based on our `latestProcessedEnvelope`.
  // so if that message was sent before `latestProcessedEnvelope - 2 mins`, we must return true;
  const latestProcessedEnvelopeLess2Mins = latestProcessedEnvelope - 2 * 60 * 1000;

  return envelopeSentAtMs > latestProcessedEnvelopeLess2Mins
    ? 'envelope_more_recent'
    : 'wrapper_more_recent';
}
