import { ipcRenderer } from 'electron';
import { useState } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import useInterval from 'react-use/lib/useInterval';
import useTimeoutFn from 'react-use/lib/useTimeoutFn';

import useMount from 'react-use/lib/useMount';
import useThrottleFn from 'react-use/lib/useThrottleFn';
import styled from 'styled-components';
import { Data } from '../../data/data';
import { ConvoHub } from '../../session/conversations';

import { sectionActions, SectionType } from '../../state/ducks/section';
import {
  getOurPrimaryConversation,
  useGlobalUnreadMessageCount,
} from '../../state/selectors/conversations';
import { getOurNumber } from '../../state/selectors/user';

import { DecryptedAttachmentsManager } from '../../session/crypto/DecryptedAttachmentsManager';

import { DURATION } from '../../session/constants';

import { reuploadCurrentAvatarUs } from '../../interactions/avatar-interactions/nts-avatar-interactions';
import { updateDebugMenuModal, userSettingsModal } from '../../state/ducks/modalDialog';

import { loadDefaultRooms } from '../../session/apis/open_group_api/opengroupV2/ApiUtil';
import { getOpenGroupManager } from '../../session/apis/open_group_api/opengroupV2/OpenGroupManagerV2';
import { getSwarmPollingInstance } from '../../session/apis/snode_api';
import { UserUtils } from '../../session/utils';
import { Avatar, AvatarSize } from '../avatar/Avatar';
import {
  SessionLucideIconButton,
  type SessionLucideIconButtonProps,
} from '../icon/SessionIconButton';
import { LeftPaneSectionContainer } from './LeftPaneSectionContainer';

import { SettingsKey } from '../../data/settings-key';
import { SnodePool } from '../../session/apis/snode_api/snodePool';
import { UserSync } from '../../session/utils/job_runners/jobs/UserSyncJob';
import { forceSyncConfigurationNowIfNeeded } from '../../session/utils/sync/syncUtils';
import { useFetchLatestReleaseFromFileServer } from '../../hooks/useFetchLatestReleaseFromFileServer';
import { useHotkey } from '../../hooks/useHotkey';
import { useIsDarkTheme } from '../../state/theme/selectors/theme';
import { switchThemeTo } from '../../themes/switchTheme';
import { getOppositeTheme } from '../../util/theme';
import { getIsModalVisible } from '../../state/selectors/modal';

import { MessageQueue } from '../../session/sending';
import { useCheckReleasedFeatures } from '../../hooks/useCheckReleasedFeatures';
import { useDebugMode } from '../../state/selectors/debug';
import { networkDataActions } from '../../state/ducks/networkData';
import { searchActions } from '../../state/ducks/search';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';
import { AvatarMigrate } from '../../session/utils/job_runners/jobs/AvatarMigrateJob';
import { NetworkTime } from '../../util/NetworkTime';
import { Storage } from '../../util/storage';
import { getFileInfoFromFileServer } from '../../session/apis/file_server_api/FileServerApi';
import { themesArray } from '../../themes/constants/colors';
import { isDebugMode } from '../../shared/env_vars';
import { GearAvatarButton } from '../buttons/avatar/GearAvatarButton';
import { useZoomShortcuts } from '../../hooks/useZoomingShortcut';

const StyledContainerAvatar = styled.div`
  padding: var(--margins-lg);
  position: relative;
  cursor: pointer;
`;

function handleThemeSwitch() {
  const currentTheme = window.Events.getThemeSetting();
  let newTheme = getOppositeTheme(currentTheme);
  if (isDebugMode()) {
    // rotate over the 4 themes
    const newThemeIndex = (themesArray.indexOf(currentTheme) + 1) % themesArray.length;
    newTheme = themesArray[newThemeIndex];
  }
  // We want to persist the primary color when using the color mode button
  void switchThemeTo({
    theme: newTheme,
    mainWindow: true,
    usePrimaryColor: true,
    dispatch: window.inboxStore?.dispatch,
  });
}

const Section = (props: { type: SectionType }) => {
  const ourNumber = useSelector(getOurNumber);
  const dispatch = useDispatch();
  const { type } = props;

  const isModalVisible = useSelector(getIsModalVisible);
  const isDarkTheme = useIsDarkTheme();

  const handleClick = () => {
    if (type === SectionType.DebugMenu) {
      dispatch(updateDebugMenuModal({}));
      return;
    }
    if (type === SectionType.ThemeSwitch) {
      void handleThemeSwitch();
      return;
    }

    if (type === SectionType.Profile) {
      dispatch(userSettingsModal({ userSettingsPage: 'default' }));
      return;
    }
    // message section
    dispatch(searchActions.clearSearch());
    dispatch(sectionActions.resetLeftOverlayMode());
  };

  useHotkey('Escape', () => {
    if (!isModalVisible) {
      dispatch(searchActions.clearSearch());
      dispatch(sectionActions.resetLeftOverlayMode());
    }
  });

  if (type === SectionType.Profile) {
    return (
      <StyledContainerAvatar onClick={handleClick}>
        <Avatar
          size={AvatarSize.S}
          pubkey={ourNumber}
          dataTestId="leftpane-primary-avatar"
          imageDataTestId={`img-leftpane-primary-avatar`}
        />
        <GearAvatarButton />
      </StyledContainerAvatar>
    );
  }

  const buttonProps = {
    iconSize: 'medium',
    padding: 'var(--margins-lg)',
    onClick: handleClick,
    isSelected: false,
  } satisfies Omit<SessionLucideIconButtonProps, 'unicode' | 'dataTestId'>;

  switch (type) {
    case SectionType.DebugMenu:
      return (
        <SessionLucideIconButton
          {...buttonProps}
          unicode={LUCIDE_ICONS_UNICODE.SQUARE_CODE}
          dataTestId="debug-menu-section"
        />
      );
    case SectionType.ThemeSwitch:
    default:
      return (
        <SessionLucideIconButton
          {...buttonProps}
          margin="auto 0 0 0"
          unicode={isDarkTheme ? LUCIDE_ICONS_UNICODE.MOON : LUCIDE_ICONS_UNICODE.SUN_MEDIUM}
          dataTestId="theme-section"
        />
      );
  }
};

const cleanUpMediasInterval = DURATION.MINUTES * 60;

// Do this only if we created a new account id, or if we already received the initial configuration message
const triggerSyncIfNeeded = async () => {
  const us = UserUtils.getOurPubKeyStrFromCache();
  await ConvoHub.use().get(us).setDidApproveMe(true, true);
  await ConvoHub.use().get(us).setIsApproved(true, true);
  const didWeHandleAConfigurationMessageAlready =
    (await Data.getItemById(SettingsKey.hasSyncedInitialConfigurationItem))?.value || false;
  if (didWeHandleAConfigurationMessageAlready) {
    await forceSyncConfigurationNowIfNeeded();
  }
};

const triggerAvatarReUploadIfNeeded = async () => {
  const lastAvatarUploadExpiryMs =
    (await Data.getItemById(SettingsKey.ntsAvatarExpiryMs))?.value || Number.MAX_SAFE_INTEGER;

  if (NetworkTime.now() > lastAvatarUploadExpiryMs) {
    window.log.info('Reuploading avatar...');
    // reupload the avatar
    await reuploadCurrentAvatarUs();
  }
};

/**
 * This function is called only once: on app startup with a logged in user
 */
const doAppStartUp = async () => {
  // this generates the key to encrypt attachments locally
  await Data.generateAttachmentKeyIfEmpty();

  // trigger a sync message if needed for our other devices
  void triggerSyncIfNeeded();
  void getSwarmPollingInstance().start();
  void loadDefaultRooms();
  // eslint-disable-next-line more/no-then
  void SnodePool.getFreshSwarmFor(UserUtils.getOurPubKeyStrFromCache()).then(() => {
    // trigger any other actions that need to be done after the swarm is ready
    window.inboxStore?.dispatch(networkDataActions.fetchInfoFromSeshServer() as any);
  }); // refresh our swarm on start to speed up the first message fetching event
  void Data.cleanupOrphanedAttachments();

  // TODOLATER make this a job of the JobRunner
  // Note: do not make this a debounce call (as for some reason it doesn't work with promises)
  void triggerAvatarReUploadIfNeeded();

  /* Postpone a little bit of the polling of sogs messages to let the swarm messages come in first. */
  global.setTimeout(() => {
    void getOpenGroupManager().startPolling();
  }, 10000);

  global.setTimeout(() => {
    // init the messageQueue. In the constructor, we add all not send messages
    // this call does nothing except calling the constructor, which will continue sending message in the pipeline
    void MessageQueue.use().processAllPending();
  }, 3000);

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  global.setTimeout(async () => {
    // Schedule a confSyncJob in some time to let anything incoming from the network be applied and see if there is a push needed
    // Note: this also starts periodic jobs, so we don't need to keep doing it
    await UserSync.queueNewJobIfNeeded();

    // on app startup, check that the avatar expiry on the file server
    const avatarPointer = ConvoHub.use()
      .get(UserUtils.getOurPubKeyStrFromCache())
      .getAvatarPointer();
    if (avatarPointer) {
      const details = await getFileInfoFromFileServer(avatarPointer);
      if (details?.expiryMs) {
        await Storage.put(SettingsKey.ntsAvatarExpiryMs, details.expiryMs);
      }
    }
  }, 20000);

  global.setTimeout(() => {
    // Schedule all avatarMigrateJobs in some time to let anything incoming from the network be handled first
    void AvatarMigrate.scheduleAllAvatarMigrateJobs();
  }, 1 * DURATION.MINUTES);
};

function useUpdateBadgeCount() {
  const globalUnreadMessageCount = useGlobalUnreadMessageCount();

  // Reuse the unreadToShow from the global state to update the badge count
  // Note: useThrottleFn from react-use will run execute trailing edge too.
  useThrottleFn(
    (unreadCount: number) => {
      if (unreadCount !== undefined) {
        ipcRenderer.send('update-badge-count', unreadCount);
      }
    },
    2000,
    [globalUnreadMessageCount]
  );
}

/**
 * ActionsPanel is the far left banner (not the left pane).
 * The panel with buttons to switch between the message/contact/settings/theme views
 */
export const ActionsPanel = () => {
  const [startCleanUpMedia, setStartCleanUpMedia] = useState(false);
  const ourPrimaryConversation = useSelector(getOurPrimaryConversation);
  const showDebugMenu = useDebugMode();

  // this useMount is called only once: when the component is mounted.
  // For the action panel, it means this is called only one per app start/with a user logged in
  useMount(() => {
    void doAppStartUp();
  });

  // wait for cleanUpMediasInterval and then start cleaning up medias
  // this would be way easier to just be able to not trigger a call with the setInterval
  useMount(() => {
    const timeout = setTimeout(() => setStartCleanUpMedia(true), cleanUpMediasInterval);

    return () => clearTimeout(timeout);
  });

  useUpdateBadgeCount();
  // setup our own shortcuts so that it changes show in the appearance tab too
  useZoomShortcuts();

  useInterval(
    DecryptedAttachmentsManager.cleanUpOldDecryptedMedias,
    startCleanUpMedia ? cleanUpMediasInterval : null
  );

  useFetchLatestReleaseFromFileServer();

  useInterval(() => {
    if (!ourPrimaryConversation) {
      return;
    }
    void forceSyncConfigurationNowIfNeeded();
  }, DURATION.DAYS * 2);

  useInterval(() => {
    if (!ourPrimaryConversation) {
      return;
    }

    // trigger an updates from the snodes and swarm every hour
    void SnodePool.forceRefreshRandomSnodePool();
    void SnodePool.getFreshSwarmFor(UserUtils.getOurPubKeyStrFromCache());
  }, DURATION.HOURS * 1);

  useTimeoutFn(() => {
    if (!ourPrimaryConversation) {
      return;
    }
    // trigger an updates from the snodes after 5 minutes, once
    void SnodePool.forceRefreshRandomSnodePool();
  }, DURATION.MINUTES * 5);

  useInterval(
    () => {
      if (!ourPrimaryConversation) {
        return;
      }
      // this won't be run every days, but if the app stays open for more than 10 days
      void triggerAvatarReUploadIfNeeded();
    },
    window.sessionFeatureFlags.fsTTL30s ? DURATION.SECONDS * 1 : DURATION.DAYS * 1
  );

  useCheckReleasedFeatures();

  if (!ourPrimaryConversation) {
    window?.log?.warn('ActionsPanel: ourPrimaryConversation is not set');
    return null;
  }

  return (
    <>
      <LeftPaneSectionContainer data-testid="leftpane-section-container">
        <Section type={SectionType.Profile} />
        {showDebugMenu && <Section type={SectionType.DebugMenu} />}
        <Section type={SectionType.ThemeSwitch} />
      </LeftPaneSectionContainer>
    </>
  );
};
