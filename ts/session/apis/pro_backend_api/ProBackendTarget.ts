import { crypto_sign_ed25519_pk_to_curve25519, from_hex, to_hex } from 'libsodium-wrappers-sumo';

import { SERVER_HOSTS } from '..';
import { assertUnreachable } from '../../../types/sqlSharedTypes';
import { SessionServerConfigType } from '../session_backend_server';
import LIBSESSION_CONSTANTS from '../../utils/libsession/libsession_constants';

// Host used when no dev Pro backend is configured, so an unconfigured DEV target still can't resolve
// to anything real. Not in SERVER_HOSTS (testing only).
const PRO_BACKEND_DEV_UNCONFIGURED = 'dev-pro-backend-not-configured.invalid';

/**
 * A dev Pro backend, supplied through the environment.
 *
 * There is no shared dev deployment: one runs locally (the `pro-backend` container in
 * Sesh-Net-Docker, alongside the devnet), so its address and key are per-machine and cannot be baked
 * in the way the DEFAULT target's come from libsession.
 *
 *   TEST_PRO_BACKEND_URL   e.g. http://192.168.1.101:8090
 *   TEST_PRO_BACKEND_ED_PK "Ed25519 signing pubkey" from the backend's startup banner
 *
 * Only those two. The X25519 key the onion request encrypts to is **derived** from the Ed25519 one
 * (`crypto_sign_ed25519_pk_to_curve25519`) rather than configured: the backend generates one keypair
 * and prints both representations of it, so asking for the second invites a mismatched pair that fails
 * halfway through an exchange — the proof verifies but the onion request cannot be decrypted, or the
 * reverse.
 *
 * Use an address the SNODES can reach rather than localhost: requests arrive over an onion path, so
 * the host is resolved inside the snode containers.
 *
 * The env read happens once at module load; the key derivation is deferred (see `devTarget`).
 */
const devFromEnv = ((): { url: string; edPkHex: string } | null => {
  const value = (name: string) => (process.env[name] ?? '').trim();
  const url = value('TEST_PRO_BACKEND_URL').replace(/\/$/, '');
  const edPkHex = value('TEST_PRO_BACKEND_ED_PK').toLowerCase();

  if (!url || !edPkHex) {
    return null;
  }
  if (!/^https?:\/\/[^/\s]+$/.test(url)) {
    throw new Error(`TEST_PRO_BACKEND_URL must look like http://host:port (got "${url}")`);
  }
  if (!/^[0-9a-f]{64}$/.test(edPkHex)) {
    throw new Error(
      `TEST_PRO_BACKEND_ED_PK must be a 64-character hex Ed25519 pubkey (got "${edPkHex}")`
    );
  }
  return { url, edPkHex };
})();

/**
 * The DEV target, with the X25519 key derived on first use.
 *
 * Deferred rather than computed alongside `devFromEnv` because the conversion needs libsodium, which
 * is only usable after `sodium.ready` — module evaluation can happen before that. Everything that
 * reads this does so at runtime, and `Object.keys` (which builds PRO_BACKEND_TARGETS) does not
 * invoke getters, so nothing forces it early.
 */
let devTargetCache: Omit<
  SessionServerConfigType,
  'requestTimeoutMs' | 'abortControllerTimeoutMs'
> | null = null;

function devTarget() {
  if (!devTargetCache) {
    devTargetCache = {
      name: 'ProBackendDev',
      // Falls back to an unresolvable host with empty keys when unconfigured, so this target stays
      // inert rather than silently pointing at the default backend — getServer() throws before it is
      // ever used.
      url: (devFromEnv?.url ??
        `https://${PRO_BACKEND_DEV_UNCONFIGURED}`) as SessionServerConfigType['url'],
      edPkHex: devFromEnv?.edPkHex ?? '',
      xPkHex: devFromEnv
        ? to_hex(crypto_sign_ed25519_pk_to_curve25519(from_hex(devFromEnv.edPkHex)))
        : '',
    };
  }
  return devTargetCache;
}

/**
 * Whether a dev Pro backend is configured, i.e. whether the DEV target is usable.
 *
 * Deliberately answers from the environment alone, without touching `devTarget()`: `getServer()` asks
 * this before using DEV, and it must be able to report "not configured" without needing libsodium.
 */
function isDevProBackendConfigured() {
  return devFromEnv !== null;
}

const PRO_BACKENDS: Record<
  'DEFAULT' | 'DEV',
  Omit<SessionServerConfigType, 'requestTimeoutMs' | 'abortControllerTimeoutMs'>
> = {
  DEFAULT: {
    name: 'ProBackend',
    // URL + pubkeys come from libsession — the single source of truth; no hand-carried copies here.
    url: LIBSESSION_CONSTANTS.LIBSESSION_PRO_BACKEND_URL as SessionServerConfigType['url'],
    edPkHex: LIBSESSION_CONSTANTS.LIBSESSION_PRO_BACKEND_PUBKEY_HEX,
    xPkHex: LIBSESSION_CONSTANTS.LIBSESSION_PRO_BACKEND_PUBKEY_X25519_HEX,
  },
  // A getter, so the X25519 derivation in devTarget() happens on first read rather than at module
  // load, where libsodium may not be ready yet.
  get DEV() {
    return devTarget();
  },
};

function isDefaultProBackend(edPkHex: string) {
  return edPkHex === PRO_BACKENDS.DEFAULT.edPkHex;
}

function urlToProTarget(url: string): PRO_BACKEND_TARGET_TYPE {
  if (!URL.canParse(url)) {
    throw new Error(`urlToProTarget: url can't be parsed: "${url}"`);
  }
  const parsedUrl = new URL(url);
  // this for loop is just here to get a compile error if we ever add a pro target
  for (let index = 0; index < PRO_BACKEND_TARGETS.length; index++) {
    const target = PRO_BACKEND_TARGETS[index];
    switch (target) {
      case 'DEV':
        // Matched against whatever DEV resolved to — the configured host, or the unresolvable
        // placeholder when there is none. An exact host match rather than `includes`, because a
        // configured dev host is an arbitrary address (often a bare IP:port) and a substring test on
        // one of those matches far too much.
        if (parsedUrl.host === new URL(PRO_BACKENDS.DEV.url).host) {
          return 'DEV';
        }
        break;
      case 'DEFAULT':
        if (parsedUrl.host.includes(SERVER_HOSTS.PRO_SERVER)) {
          return 'DEFAULT';
        }
        break;
      default:
        assertUnreachable(target, 'urlToProTarget: target is not a valid target');
    }
  }
  throw new Error(`urlToProTarget: url host is not a valid pro server: "${url}"`);
}

const PRO_BACKEND_TARGETS = Object.keys(PRO_BACKENDS) as Array<PRO_BACKEND_TARGET_TYPE>;

export const PRO_API = {
  isDefaultProBackend,
  isDevProBackendConfigured,
  PRO_BACKEND_TARGETS,
  PRO_BACKENDS,
  urlToProTarget,
};

export type PRO_BACKEND_TARGET_TYPE = keyof typeof PRO_BACKENDS;
