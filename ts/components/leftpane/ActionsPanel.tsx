import { ipcRenderer } from 'electron';
import { useState } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import useInterval from 'react-use/lib/useInterval';
import useTimeoutFn from 'react-use/lib/useTimeoutFn';
import useKey from 'react-use/lib/useKey';

import useMount from 'react-use/lib/useMount';
import useThrottleFn from 'react-use/lib/useThrottleFn';
import styled from 'styled-components';
import { Data } from '../../data/data';
import { ConvoHub } from '../../session/conversations';

import {
  getOurPrimaryConversation,
  useGlobalUnreadMessageCount,
} from '../../state/selectors/conversations';
import { getOurNumber } from '../../state/selectors/user';

import { DecryptedAttachmentsManager } from '../../session/crypto/DecryptedAttachmentsManager';

import { DURATION } from '../../session/constants';

import {
  onionPathModal,
  updateDebugMenuModal,
  userSettingsModal,
} from '../../state/ducks/modalDialog';

import { loadDefaultRooms } from '../../session/apis/open_group_api/opengroupV2/ApiUtil';
import { getOpenGroupManager } from '../../session/apis/open_group_api/opengroupV2/OpenGroupManagerV2';
import { getSwarmPollingInstance } from '../../session/apis/snode_api';
import { UserUtils } from '../../session/utils';
import { Avatar, AvatarSize } from '../avatar/Avatar';
import { SessionLucideIconButton } from '../icon/SessionIconButton';
import { LeftPaneSectionContainer } from './LeftPaneSectionContainer';

import { SettingsKey } from '../../data/settings-key';
import { SnodePool } from '../../session/apis/snode_api/snodePool';
import { UserSync } from '../../session/utils/job_runners/jobs/UserSyncJob';
import { forceSyncConfigurationNowIfNeeded } from '../../session/utils/sync/syncUtils';
import { useFetchLatestReleaseFromFileServer } from '../../hooks/useFetchLatestReleaseFromFileServer';
import { useIsDarkTheme } from '../../state/theme/selectors/theme';
import { switchThemeTo } from '../../themes/switchTheme';
import { getOppositeTheme } from '../../util/theme';

import { MessageQueue } from '../../session/sending';
import { useCheckReleasedFeatures } from '../../hooks/useCheckReleasedFeatures';
import { useDebugMode } from '../../state/selectors/debug';
import { networkDataActions } from '../../state/ducks/networkData';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';
import { AvatarMigrate } from '../../session/utils/job_runners/jobs/AvatarMigrateJob';
import { Storage } from '../../util/storage';
import { themesArray } from '../../themes/constants/colors';
import { isDebugMode, isDevProd } from '../../shared/env_vars';
import { GearAvatarButton } from '../buttons/avatar/GearAvatarButton';
import { useZoomShortcuts } from '../../hooks/useZoomingShortcut';
import { OnionStatusLight } from '../dialog/OnionStatusPathDialog';
import { AvatarReupload } from '../../session/utils/job_runners/jobs/AvatarReuploadJob';
import { useDebugMenuModal } from '../../state/selectors/modal';

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

  // Note: do not make this a debounce call (as for some reason it doesn't work with promises)
  await AvatarReupload.addAvatarReuploadJob();

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
  }, 20000);

  global.setTimeout(() => {
    // Schedule all avatarMigrateJobs in some time to let anything incoming from the network be handled first
    void AvatarMigrate.scheduleAllAvatarMigrateJobs();
  }, 1 * DURATION.MINUTES);

  void regenerateLastMessagesGroupsCommunities();
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

function useDebugThemeSwitch() {
  useKey(
    (event: KeyboardEvent) => {
      return event.ctrlKey && event.key === 't';
    },
    () => {
      if (isDevProd()) {
        void handleThemeSwitch();
      }
    }
  );
}

/**
 * We only need to regenerate the last message of groups/communities once,
 * and we can remove it in a few months safely
 */
async function regenerateLastMessagesGroupsCommunities() {
  if (Storage.getBoolOr(SettingsKey.lastMessageGroupsRegenerated, false)) {
    return; // already regenerated once
  }

  ConvoHub.use()
    .getConversations()
    .filter(m => m.isClosedGroupV2() || m.isPublic())
    .forEach(m => {
      m.updateLastMessage();
    });
  await Storage.put(SettingsKey.lastMessageGroupsRegenerated, true);
}

function DebugMenuModalButton() {
  const dispatch = useDispatch();
  const debugMenuModalState = useDebugMenuModal();

  useKey(
    (event: KeyboardEvent) => {
      return event.ctrlKey && event.key === 'd';
    },
    () => {
      if (isDevProd()) {
        dispatch(updateDebugMenuModal(debugMenuModalState ? null : {}));
      }
    }
  );

  return (
    <SessionLucideIconButton
      iconSize="medium"
      padding="var(--margins-lg)"
      unicode={LUCIDE_ICONS_UNICODE.SQUARE_CODE}
      dataTestId="debug-menu-section"
      onClick={() => {
        dispatch(updateDebugMenuModal({}));
      }}
    />
  );
}

/**
 * ActionsPanel is the far left banner (not the left pane).
 * The panel with buttons to switch between the message/contact/settings/theme views
 */
export const ActionsPanel = () => {
  const dispatch = useDispatch();
  const [startCleanUpMedia, setStartCleanUpMedia] = useState(false);
  const ourPrimaryConversation = useSelector(getOurPrimaryConversation);
  const showDebugMenu = useDebugMode();
  const ourNumber = useSelector(getOurNumber);
  const isDarkTheme = useIsDarkTheme();
  useDebugThemeSwitch();

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
      void AvatarReupload.addAvatarReuploadJob();
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
        <StyledContainerAvatar
          onClick={() => {
            dispatch(userSettingsModal({ userSettingsPage: 'default' }));
          }}
        >
          <Avatar
            size={AvatarSize.S}
            pubkey={ourNumber}
            dataTestId="leftpane-primary-avatar"
            imageDataTestId={`img-leftpane-primary-avatar`}
          />
          <GearAvatarButton />
        </StyledContainerAvatar>
        {showDebugMenu ? <DebugMenuModalButton /> : null}
        <OnionStatusLight
          handleClick={() => {
            dispatch(onionPathModal({}));
          }}
          inActionPanel={true}
        />
        <SessionLucideIconButton
          margin="0 0 0 0"
          iconSize="medium"
          padding="var(--margins-lg)"
          unicode={isDarkTheme ? LUCIDE_ICONS_UNICODE.MOON : LUCIDE_ICONS_UNICODE.SUN_MEDIUM}
          dataTestId="theme-section"
          onClick={() => {
            void handleThemeSwitch();
          }}
        />
      </LeftPaneSectionContainer>
    </>
  );
};
