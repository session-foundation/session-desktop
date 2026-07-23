// Periodically fetch from the fileserver to check for a new release
// * if there is none, no request to github are made.
// * if there is a version on the fileserver more recent than our current, we fetch github to get the UpdateInfos and trigger an update as usual (asking user via dialog)

import { isEmpty, isString } from 'lodash';
import { ipcRenderer } from 'electron';
import { DURATION } from '../constants';
import { getLatestReleaseFromFileServer } from '../apis/file_server_api/FileServerApi';
import { isReleaseChannel } from '../../updater/types';

/**
 * We don't want to hit the fileserver too often. Only often on start, and then every 30 minutes.
 */
const fetchReleaseFromFileServerInterval = DURATION.MINUTES * 30;

let lastFetchedTimestamp = Number.MIN_SAFE_INTEGER;

function resetForTesting() {
  lastFetchedTimestamp = Number.MIN_SAFE_INTEGER;
}

async function fetchReleaseFromFSAndUpdateMain(
  userEd25519SecretKey: Uint8Array,
  force?: boolean
): Promise<string | null> {
  try {
    window.log.info('[updater] about to fetchReleaseFromFSAndUpdateMain');
    const diff = Date.now() - lastFetchedTimestamp;
    if (!force && diff < fetchReleaseFromFileServerInterval) {
      window.log.debug(
        `[updater] fetched release from fs ${Math.floor(diff / DURATION.MINUTES)} minutes ago, skipping until that's at least ${Math.floor(fetchReleaseFromFileServerInterval / DURATION.MINUTES)}`
      );
      return null;
    }

    const justFetched = await getLatestReleaseFromFileServer(userEd25519SecretKey);
    if (!justFetched) {
      window.log.info('[updater] no new release found on fileserver');
      return null;
    }

    const [releaseVersion, releaseChannel] = justFetched;
    window.log.info(
      `[updater] renderer process fetched from the ${releaseChannel} release channel on the fileserver: ${releaseVersion}`
    );

    if (isString(releaseVersion) && !isEmpty(releaseVersion) && isReleaseChannel(releaseChannel)) {
      lastFetchedTimestamp = Date.now();
      ipcRenderer.send('set-release-from-file-server', justFetched);
      window.readyForUpdates();
      // When we detect a new release through routine polling, trigger an immediate check
      // instead of waiting for the next updater interval tick. The forced (debug menu) path
      // runs its own 'force-update-check', so we skip it here to avoid a duplicate check.
      if (!force) {
        void ipcRenderer.invoke('trigger-update-check');
      }
      return releaseVersion;
    }

    return null;
  } catch (e) {
    window.log.warn(e);
    return null;
  }
}

export const fetchLatestRelease = {
  /**
   * Try to fetch the latest release from the fileserver every 30 minutes.
   */
  fetchReleaseFromFileServerInterval,
  fetchReleaseFromFSAndUpdateMain,
  resetForTesting,
};
