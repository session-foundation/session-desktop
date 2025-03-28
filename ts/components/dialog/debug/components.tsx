import useAsync from 'react-use/lib/useAsync';
import { ipcRenderer, shell } from 'electron';
import { useDispatch } from 'react-redux';
import { useState } from 'react';
import { Flex } from '../../basic/Flex';
import { SpacerXS } from '../../basic/Text';
import { localize } from '../../../localization/localeTools';
import { CopyToClipboardIcon } from '../../buttons';
import { saveLogToDesktop } from '../../../util/logging';
import { Localizer } from '../../basic/Localizer';
import { SessionButton, SessionButtonColor } from '../../basic/SessionButton';
import { ToastUtils, UserUtils } from '../../../session/utils';
import { getLatestReleaseFromFileServer } from '../../../session/apis/file_server_api/FileServerApi';
import { SessionSpinner } from '../../loading';
import { setDebugMode } from '../../../state/ducks/debug';
import { updateDebugMenuModal } from '../../../state/ducks/modalDialog';
import LIBSESSION_CONSTANTS from '../../../session/utils/libsession/libsession_constants';
import { type ReleaseChannels } from '../../../updater/types';
import { fetchLatestRelease } from '../../../session/fetch_latest_release';

const CheckVersionButton = ({ channelToCheck }: { channelToCheck: ReleaseChannels }) => {
  const channelName = channelToCheck === 'latest' ? 'stable' : channelToCheck;
  const [loading, setLoading] = useState(false);
  const state = useAsync(async () => {
    const userEd25519KeyPairBytes = await UserUtils.getUserED25519KeyPairBytes();
    const userEd25519SecretKey = userEd25519KeyPairBytes?.privKeyBytes;
    return userEd25519SecretKey;
  });

  return (
    <SessionButton
      onClick={async () => {
        if (state.loading || state.error) {
          window.log.error(
            `[debugMenu] CheckVersionButton checking ${channelToCheck} channel state loading ${state.loading} error ${state.error}`
          );
          setLoading(false);
          return;
        }
        if (!state.value) {
          window.log.error(
            `[debugMenu] CheckVersionButton checking ${channelToCheck} channel no userEd25519SecretKey`
          );
          setLoading(false);
          return;
        }
        setLoading(true);
        const result = await getLatestReleaseFromFileServer(state.value, channelToCheck);
        if (!result) {
          ToastUtils.pushToastError(
            'CheckVersionButton',
            `Failed to fetch ${channelToCheck} release`
          );
          setLoading(false);
          return;
        }
        const [versionNumber, releaseChannel] = result;
        if (!releaseChannel) {
          ToastUtils.pushToastError(
            'CheckVersionButton',
            `Failed to return release channel when fetching`
          );
          setLoading(false);
          return;
        }
        if (!versionNumber) {
          ToastUtils.pushToastError(
            'CheckVersionButton',
            `Failed to fetch ${channelToCheck} release version`
          );
          setLoading(false);
          return;
        }
        setLoading(false);

        ToastUtils.pushToastInfo(`CheckVersionButtonAvailable`, `Available: v${versionNumber}`);
        ToastUtils.pushToastInfo(
          'CheckVersionButtonCurrent',
          `Current: v${window.versionInfo.version}`
        );
      }}
    >
      <SessionSpinner loading={loading || state.loading} color={'var(--text-primary-color)'} />
      {!loading && !state.loading ? `Check ${channelName} version` : null}
    </SessionButton>
  );
};

const CheckForUpdatesButton = () => {
  const [loading, setLoading] = useState(false);
  const state = useAsync(async () => {
    const userEd25519KeyPairBytes = await UserUtils.getUserED25519KeyPairBytes();
    const userEd25519SecretKey = userEd25519KeyPairBytes?.privKeyBytes;
    return userEd25519SecretKey;
  });

  const handleCheckForUpdates = async () => {
    window.log.warn(
      '[updater] [debugMenu] Triggering check for updates. Current version',
      window.getVersion()
    );
    setLoading(true);

    if (state.loading || state.error) {
      window.log.error(
        `[updater] [debugMenu] userEd25519SecretKey loading ${state.loading} error ${state.error}`
      );
      setLoading(false);
      return;
    }

    if (!state.value) {
      window.log.error(`[updater] [debugMenu] userEd25519SecretKey not found`);
      setLoading(false);
      return;
    }

    const newVersion = await fetchLatestRelease.fetchReleaseFromFSAndUpdateMain(state.value, true);

    if (!newVersion) {
      window.log.info('[updater] [debugMenu] no version returned from fileserver');
      setLoading(false);
      return;
    }

    const success = await ipcRenderer.invoke('force-update-check');
    if (!success) {
      ToastUtils.pushToastError('CheckForUpdatesButton', 'Check for updates failed! See logs');
    }

    setLoading(false);
  };

  return (
    <SessionButton
      onClick={() => {
        void handleCheckForUpdates();
      }}
    >
      <SessionSpinner loading={loading || state.loading} color={'var(--text-primary-color)'} />
      {!loading && !state.loading ? 'Check for updates' : null}
    </SessionButton>
  );
};

export const DebugActions = () => {
  const dispatch = useDispatch();

  return (
    <>
      <h2>Actions</h2>
      <SpacerXS />
      <Flex
        $container={true}
        width="100%"
        $justifyContent="flex-start"
        $alignItems="flex-start"
        $flexWrap="wrap"
        $flexGap="var(--margins-md) var(--margins-lg)"
      >
        <SessionButton
          buttonColor={SessionButtonColor.Danger}
          onClick={() => {
            dispatch(setDebugMode(false));
            dispatch(updateDebugMenuModal(null));
          }}
        >
          Exit Debug Mode
        </SessionButton>

        <SessionButton
          onClick={() => {
            void saveLogToDesktop();
          }}
        >
          <Localizer token="helpReportABugExportLogs" />
        </SessionButton>

        {window.getCommitHash() ? (
          <SessionButton
            onClick={() => {
              void shell.openExternal(
                `https://github.com/session-foundation/session-desktop/commit/${window.getCommitHash()}`
              );
            }}
          >
            Go to commit
          </SessionButton>
        ) : null}

        <SessionButton
          onClick={() => {
            void shell.openExternal(
              `https://github.com/session-foundation/session-desktop/releases/tag/v${window.getVersion()}`
            );
          }}
        >
          <Localizer token="updateReleaseNotes" />
        </SessionButton>
        <CheckForUpdatesButton />
        <CheckVersionButton channelToCheck="latest" />
        {window.sessionFeatureFlags.useReleaseChannels ? (
          <CheckVersionButton channelToCheck="alpha" />
        ) : null}
        <SessionButton
          onClick={async () => {
            const storageProfile = await ipcRenderer.invoke('get-storage-profile');
            void shell.openPath(storageProfile);
          }}
        >
          Open storage profile
        </SessionButton>
      </Flex>
    </>
  );
};

export const AboutInfo = () => {
  const environmentStates = [];

  if (window.getEnvironment() !== 'production') {
    environmentStates.push(window.getEnvironment());
  }

  if (window.getAppInstance()) {
    environmentStates.push(window.getAppInstance());
  }

  const aboutInfo = [
    `${localize('updateVersion').withArgs({ version: window.getVersion() })}`,
    `${localize('systemInformationDesktop').withArgs({ information: window.getOSRelease() })}`,
    `${localize('commitHashDesktop').withArgs({ hash: window.getCommitHash() || window.i18n('unknown') })}`,
    `Libsession Hash: ${LIBSESSION_CONSTANTS.LIBSESSION_UTIL_VERSION || 'Unknown'}`,
    `Libsession NodeJS Version: ${LIBSESSION_CONSTANTS.LIBSESSION_NODEJS_VERSION || 'Unknown'}`,
    `Libsession NodeJS Hash: ${LIBSESSION_CONSTANTS.LIBSESSION_NODEJS_COMMIT || 'Unknown'}`,
    `${environmentStates.join(' - ')}`,
  ];

  return (
    <Flex
      $container={true}
      width={'100%'}
      $flexDirection="column"
      $justifyContent="flex-start"
      $alignItems="flex-start"
      $flexWrap="wrap"
    >
      <SpacerXS />
      <Flex $container={true} width="100%" $alignItems="center" $flexGap="var(--margins-xs)">
        <h2>About</h2>
        <CopyToClipboardIcon iconSize={'medium'} copyContent={aboutInfo.join('\n')} />
      </Flex>
      <Flex
        $container={true}
        width="100%"
        $flexDirection="column"
        $justifyContent="space-between"
        $alignItems="center"
        $flexGap="var(--margins-xs)"
      >
        {aboutInfo.map((info, index) => {
          if (!info) {
            return null;
          }
          return (
            <Flex
              key={`debug-about-info-${index}`}
              $container={true}
              width="100%"
              $alignItems="flex-start"
              $flexGap="var(--margins-xs)"
            >
              <p style={{ userSelect: 'text', lineHeight: 1.5 }}>{info}</p>
              <CopyToClipboardIcon iconSize={'medium'} copyContent={info} />
            </Flex>
          );
        })}
        <SpacerXS />
      </Flex>
    </Flex>
  );
};

export const OtherInfo = () => {
  const otherInfo = useAsync(async () => {
    const { id, vbid } = await window.getUserKeys();
    return [`${localize('accountIdYours')}: ${id}`, `VBID: ${vbid}`];
  }, []);

  return (
    <Flex
      $container={true}
      width={'100%'}
      $flexDirection="column"
      $justifyContent="flex-start"
      $alignItems="flex-start"
      $flexWrap="wrap"
    >
      <SpacerXS />
      <Flex $container={true} width="100%" $alignItems="center" $flexGap="var(--margins-xs)">
        <h2>Other Info</h2>
        {otherInfo.value ? (
          <CopyToClipboardIcon iconSize={'medium'} copyContent={otherInfo.value.join('\n')} />
        ) : null}
      </Flex>
      <Flex
        $container={true}
        width="100%"
        $flexDirection="column"
        $justifyContent="space-between"
        $alignItems="center"
        $flexGap="var(--margins-xs)"
      >
        {otherInfo.loading ? (
          <p>{localize('loading')}</p>
        ) : otherInfo.error ? (
          <p style={{ color: 'var(--danger-color)', userSelect: 'text' }}>
            {localize('theError')}: {otherInfo.error.message || localize('errorUnknown')}
          </p>
        ) : null}
        {otherInfo.value
          ? otherInfo.value.map((info, index) => (
              <Flex
                key={`debug-other-info-${index}`}
                $container={true}
                width="100%"
                $alignItems="flex-start"
                $flexGap="var(--margins-xs)"
              >
                <p style={{ userSelect: 'text', lineHeight: 1.5 }}>{info}</p>
                <CopyToClipboardIcon iconSize={'medium'} copyContent={info} />
              </Flex>
            ))
          : null}
      </Flex>
    </Flex>
  );
};
