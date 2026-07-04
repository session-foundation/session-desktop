import { isEmpty } from 'lodash';
import { useCallback, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import useInterval from 'react-use/lib/useInterval';
import { SettingsKey } from '../data/settings-key';
import { fetchLatestRelease } from '../session/fetch_latest_release';
import { UserUtils } from '../session/utils';
import { getOurPrimaryConversation } from '../state/selectors/conversations';

export async function fetchLatestReleaseFromFileServerIfEnabled() {
  if (!window.getSettingValue(SettingsKey.settingsAutoUpdate)) {
    return;
  }

  const userEd25519SecretKey = (await UserUtils.getUserED25519KeyPairBytes())?.privKeyBytes;
  if (userEd25519SecretKey && !isEmpty(userEd25519SecretKey)) {
    void fetchLatestRelease.fetchReleaseFromFSAndUpdateMain(userEd25519SecretKey);
  }
}

export function useFetchLatestReleaseFromFileServer() {
  const ourPrimaryConversation = useSelector(getOurPrimaryConversation);
  const fetchedOnStartupRef = useRef(false);

  const fetchReleaseIfEnabled = useCallback(async () => {
    if (!ourPrimaryConversation) {
      return;
    }

    await fetchLatestReleaseFromFileServerIfEnabled();
  }, [ourPrimaryConversation]);

  useEffect(() => {
    if (fetchedOnStartupRef.current || !ourPrimaryConversation) {
      return;
    }

    fetchedOnStartupRef.current = true;
    void fetchReleaseIfEnabled();
  }, [fetchReleaseIfEnabled, ourPrimaryConversation]);

  useInterval(fetchReleaseIfEnabled, fetchLatestRelease.fetchReleaseFromFileServerInterval);
}
