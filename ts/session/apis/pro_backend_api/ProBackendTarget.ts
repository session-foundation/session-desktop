import { SERVER_HOSTS } from '..';
import { assertUnreachable } from '../../../types/sqlSharedTypes';
import { SessionServerConfigType } from '../session_backend_server';
import LIBSESSION_CONSTANTS from '../../utils/libsession/libsession_constants';

// not exported/included in the SERVER_HOSTS as this is for testing only
const PRO_BACKEND_DEV = 'pro.session.codes';
// const PRO_BACKEND_DEV = '192.168.1.223:8888';

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
  DEV: {
    name: 'ProBackendDev',
    url: `https://${PRO_BACKEND_DEV}`,
    // url: `http://${PRO_BACKEND_DEV}`,
    edPkHex: '479ffca8bcec7b4a0f0f7afe48b8a6d15635a8c7ff15ad16add05752c19414d4',
    xPkHex: 'ce5a75f64b6c43db6c1374d362c3ea9d85951c4f42a3d04cf94f87822d4f803b',
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
        if (parsedUrl.host.includes(PRO_BACKEND_DEV)) {
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
  PRO_BACKEND_TARGETS,
  PRO_BACKENDS,
  urlToProTarget,
};

export type PRO_BACKEND_TARGET_TYPE = keyof typeof PRO_BACKENDS;
