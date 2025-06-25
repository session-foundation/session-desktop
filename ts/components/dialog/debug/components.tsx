import useAsync from 'react-use/lib/useAsync';
import { ipcRenderer, shell } from 'electron';
import { useDispatch } from 'react-redux';
import { useState } from 'react';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import useInterval from 'react-use/lib/useInterval';
import { filesize } from 'filesize';
import styled from 'styled-components';

import type { PubkeyType } from 'libsession_util_nodejs';
import { chunk, toNumber } from 'lodash';
import { Flex } from '../../basic/Flex';
import { SpacerSM, SpacerXS } from '../../basic/Text';
import { localize } from '../../../localization/localeTools';
import { CopyToClipboardIcon } from '../../buttons';
import { Localizer } from '../../basic/Localizer';
import { SessionButton, SessionButtonColor } from '../../basic/SessionButton';
import { ToastUtils, UserUtils } from '../../../session/utils';
import { getLatestReleaseFromFileServer } from '../../../session/apis/file_server_api/FileServerApi';
import { SessionSpinner } from '../../loading';
import { updateDebugMenuModal } from '../../../state/ducks/modalDialog';
import { setDebugMode } from '../../../state/ducks/debug';
import LIBSESSION_CONSTANTS from '../../../session/utils/libsession/libsession_constants';
import { type ReleaseChannels } from '../../../updater/types';
import { fetchLatestRelease } from '../../../session/fetch_latest_release';
import { saveLogToDesktop } from '../../../util/logger/renderer_process_logging';
import { DURATION } from '../../../session/constants';
import { Errors } from '../../../types/Errors';
import { PubKey } from '../../../session/types';
import { ConvoHub } from '../../../session/conversations';
import { ConversationTypeEnum } from '../../../models/types';
import { ContactsWrapperActions } from '../../../webworker/workers/browser/libsession_worker_interface';
import { usePolling } from '../../../hooks/usePolling';
import { releasedFeaturesActions } from '../../../state/ducks/releasedFeatures';
import {
  useReleasedFeaturesRefreshedAt,
  useSesh101NotificationAt,
} from '../../../state/selectors/releasedFeatures';
import { formatAbbreviatedExpireDoubleTimer } from '../../../util/i18n/formatting/expirationTimer';
import { handleReleaseNotification } from '../../../util/releasedFeatures';
import { networkDataActions } from '../../../state/ducks/networkData';
import { SimpleSessionInput } from '../../inputs/SessionInput';

const hexRef = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'];

function genRandomHexString(length: number) {
  const result = [];

  for (let n = 0; n < length; n++) {
    result.push(hexRef[Math.floor(Math.random() * 16)]);
  }
  return result.join('');
}

async function generateOneRandomContact() {
  const numBytes = PubKey.PUBKEY_LEN - 2;

  const hexBuffer = genRandomHexString(numBytes);
  const id: PubkeyType = `05${hexBuffer}`;
  const created = await ConvoHub.use().getOrCreateAndWait(id, ConversationTypeEnum.PRIVATE);
  // now() is not going to be synced on devices, instead createdAt will be used.
  // createdAt is set to now in libsession-util itself,
  // but we still need to mark that conversation as active
  // for it to be inserted in the config
  created.setKey('active_at', Date.now());
  created.setKey('isApproved', true);
  created.setSessionDisplayNameNoCommit(id.slice(2, 8));

  await created.commit();
  return created;
}

const CheckVersionButton = ({ channelToCheck }: { channelToCheck: ReleaseChannels }) => {
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
      {!loading && !state.loading ? `Check ${channelToCheck} version` : null}
    </SessionButton>
  );
};

const CheckForUpdatesButton = () => {
  const [state, handleCheckForUpdates] = useAsyncFn(async () => {
    window.log.warn(
      '[updater] [debugMenu] CheckForUpdatesButton clicked! Current version',
      window.getVersion()
    );

    try {
      const userEd25519KeyPairBytes = await UserUtils.getUserED25519KeyPairBytes();
      const userEd25519SecretKey = userEd25519KeyPairBytes?.privKeyBytes;
      const newVersion = await fetchLatestRelease.fetchReleaseFromFSAndUpdateMain(
        userEd25519SecretKey,
        true
      );

      if (!newVersion) {
        throw new Error('No version returned from fileserver');
      }

      const success = await ipcRenderer.invoke('force-update-check');
      if (!success) {
        ToastUtils.pushToastError('CheckForUpdatesButton', 'Check for updates failed! See logs');
      }
    } catch (error) {
      window.log.error(
        '[updater] [debugMenu] CheckForUpdatesButton',
        error && error.stack ? error.stack : error
      );
    }
  });

  return (
    <SessionButton
      onClick={() => {
        void handleCheckForUpdates();
      }}
    >
      <SessionSpinner loading={state.loading} color={'var(--text-primary-color)'} />
      {!state.loading ? 'Check for updates' : null}
    </SessionButton>
  );
};

/**
 * Using a function here to avoid a useCallback below
 */
function fetchLogSizeFromIpc() {
  return ipcRenderer.invoke('get-logs-folder-size');
}

const ClearOldLogsButton = () => {
  const [logSize, setLogSize] = useState(0);
  useInterval(async () => {
    const fetched = await fetchLogSizeFromIpc();
    if (fetched && Number.isFinite(fetched)) {
      setLogSize(fetched);
    } else {
      setLogSize(0);
    }
  }, 1 * DURATION.SECONDS);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_state, handleDeleteAllLogs] = useAsyncFn(async () => {
    try {
      const afterCleanSize = await ipcRenderer.invoke('delete-all-logs', true);
      window.log.warn(
        `[debugMenu] ClearOldLogsButton clicked. After clean: ${filesize(afterCleanSize)}`
      );
      setLogSize(afterCleanSize);
      ToastUtils.pushToastInfo('ClearOldLogsButton', 'Cleared old logs!');
    } catch (error) {
      window.log.error(`[debugMenu] ClearOldLogsButton ${Errors.toString(error)}`);
      ToastUtils.pushToastError('ClearOldLogsButtonError', 'Clearing logs failed! See logs');
    }
  });

  return (
    <SessionButton
      onClick={() => {
        void handleDeleteAllLogs();
      }}
      style={{ minWidth: '250px' }}
    >
      Clear old logs {filesize(logSize)}
    </SessionButton>
  );
};

function OfflineButton() {
  const [isOnline, setIsOnline] = useState(window.isOnline);

  return (
    <SessionButton
      onClick={() => {
        window.isOnline = !isOnline;
        setIsOnline(!isOnline);
        window.log.warn(`[debugMenu] OfflineButton: Going ${isOnline ? 'offline' : 'online'}`);
      }}
    >
      Go {isOnline ? 'offline' : 'online'}
    </SessionButton>
  );
}

export const LoggingActions = () => {
  return (
    <>
      <h2>Logging</h2>
      <SpacerXS />
      <Flex
        $container={true}
        maxWidth="900px"
        $justifyContent="flex-start"
        $alignItems="flex-start"
        $flexWrap="wrap"
        $flexGap="var(--margins-lg)"
      >
        <SessionButton
          onClick={() => {
            void saveLogToDesktop();
          }}
        >
          <Localizer token="helpReportABugExportLogs" />
        </SessionButton>
        <ClearOldLogsButton />
      </Flex>
      <SpacerSM />
    </>
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
        maxWidth="900px"
        $justifyContent="flex-start"
        $alignItems="flex-start"
        $flexWrap="wrap"
        $flexGap="var(--margins-lg)"
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
        <OfflineButton />
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
        <CheckVersionButton channelToCheck="stable" />
        {window.sessionFeatureFlags.useReleaseChannels ? (
          <CheckVersionButton channelToCheck="alpha" />
        ) : null}
        <SessionButton
          width="180px"
          onClick={async () => {
            const storageProfile = await ipcRenderer.invoke('get-storage-profile');
            void shell.openPath(storageProfile);
          }}
        >
          Open storage profile
        </SessionButton>
      </Flex>
      <SpacerSM />
    </>
  );
};

export const ExperimentalActions = ({ forceUpdate }: { forceUpdate: () => void }) => {
  const dispatch = useDispatch();
  const refreshedAt = useReleasedFeaturesRefreshedAt();
  const sesh101NotificationAt = useSesh101NotificationAt();

  const [countdown, setCountdown] = useState(false);

  const timeLeftMs = sesh101NotificationAt - Date.now();

  // TODO [SES-2606] uncomment before release but after QA
  // if (!process.env.SESSION_DEV) {
  //   return null;
  // }

  return (
    <>
      <h2>Experimental Actions 🚨</h2>
      <SpacerXS />
      <Flex
        $container={true}
        maxWidth="900px"
        $justifyContent="flex-start"
        $alignItems="flex-start"
        $flexWrap="wrap"
        $flexGap="var(--margins-lg)"
      >
        <SessionButton
          onClick={() => {
            dispatch(releasedFeaturesActions.resetExperiments() as any);
            forceUpdate();
          }}
        >
          Reset experiments
        </SessionButton>
        {window.sessionFeatureFlags.useSESH101 ? (
          <SessionButton
            onClick={() => {
              const notifyAt = handleReleaseNotification({
                featureName: 'useSESH101',
                message: localize('sessionNetworkNotificationLive').toString(),
                lastRefreshedAt: refreshedAt,
                notifyAt: sesh101NotificationAt,
                delayMs: 10 * DURATION.SECONDS,
                force: true,
              });
              dispatch(releasedFeaturesActions.updateSesh101NotificationAt(notifyAt));
              setCountdown(true);
            }}
          >
            Notify Sesh 101
            <span style={{ marginInlineStart: 'var(--margins-xs)' }}>
              {countdown
                ? Math.floor(timeLeftMs / 1000) > 0
                  ? `(${formatAbbreviatedExpireDoubleTimer(Math.floor(timeLeftMs / 1000))})`
                  : '🎉'
                : '(10s)'}
            </span>
          </SessionButton>
        ) : null}
        <SessionButton
          onClick={() => {
            dispatch(networkDataActions.fetchInfoFromSeshServer() as any);
          }}
        >
          Network Info Request (Force)
        </SessionButton>
      </Flex>
      <SpacerSM />
    </>
  );
};

async function fetchContactsCountAndUpdate() {
  const count = (await ContactsWrapperActions.getAll()).length;
  if (count && Number.isFinite(count)) {
    return count;
  }
  return 0;
}

const StyledDummyContactsContainer = styled.div``;

function AddDummyContactButton() {
  const [loading, setLoading] = useState(false);
  const [addedCount, setAddedCount] = useState(0);
  const [countToAdd, setCountToAdd] = useState(500);

  const { data: contactsCount } = usePolling(
    fetchContactsCountAndUpdate,
    500,
    'AddDummyContactButton'
  );

  async function doIt() {
    if (loading) {
      return;
    }
    try {
      setLoading(true);
      setAddedCount(0);
      const chunkSize = 10;
      const allIndexes = Array.from({ length: countToAdd }).map((_unused, i) => i);
      const chunks = chunk(allIndexes, chunkSize);
      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        // eslint-disable-next-line no-await-in-loop
        await Promise.all(chunks[chunkIndex].map(() => generateOneRandomContact()));
        setAddedCount(Math.min(chunkIndex * chunkSize, countToAdd));
      }
    } finally {
      setLoading(false);
      setAddedCount(0);
    }
  }

  return (
    <StyledDummyContactsContainer>
      <SimpleSessionInput
        autoFocus={false}
        type="text"
        value={`${countToAdd}`}
        onValueChanged={(value: string) => {
          const asNumber = toNumber(value);
          if (Number.isFinite(asNumber)) {
            setCountToAdd(asNumber);
          }
        }}
        disabled={loading}
        maxLength={10}
        errorDataTestId="invalid-data-testid"
        onEnterPressed={() => void doIt()}
        providedError={undefined}
      />
      <SessionButton onClick={doIt} disabled={loading}>
        {loading ? (
          <>
            {addedCount}/{countToAdd}...
          </>
        ) : (
          `Add ${countToAdd} contacts (current: ${contactsCount})`
        )}
      </SessionButton>
    </StyledDummyContactsContainer>
  );
}

export const DataGenerationActions = () => {
  return (
    <>
      <h2>Data generation</h2>
      <SpacerXS />
      <Flex
        $container={true}
        maxWidth="900px"
        $justifyContent="flex-start"
        $alignItems="flex-start"
        $flexWrap="wrap"
        $flexGap="var(--margins-lg)"
      >
        <AddDummyContactButton />
      </Flex>
      <SpacerSM />
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
    `${localize('commitHashDesktop').withArgs({ hash: window.getCommitHash() || localize('unknown').toString() })}`,
    `Libsession Hash: ${LIBSESSION_CONSTANTS.LIBSESSION_UTIL_VERSION || localize('unknown').toString()}`,
    `Libsession NodeJS Version: ${LIBSESSION_CONSTANTS.LIBSESSION_NODEJS_VERSION || localize('unknown').toString()}`,
    `Libsession NodeJS Hash: ${LIBSESSION_CONSTANTS.LIBSESSION_NODEJS_COMMIT || localize('unknown').toString()}`,
    `User Agent:${window.navigator.userAgent ? `\n\t${window.navigator.userAgent.split(') ').join(') \n\t')}` : localize('unknown').toString()}`,
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
        <CopyToClipboardIcon iconSize={'small'} copyContent={aboutInfo.join('\n')} />
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
              <CopyToClipboardIcon iconSize={'small'} copyContent={info} />
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
          <CopyToClipboardIcon iconSize={'small'} copyContent={otherInfo.value.join('\n')} />
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
                <CopyToClipboardIcon iconSize={'small'} copyContent={info} />
              </Flex>
            ))
          : null}
      </Flex>
    </Flex>
  );
};
