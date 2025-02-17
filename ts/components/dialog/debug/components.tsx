import useAsync from 'react-use/lib/useAsync';
import { shell } from 'electron';
import useBoolean from 'react-use/lib/useBoolean';
import { useDispatch } from 'react-redux';
import { gt as isVersionGreaterThan } from 'semver';
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

export const DebugActions = () => {
  const [loadingLatestRelease, setLoadingLatestRelease] = useBoolean(false);
  const [loadingAlphaRelease, setLoadingAlphaRelease] = useBoolean(false);

  const dispatch = useDispatch();

  return (
    <>
      <h2>Actions</h2>
      <SpacerXS />
      <Flex
        container={true}
        width="100%"
        justifyContent="flex-start"
        alignItems="flex-start"
        flexWrap="wrap"
        flexGap="var(--margins-md) var(--margins-lg)"
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

        <SessionButton
          onClick={async () => {
            const userEd25519SecretKey = (await UserUtils.getUserED25519KeyPairBytes())
              ?.privKeyBytes;
            if (!userEd25519SecretKey) {
              window.log.error('[debugMenu] debugLatestRelease no userEd25519SecretKey');
              return;
            }
            setLoadingLatestRelease(true);
            const versionNumber = await getLatestReleaseFromFileServer(
              userEd25519SecretKey,
              'latest'
            );
            setLoadingLatestRelease(false);

            if (versionNumber) {
              ToastUtils.pushToastInfo(
                'debugCurrentRelease1',
                `Current: v${window.versionInfo.version}`
              );
              ToastUtils.pushToastInfo('debugLatestRelease', `Available: v${versionNumber}`);
              window.log.debug(
                `WIP: [debugMenu] [updater] isVersionGreaterThan(latestVersion, currentVersion)`,
                isVersionGreaterThan(`v${versionNumber}`, `v${window.versionInfo.version}`)
              );
            } else {
              ToastUtils.pushToastError('debugLatestRelease', 'Failed to fetch latest release');
            }
          }}
        >
          <SessionSpinner loading={loadingLatestRelease} color={'var(--text-primary-color)'} />
          {!loadingLatestRelease ? 'Check latest release' : null}
        </SessionButton>
        <SessionButton
          onClick={async () => {
            const userEd25519SecretKey = (await UserUtils.getUserED25519KeyPairBytes())
              ?.privKeyBytes;
            if (!userEd25519SecretKey) {
              window.log.error('[debugMenu] debugAlphaRelease no userEd25519SecretKey');
              return;
            }
            setLoadingAlphaRelease(true);
            const versionNumber = await getLatestReleaseFromFileServer(
              userEd25519SecretKey,
              'alpha'
            );
            setLoadingAlphaRelease(false);

            if (versionNumber) {
              ToastUtils.pushToastInfo(
                'debugCurrentRelease2',
                `Current: v${window.versionInfo.version}`
              );
              ToastUtils.pushToastInfo('debugAlphaRelease', `Available: v${versionNumber}`);
              window.log.debug(
                `WIP: [debugMenu] [updater] isVersionGreaterThan(latestVersion, currentVersion)`,
                isVersionGreaterThan(`v${versionNumber}`, `v${window.versionInfo.version}`)
              );
            } else {
              ToastUtils.pushToastError('debugAlphaRelease', 'Failed to fetch latest release');
            }
          }}
        >
          <SessionSpinner loading={loadingAlphaRelease} color={'var(--text-primary-color)'} />
          {!loadingAlphaRelease ? 'Check alpha release' : null}
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
      container={true}
      width={'100%'}
      flexDirection="column"
      justifyContent="flex-start"
      alignItems="flex-start"
      flexWrap="wrap"
    >
      <SpacerXS />
      <Flex container={true} width="100%" alignItems="center" flexGap="var(--margins-xs)">
        <h2>About</h2>
        <CopyToClipboardIcon iconSize={'medium'} copyContent={aboutInfo.join('\n')} />
      </Flex>
      <Flex
        container={true}
        width="100%"
        flexDirection="column"
        justifyContent="space-between"
        alignItems="center"
        flexGap="var(--margins-xs)"
      >
        {aboutInfo.map((info, index) => {
          if (!info) {
            return null;
          }
          return (
            <Flex
              key={`debug-about-info-${index}`}
              container={true}
              width="100%"
              alignItems="flex-start"
              flexGap="var(--margins-xs)"
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
      container={true}
      width={'100%'}
      flexDirection="column"
      justifyContent="flex-start"
      alignItems="flex-start"
      flexWrap="wrap"
    >
      <SpacerXS />
      <Flex container={true} width="100%" alignItems="center" flexGap="var(--margins-xs)">
        <h2>Other Info</h2>
        {otherInfo.value ? (
          <CopyToClipboardIcon iconSize={'medium'} copyContent={otherInfo.value.join('\n')} />
        ) : null}
      </Flex>
      <Flex
        container={true}
        width="100%"
        flexDirection="column"
        justifyContent="space-between"
        alignItems="center"
        flexGap="var(--margins-xs)"
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
                container={true}
                width="100%"
                alignItems="flex-start"
                flexGap="var(--margins-xs)"
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
