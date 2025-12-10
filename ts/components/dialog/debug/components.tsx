import { base64_variants, from_hex, to_base64 } from 'libsodium-wrappers-sumo';
import useAsync from 'react-use/lib/useAsync';
import { ipcRenderer, shell } from 'electron';
import { useCallback, useState } from 'react';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import useInterval from 'react-use/lib/useInterval';
import { filesize } from 'filesize';
import styled from 'styled-components';

import type { ProProof, PubkeyType } from 'libsession_util_nodejs';
import { chunk, toNumber } from 'lodash';
import { getAppDispatch } from '../../../state/dispatch';
import { Flex } from '../../basic/Flex';
import { SpacerXS } from '../../basic/Text';
import { tr } from '../../../localization/localeTools';
import { CopyToClipboardIcon } from '../../buttons';
import { Localizer } from '../../basic/Localizer';
import {
  SessionButton,
  SessionButtonColor,
  SessionButtonProps,
  SessionButtonShape,
} from '../../basic/SessionButton';
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
import {
  ContactsWrapperActions,
  UserConfigWrapperActions,
} from '../../../webworker/workers/browser/libsession_worker_interface';
import { usePolling } from '../../../hooks/usePolling';
import { releasedFeaturesActions } from '../../../state/ducks/releasedFeatures';
import { networkDataActions } from '../../../state/ducks/networkData';
import { DEBUG_MENU_PAGE, DebugMenuSection, type DebugMenuPageProps } from './DebugMenuModal';
import { SimpleSessionInput } from '../../inputs/SessionInput';
import { NetworkTime } from '../../../util/NetworkTime';
import { SessionButtonShiny } from '../../basic/SessionButtonShiny';
import ProBackendAPI from '../../../session/apis/pro_backend_api/ProBackendAPI';
import { getProMasterKeyHex } from '../../../session/utils/User';
import { FlagToggle } from './FeatureFlags';
import { getFeatureFlag } from '../../../state/ducks/types/releasedFeaturesReduxTypes';
import {
  clearAllUrlInteractions,
  getUrlInteractions,
  removeUrlInteractionHistory,
  urlInteractionToString,
} from '../../../util/urlHistory';
import { formatRoundedUpTimeUntilTimestamp } from '../../../util/i18n/formatting/generics';
import { LucideIcon } from '../../icon/LucideIcon';
import { LUCIDE_ICONS_UNICODE } from '../../icon/lucide';
import { useIsProAvailable } from '../../../hooks/useIsProAvailable';

type DebugButtonProps = SessionButtonProps & { shiny?: boolean; hide?: boolean };

export function DebugButton({ shiny = true, style: _style, hide, ...rest }: DebugButtonProps) {
  if (hide) {
    return null;
  }

  const style = { minWidth: 'max-content', width: '48%', ..._style };

  if (shiny) {
    return (
      <SessionButtonShiny
        shinyContainerStyle={style}
        buttonColor={SessionButtonColor.PrimaryDark}
        buttonShape={SessionButtonShape.Square}
        {...rest}
      />
    );
  }

  return <SessionButton style={style} buttonShape={SessionButtonShape.Square} {...rest} />;
}

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
  created.setActiveAt(Date.now());
  await created.setIsApproved(true, false);
  await created.setSessionProfile({
    type: 'displayNameChangeOnlyPrivate',
    displayName: id.slice(2, 8),
    profileUpdatedAtSeconds: NetworkTime.nowSeconds(),
  });

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
    <DebugButton
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
    </DebugButton>
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
    <DebugButton
      onClick={() => {
        void handleCheckForUpdates();
      }}
    >
      <SessionSpinner loading={state.loading} color={'var(--text-primary-color)'} />
      {!state.loading ? 'Check for updates' : null}
    </DebugButton>
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
    <DebugButton
      onClick={() => {
        void handleDeleteAllLogs();
      }}
    >
      Clear old logs {filesize(logSize)}
    </DebugButton>
  );
};

function OfflineButton() {
  const [isOnline, setIsOnline] = useState(window.isOnline);

  return (
    <DebugButton
      onClick={() => {
        window.isOnline = !isOnline;
        setIsOnline(!isOnline);
        window.log.warn(`[debugMenu] OfflineButton: Going ${isOnline ? 'offline' : 'online'}`);
      }}
    >
      Go {isOnline ? 'offline' : 'online'}
    </DebugButton>
  );
}

export const LoggingDebugSection = ({ forceUpdate }: { forceUpdate: () => void }) => {
  return (
    <DebugMenuSection title="Logging">
      <DebugButton
        onClick={() => {
          void saveLogToDesktop();
        }}
      >
        <Localizer token="helpReportABugExportLogs" />
      </DebugButton>
      <ClearOldLogsButton />
      <FlagToggle forceUpdate={forceUpdate} flag="debugLogging" />
      <FlagToggle forceUpdate={forceUpdate} flag="debugLibsessionDumps" />
      <FlagToggle forceUpdate={forceUpdate} flag="debugBuiltSnodeRequests" />
      <FlagToggle forceUpdate={forceUpdate} flag="debugSwarmPolling" />
      <FlagToggle forceUpdate={forceUpdate} flag="debugServerRequests" />
      <FlagToggle forceUpdate={forceUpdate} flag="debugNonSnodeRequests" />
      <FlagToggle forceUpdate={forceUpdate} flag="debugOnionRequests" />
      <FlagToggle forceUpdate={forceUpdate} flag="debugOnionPaths" />
      <FlagToggle forceUpdate={forceUpdate} flag="debugSnodePool" />
      <FlagToggle forceUpdate={forceUpdate} flag="debugOnlineState" />
      <FlagToggle forceUpdate={forceUpdate} flag="debugInsecureNodeFetch" />
      <i>"Debug Insecure Node Fetch" will log every single request/response!</i>
    </DebugMenuSection>
  );
};

export const Playgrounds = ({ setPage }: DebugMenuPageProps) => {
  const proAvailable = useIsProAvailable();

  if (!proAvailable) {
    return null;
  }

  return (
    <DebugMenuSection title="Playgrounds" rowWrap={true}>
      <DebugButton onClick={() => setPage(DEBUG_MENU_PAGE.Pro)}>Pro Playground</DebugButton>
      <DebugButton onClick={() => setPage(DEBUG_MENU_PAGE.POPOVER)}>Popover Playground</DebugButton>
    </DebugMenuSection>
  );
};

export const DebugActions = () => {
  const dispatch = getAppDispatch();
  const proAvailable = useIsProAvailable();

  return (
    <DebugMenuSection title="Actions" rowWrap={true}>
      <DebugButton
        buttonColor={SessionButtonColor.Danger}
        onClick={() => {
          dispatch(setDebugMode(false));
          dispatch(updateDebugMenuModal(null));
        }}
      >
        Exit Debug Mode
      </DebugButton>
      <OfflineButton />
      {window.getCommitHash() ? (
        <DebugButton
          onClick={() => {
            void shell.openExternal(
              `https://github.com/session-foundation/session-desktop/commit/${window.getCommitHash()}`
            );
          }}
        >
          Go to commit
        </DebugButton>
      ) : null}
      <DebugButton
        onClick={() => {
          void shell.openExternal(
            `https://github.com/session-foundation/session-desktop/releases/tag/v${window.getVersion()}`
          );
        }}
      >
        <Localizer token="updateReleaseNotes" />
      </DebugButton>
      <CheckForUpdatesButton />
      <CheckVersionButton channelToCheck="stable" />
      <CheckVersionButton channelToCheck="alpha" />
      <DebugButton
        onClick={async () => {
          const storageProfile = await ipcRenderer.invoke('get-storage-profile');
          void shell.openPath(storageProfile);
        }}
      >
        Open storage profile
      </DebugButton>
      <DebugButton
        hide={!proAvailable}
        onClick={async () => {
          const masterPrivKeyHex = await getProMasterKeyHex();
          const rotatingPrivKeyHex = await UserUtils.getProRotatingPrivateKeyHex();
          const response = await ProBackendAPI.generateProProof({
            masterPrivKeyHex,
            rotatingPrivKeyHex,
          });
          if (getFeatureFlag('debugServerRequests')) {
            window?.log?.debug('getProProof response: ', response);
          }
          if (response?.status_code === 200) {
            const proProof: ProProof = {
              expiryMs: response.result.expiry_unix_ts_ms,
              genIndexHashB64: to_base64(
                from_hex(response.result.gen_index_hash),
                base64_variants.ORIGINAL
              ),
              rotatingPubkeyHex: response.result.rotating_pkey,
              version: response.result.version,
              signatureHex: response.result.sig,
            };
            await UserConfigWrapperActions.setProConfig({ proProof, rotatingPrivKeyHex });
          }
        }}
      >
        Get Pro Proof
      </DebugButton>
      <DebugButton
        hide={!proAvailable}
        onClick={async () => {
          const masterPrivKeyHex = await getProMasterKeyHex();
          const response = await ProBackendAPI.getProDetails({ masterPrivKeyHex });
          if (getFeatureFlag('debugServerRequests')) {
            window?.log?.debug('Pro Details: ', response);
          }
        }}
      >
        Get Pro Details
      </DebugButton>
      <DebugButton
        hide={!proAvailable}
        onClick={async () => {
          const response = await ProBackendAPI.getRevocationList({ ticket: 0 });
          if (getFeatureFlag('debugServerRequests')) {
            window?.log?.debug('Pro Revocation List: ', response);
          }
        }}
      >
        Get Pro Revocation List (from ticket 0)
      </DebugButton>
    </DebugMenuSection>
  );
};

export const DebugUrlInteractionsSection = () => {
  const [urlInteractions, setUrlInteractions] = useState(getUrlInteractions());

  const refresh = useCallback(() => setUrlInteractions(getUrlInteractions()), []);
  const removeUrl = useCallback(
    async (url: string) => {
      await removeUrlInteractionHistory(url);
      refresh();
    },
    [refresh]
  );
  const clearAll = useCallback(async () => {
    await clearAllUrlInteractions();
    refresh();
  }, [refresh]);

  return (
    <DebugMenuSection title="Url Interactions">
      <DebugButton onClick={clearAll} buttonColor={SessionButtonColor.Danger}>
        Clear All
      </DebugButton>
      <DebugButton onClick={refresh}>Refresh</DebugButton>
      <table>
        <tr>
          <th>URL</th>
          <th>Interactions</th>
          <th>Last Updated</th>
        </tr>
        {urlInteractions.map(({ url, interactions, lastUpdated }) => {
          const updatedStr = formatRoundedUpTimeUntilTimestamp(lastUpdated);
          return (
            <tr key={url}>
              <td>{url}</td> <td>{interactions.map(urlInteractionToString).join(', ')}</td>{' '}
              <td>{updatedStr}</td>{' '}
              <td>
                <DebugButton
                  buttonColor={SessionButtonColor.Danger}
                  onClick={async () => removeUrl(url)}
                >
                  <LucideIcon unicode={LUCIDE_ICONS_UNICODE.TRASH2} iconSize="small" />
                </DebugButton>
              </td>
            </tr>
          );
        })}
      </table>
    </DebugMenuSection>
  );
};

export const ExperimentalActions = ({ forceUpdate }: { forceUpdate: () => void }) => {
  const dispatch = getAppDispatch();
  // const refreshedAt = useReleasedFeaturesRefreshedAt();
  // const sesh101NotificationAt = useSesh101NotificationAt();

  // const [countdown, setCountdown] = useState(false);
  // const timeLeftMs = sesh101NotificationAt - Date.now();

  // TODO [SES-2606] uncomment before release but after QA
  // if (!isDebugMode()) {
  //   return null;
  // }

  return (
    <DebugMenuSection title="Experimental Actions 🚨" rowWrap={true}>
      <DebugButton
        onClick={() => {
          dispatch(releasedFeaturesActions.resetExperiments() as any);
          forceUpdate();
        }}
      >
        Reset experiments
      </DebugButton>

      {/* <SessionButton
          onClick={() => {
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
        </SessionButton> */}
      <DebugButton
        onClick={() => {
          dispatch(networkDataActions.fetchInfoFromSeshServer() as any);
        }}
      >
        Network Info Request (Force)
      </DebugButton>
    </DebugMenuSection>
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
      <DebugButton onClick={doIt} disabled={loading}>
        {loading ? (
          <>
            {addedCount}/{countToAdd}...
          </>
        ) : (
          `Add ${countToAdd} contacts (current: ${contactsCount})`
        )}
      </DebugButton>
    </StyledDummyContactsContainer>
  );
}

export const DataGenerationActions = () => {
  return (
    <DebugMenuSection title="Data generation">
      <AddDummyContactButton />
    </DebugMenuSection>
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
    `${tr('updateVersion', { version: window.getVersion() })}`,
    `${tr('systemInformationDesktop', { information: window.getOSRelease() })}`,
    `${tr('commitHashDesktop', { hash: window.getCommitHash() || tr('unknown') })}`,
    `Libsession Hash: ${LIBSESSION_CONSTANTS.LIBSESSION_UTIL_VERSION || tr('unknown')}`,
    `Libsession NodeJS Version: ${LIBSESSION_CONSTANTS.LIBSESSION_NODEJS_VERSION || tr('unknown')}`,
    `Libsession NodeJS Hash: ${LIBSESSION_CONSTANTS.LIBSESSION_NODEJS_COMMIT || tr('unknown')}`,
    `User Agent:${window.navigator.userAgent ? `\n\t${window.navigator.userAgent.split(') ').join(') \n\t')}` : tr('unknown')}`,
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
        <CopyToClipboardIcon
          iconSize={'small'}
          copyContent={aboutInfo.join('\n')}
          buttonColor={SessionButtonColor.None}
        />
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
              <CopyToClipboardIcon
                iconSize={'small'}
                copyContent={info}
                buttonColor={SessionButtonColor.None}
              />
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
    const proMasterKey = await getProMasterKeyHex();
    const result = [
      `${tr('accountIdYours')}: ${id}`,
      `VBID: ${vbid}`,
      `Pro Public Master Key: ${proMasterKey?.slice(64)}`,
      `Pro Private Master Key: ${proMasterKey?.slice(0, 64)}`,
    ];
    return result;
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
          <CopyToClipboardIcon
            iconSize={'small'}
            copyContent={otherInfo.value.join('\n')}
            buttonColor={SessionButtonColor.None}
          />
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
          <p>{tr('loading')}</p>
        ) : otherInfo.error ? (
          <p style={{ color: 'var(--danger-color)', userSelect: 'text' }}>
            {tr('theError')}: {otherInfo.error.message || tr('errorUnknown')}
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
                <p
                  style={{
                    userSelect: 'text',
                    lineHeight: 1.5,
                    fontSize: 'var(--font-size-small)',
                  }}
                >
                  {info}
                </p>
                <CopyToClipboardIcon
                  iconSize={'small'}
                  copyContent={info}
                  buttonColor={SessionButtonColor.None}
                />
              </Flex>
            ))
          : null}
      </Flex>
    </Flex>
  );
};
