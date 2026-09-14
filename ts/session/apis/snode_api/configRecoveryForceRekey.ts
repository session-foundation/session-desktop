import { GroupPubkeyType } from 'libsession_util_nodejs';
import { isEmpty } from 'lodash';
import {
  MetaGroupWrapperActions,
  UserGroupsWrapperActions,
} from '../../../webworker/workers/browser/libsession_worker_interface';
import { LibSessionUtil } from '../../utils/libsession/libsession_utils';
import { GroupSync } from '../../utils/job_runners/jobs/GroupSyncJob';
import { ed25519Str } from '../../utils/String';
import { DURATION } from '../../constants';
import { ConfigRecovery } from './configRecovery';

/**
 * Last resort for a group whose keys are gone from the swarm and which no device here can repair:
 * an admin mints a new generation so the group becomes usable again.
 *
 * This is the only irreversible, universally visible write in config recovery. Every other part
 * replays bytes the swarm already had — byte-identical, same hash, invisible to every other client.
 * A rekey creates NEW state that every member on every version must process, and it cannot be
 * undone. Everything below is about not doing it when it was not needed.
 *
 * The rekey encrypts the new key to THIS DEVICE'S view of the members. That is why the freshness
 * precondition is not optional: a member added while we were away and not yet merged is simply
 * absent from the list we encrypt to.
 */

/**
 * Groups we have already rekeyed this session.
 *
 * In memory, and it does not need to be otherwise: a rekey mints a new generation, so after a
 * successful one the preconditions below stop holding on their own. This exists to stop a second
 * attempt inside the window before that becomes observable, not to remember across restarts.
 */
const rekeyedThisSession = new Set<GroupPubkeyType>();

/** how long after an attempt we refuse another for the same group, successful or not */
const REKEY_COOLDOWN_MS = 24 * DURATION.HOURS;
const lastAttemptAt = new Map<GroupPubkeyType, number>();

let nowMs: () => number = () => Date.now();

async function forceRekeyIfPossible(groupPk: GroupPubkeyType): Promise<boolean> {
  try {
    // Asked of the store rather than taken as an argument. The store stamps each level mark with
    // the poll it came from, so this compares that stamp against the poll running now — a caller
    // cannot supply a value it likes, only be wrong about when it called.
    //
    // Our members list may otherwise be behind, and a rekey from a stale one silently drops whoever
    // was added since. Refusing costs a poll cycle; proceeding costs someone their access.
    if (!ConfigRecovery.localStateIsLevelAsOfCurrentPoll(groupPk)) {
      return false;
    }

    if (rekeyedThisSession.has(groupPk)) {
      return false;
    }

    const previous = lastAttemptAt.get(groupPk);
    if (previous !== undefined && nowMs() - previous < REKEY_COOLDOWN_MS) {
      return false;
    }

    // A back-fill must have RUN and still come up short. "We hold no bytes" alone cannot
    // distinguish that from a back-fill that has never run — on a fresh install, a restored backup,
    // or a device that has not completed a poll, those look identical and only one of them
    // justifies this.
    if (!ConfigRecovery.keysBackfillHasFailedFor(groupPk)) {
      return false;
    }

    const group = await UserGroupsWrapperActions.getGroup(groupPk);
    if (!group || group.kicked || group.destroyed) {
      return false;
    }

    // Members cannot rekey — the key is signed with the group secret key.
    if (!group.secretKey?.length) {
      return false;
    }

    const byConfig = await MetaGroupWrapperActions.activeHashesByConfig(groupPk);
    const retained = await MetaGroupWrapperActions.activeKeyMessages(groupPk);

    // Only when EVERY keys hash is beyond us. One surviving keys message still lets a new device
    // in, so the group is not stuck and this is not warranted.
    if (isEmpty(byConfig.groupKeys)) {
      return false;
    }
    if (byConfig.groupKeys.some(hash => hash in retained)) {
      return false;
    }

    window.log.warn(
      `ConfigRecovery: no device here can restore the keys for ${ed25519Str(groupPk)} — rekeying`
    );

    lastAttemptAt.set(groupPk, nowMs());

    await MetaGroupWrapperActions.keyRekey(groupPk);
    await LibSessionUtil.saveDumpsToDb(groupPk);
    await GroupSync.queueNewJobIfNeeded(groupPk);

    rekeyedThisSession.add(groupPk);
    return true;
  } catch (e) {
    window.log.warn(`ConfigRecovery: force rekey for ${ed25519Str(groupPk)} failed: ${e.message}`);
    return false;
  }
}

function setNowForTesting(fn: () => number) {
  nowMs = fn;
}

function resetForTesting() {
  nowMs = () => Date.now();
  rekeyedThisSession.clear();
  lastAttemptAt.clear();
}

export const ConfigRecoveryForceRekey = {
  forceRekeyIfPossible,
  setNowForTesting,
  resetForTesting,
};
