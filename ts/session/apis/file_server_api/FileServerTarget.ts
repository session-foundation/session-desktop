import { crypto_sign_ed25519_pk_to_curve25519, from_hex, to_hex } from 'libsodium-wrappers-sumo';

import { SERVER_HOSTS } from '..';
import { assertUnreachable } from '../../../types/sqlSharedTypes';

type FileServerConfigType = {
  url: string;
  xPk: string;
  edPk: string;
};

// not exported/included in the SERVER_HOSTS as this is for testing only
const POTATO_FS_HOST = 'potatofiles.getsession.org';

// Host used when no test file server is configured, so an unconfigured TEST target still can't
// resolve to anything real. Not in SERVER_HOSTS (testing only).
const TEST_FS_UNCONFIGURED = 'test-file-server-not-configured.invalid';

/**
 * A local file server, supplied through the environment.
 *
 * Without this every upload goes to the production file server over an onion path, which no test can
 * redirect — the same shape as the Pro backend before it gained TEST_PRO_BACKEND_*, and this mirrors
 * that deliberately rather than inventing a second pattern.
 *
 *   TEST_FILE_SERVER_URL    e.g. http://192.168.139.2:8000
 *   TEST_FILE_SERVER_ED_PK  the server's Ed25519 pubkey
 *
 * Only those two. The X25519 key the onion request encrypts to is **derived** from the Ed25519 one
 * rather than configured: the server has one keypair and prints both representations of it, so asking
 * for the second invites a mismatched pair that fails halfway through an exchange.
 *
 * Use an address the SNODES can reach rather than localhost: requests arrive over an onion path, so
 * the host is resolved inside the snode containers.
 *
 * The env read happens once at module load; the key derivation is deferred (see `testTarget`).
 */
const testFromEnv = ((): { url: string; edPk: string } | null => {
  const value = (name: string) => (process.env[name] ?? '').trim();
  const url = value('TEST_FILE_SERVER_URL').replace(/\/$/, '');
  const edPk = value('TEST_FILE_SERVER_ED_PK').toLowerCase();

  if (!url && !edPk) {
    return null;
  }
  // One without the other is always a mistake, and silently ignoring it would send the upload to
  // production while the run looks configured.
  if (!url || !edPk) {
    throw new Error(
      'TEST_FILE_SERVER_URL and TEST_FILE_SERVER_ED_PK must be set together ' +
        `(got url="${url}", edPk="${edPk}")`
    );
  }
  if (!/^https?:\/\/[^/\s]+$/.test(url)) {
    throw new Error(`TEST_FILE_SERVER_URL must look like http://host:port (got "${url}")`);
  }
  if (!/^[0-9a-f]{64}$/.test(edPk)) {
    throw new Error(
      `TEST_FILE_SERVER_ED_PK must be a 64-character hex Ed25519 pubkey (got "${edPk}")`
    );
  }
  return { url, edPk };
})();

/**
 * The TEST target, with the X25519 key derived on first use.
 *
 * Deferred rather than computed alongside `testFromEnv` because the conversion needs libsodium, which
 * is only usable after `sodium.ready` — module evaluation can happen before that. Everything that
 * reads this does so at runtime, and `Object.keys` (which builds FILE_SERVER_TARGETS) does not invoke
 * getters, so nothing forces it early.
 */
let testTargetCache: FileServerConfigType | null = null;

/**
 * 64 hex characters is not enough to be an Ed25519 key — an X25519 key looks identical — and the
 * conversion is the only thing that can tell them apart. Left to libsodium it surfaces as a bare
 * "invalid key" from a stack with no mention of the variable that caused it.
 */
function deriveXPkOrThrow(edPk: string) {
  try {
    return to_hex(crypto_sign_ed25519_pk_to_curve25519(from_hex(edPk)));
  } catch (e) {
    throw new Error(
      `TEST_FILE_SERVER_ED_PK is not a valid Ed25519 pubkey: "${edPk}" cannot be converted to ` +
        `X25519 ("${e.message}"). Note an X25519 key is also 64 hex characters, so check you took ` +
        `the server's Ed25519 key and not its X25519 one.`
    );
  }
}

function testTarget(): FileServerConfigType {
  if (!testTargetCache) {
    testTargetCache = {
      // Falls back to an unresolvable host with empty keys when unconfigured, so this target stays
      // inert rather than silently pointing at the default file server.
      url: testFromEnv?.url ?? `https://${TEST_FS_UNCONFIGURED}`,
      edPk: testFromEnv?.edPk ?? '',
      xPk: testFromEnv ? deriveXPkOrThrow(testFromEnv.edPk) : '',
    };
  }
  return testTargetCache;
}

/** Whether a test file server is configured, i.e. whether the TEST target is usable. */
function isTestFileServerConfigured() {
  return testFromEnv !== null;
}

const FILE_SERVERS: Record<'DEFAULT' | 'POTATO' | 'TEST', FileServerConfigType> = {
  DEFAULT: {
    url: `http://${SERVER_HOSTS.DEFAULT_FILE_SERVER}`,
    xPk: '09324794aa9c11948189762d198c618148e9136ac9582068180661208927ef34',
    edPk: 'b8eef9821445ae16e2e97ef8aa6fe782fd11ad5253cd6723b281341dba22e371',
  },
  POTATO: {
    url: `http://${POTATO_FS_HOST}`,
    edPk: 'ff86dcd4b26d1bfec944c59859494248626d6428efc12168749d65a1b92f5e28',
    xPk: 'fc097b06821c98a2db75ce02e521cef5fd9d3446e42e81d843c4c8c4e9260f48',
  },
  // A getter, so the X25519 derivation in testTarget() happens on first read rather than at module
  // load, where libsodium may not be ready yet.
  get TEST() {
    return testTarget();
  },
};

const FILE_SERVER_TARGETS = Object.keys(FILE_SERVERS) as Array<FILE_SERVER_TARGET_TYPE>;

function isDefaultFileServer(edOrXPk: string) {
  return edOrXPk === FILE_SERVERS.DEFAULT.edPk || edOrXPk === FILE_SERVERS.DEFAULT.xPk;
}

function fileUrlToFileTarget(url: string): FILE_SERVER_TARGET_TYPE {
  if (!URL.canParse(url)) {
    throw new Error(`fileUrlToFileTarget: url can't be parsed: "${url}"`);
  }
  const parsedUrl = new URL(url);
  // this for loop is just here to get a compile error if we ever add a fs target
  for (let index = 0; index < FILE_SERVER_TARGETS.length; index++) {
    const target = FILE_SERVER_TARGETS[index];
    switch (target) {
      case 'TEST':
        // Matched against whatever TEST resolved to — the configured host, or the unresolvable
        // placeholder when there is none. An exact host match rather than `includes`, because a
        // configured test host is an arbitrary address (often a bare IP:port) and a substring test on
        // one of those matches far too much.
        if (parsedUrl.host === new URL(FILE_SERVERS.TEST.url).host) {
          return 'TEST';
        }
        break;
      case 'POTATO':
        if (parsedUrl.host.includes(POTATO_FS_HOST)) {
          return 'POTATO';
        }
        break;
      case 'DEFAULT':
        if (parsedUrl.host.includes(SERVER_HOSTS.DEFAULT_FILE_SERVER)) {
          return 'DEFAULT';
        }
        break;
      default:
        assertUnreachable(target, 'fileUrlToFileTarget: target is not a valid target');
    }
  }
  throw new Error(`fileUrlToFileTarget: url host is not a valid file server: "${url}"`);
}

export const FS = {
  isDefaultFileServer,
  isTestFileServerConfigured,
  FILE_SERVERS,
  fileUrlToFileTarget,
};

export type FILE_SERVER_TARGET_TYPE = keyof typeof FILE_SERVERS;
