import { SERVER_HOSTS } from '..';
import { assertUnreachable } from '../../../types/sqlSharedTypes';

type ProBackendServerConfigType = {
  url: string;
  edPk: string;
};

// not exported/included in the SERVER_HOSTS as this is for testing only
const PRO_BACKEND_DEV = 'session-pro-backend-dev.doylet.dev';

const PRO_BACKENDS: Record<'DEFAULT' | 'DEV', ProBackendServerConfigType> = {
  DEFAULT: {
    url: `http://${SERVER_HOSTS.PRO_SERVER}`,
    // FIXME: to be replaced by the real pubkey
    edPk: 'not_set_yet',
  },
  DEV: {
    url: `https://${PRO_BACKEND_DEV}`,
    edPk: 'fc947730f49eb01427a66e050733294d9e520e545c7a27125a780634e0860a27',
  },
};

function isDefaultProBackend(edPk: string) {
  return edPk === PRO_BACKENDS.DEFAULT.edPk;
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
