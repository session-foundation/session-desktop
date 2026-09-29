import { DURATION } from '../../constants';

/**
 * Limits how often a poll asks the swarm to extend the TTL of our config messages.
 *
 * Every extension is a write on every storage node holding those messages, and polls run every few
 * seconds, so extending on each poll puts real disk I/O load on service nodes for no benefit: the
 * extension is to 30 days from now, so doing it once an hour loses nothing.
 *
 * Tracked per swarm, so one group's renewal never suppresses another group's or our own.
 */
const COOLDOWN_MS = DURATION.HOURS;

const lastSuccessfulExtensionMs = new Map<string, number>();

function isDue(swarmPubkey: string): boolean {
  const last = lastSuccessfulExtensionMs.get(swarmPubkey);
  if (last === undefined) {
    return true;
  }
  const elapsedMs = Date.now() - last;

  // A negative value means the device clock was moved backwards. Without this, the cooldown would be
  // held open for however far the clock moved, and the configs could age out.
  return elapsedMs < 0 || elapsedMs >= COOLDOWN_MS;
}

/**
 * Must only be called once the storage server has confirmed the extension. A failed extension that
 * started the cooldown would leave the configs un-renewed while looking handled, and repeated
 * failures would let them age out of the swarm.
 */
function recordSuccessfulExtension(swarmPubkey: string) {
  lastSuccessfulExtensionMs.set(swarmPubkey, Date.now());
}

function resetForTesting() {
  lastSuccessfulExtensionMs.clear();
}

export const ConfigTtlExtensionThrottle = {
  COOLDOWN_MS,
  isDue,
  recordSuccessfulExtension,
  resetForTesting,
};
