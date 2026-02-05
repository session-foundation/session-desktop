import { SERVER_HOSTS } from '..';
import { assertUnreachable } from '../../../types/sqlSharedTypes';

type FileServerConfigType = {
  url: string;
  xPk: string;
  edPk: string;
};

// not exported/included in the SERVER_HOSTS as this is for testing only
const POTATO_FS_HOST = 'potatofiles.getsession.org';

const FILE_SERVERS: Record<'DEFAULT' | 'POTATO', FileServerConfigType> = {
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
  FILE_SERVERS,
  fileUrlToFileTarget,
};

export type FILE_SERVER_TARGET_TYPE = keyof typeof FILE_SERVERS;
