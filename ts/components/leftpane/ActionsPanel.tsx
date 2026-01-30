import { ipcRenderer } from 'electron';
import { useState } from 'react';

import { useSelector } from 'react-redux';
import useInterval from 'react-use/lib/useInterval';
import useTimeoutFn from 'react-use/lib/useTimeoutFn';

import useMount from 'react-use/lib/useMount';
import useThrottleFn from 'react-use/lib/useThrottleFn';
import styled from 'styled-components';
import { getAppDispatch } from '../../state/dispatch';

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
  updateKeyboardShortcutsMenuModal,
  userSettingsModal,
} from '../../state/ducks/modalDialog';

import { UserUtils } from '../../session/utils';
import { Avatar, AvatarSize } from '../avatar/Avatar';
import { SessionLucideIconButton } from '../icon/SessionIconButton';
import { LeftPaneSectionContainer } from './LeftPaneSectionContainer';

import { SnodePool } from '../../session/apis/snode_api/snodePool';
import { forceSyncConfigurationNowIfNeeded } from '../../session/utils/sync/syncUtils';
import { useFetchLatestReleaseFromFileServer } from '../../hooks/useFetchLatestReleaseFromFileServer';
import { useIsDarkTheme } from '../../state/theme/selectors/theme';
import { switchThemeTo } from '../../themes/switchTheme';
import { getOppositeTheme } from '../../util/theme';

import { useDebugMode } from '../../state/selectors/debug';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';
import { themesArray } from '../../themes/constants/colors';
import { isDebugMode, isDevProd } from '../../shared/env_vars';
import { GearAvatarButton } from '../buttons/avatar/GearAvatarButton';
import { useZoomShortcuts } from '../../hooks/useZoomingShortcut';
import { OnionStatusLight } from '../dialog/OnionStatusPathDialog';
import { AvatarReupload } from '../../session/utils/job_runners/jobs/AvatarReuploadJob';
import {
  useDebugMenuModal,
  useKeyboardShortcutsModal,
  useUserSettingsModal,
} from '../../state/selectors/modal';
import { getFeatureFlagMemo } from '../../state/ducks/types/releasedFeaturesReduxTypes';
import { useDebugKey } from '../../hooks/useDebugKey';
import { UpdateProRevocationList } from '../../session/utils/job_runners/jobs/UpdateProRevocationListJob';
import { getIsProAvailableMemo } from '../../hooks/useIsProAvailable';
import { SettingsKey } from '../../data/settings-key';
import { useKeyboardShortcut } from '../../hooks/useKeyboardShortcut';
import { KbdShortcut } from '../../util/keyboardShortcuts';
import { useNewConversationCallback } from '../buttons/MenuButton';

const StyledContainerAvatar = styled.button`
  padding: var(--margins-lg);
  position: relative;
  cursor: pointer;
  border-radius: 50%;
`;

function handleThemeSwitch() {
  const currentTheme = window.getSettingValue(SettingsKey.settingsTheme);
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
 * Small hook that ticks every minute to add a job to fetch the revocation list.
 * Note: a job will only be added if it wasn't fetched recently, so there is no harm in running this every minute.
 */
function usePeriodicFetchRevocationList() {
  const proAvailable = getIsProAvailableMemo();
  useInterval(
    () => {
      if (!proAvailable) {
        return;
      }
      void UpdateProRevocationList.queueNewJobIfNeeded();
    },
    isDevProd() ? 10 * DURATION.SECONDS : 1 * DURATION.MINUTES
  );
}

function useKeyboardShortcutsModalKeyboardShortcut() {
  const dispatch = getAppDispatch();
  const modalState = useKeyboardShortcutsModal();
  return useKeyboardShortcut(KbdShortcut.keyboardShortcutModal, () =>
    dispatch(updateKeyboardShortcutsMenuModal(modalState ? null : {}))
  );
}

function useUserSettingsModalKeyboardShortcut() {
  const dispatch = getAppDispatch();
  const modalState = useUserSettingsModal();
  return useKeyboardShortcut(KbdShortcut.userSettingsModal, () =>
    dispatch(userSettingsModal(modalState ? null : { userSettingsPage: 'default' }))
  );
}

function useNewConversationKeyboardShortcut() {
  const callback = useNewConversationCallback();
  return useKeyboardShortcut(KbdShortcut.newConversation, callback);
}

function useDebugThemeSwitch() {
  useDebugKey({
    withCtrl: true,
    key: 't',
    callback: handleThemeSwitch,
  });
}

function DebugMenuModalButton() {
  const dispatch = getAppDispatch();
  const debugMenuModalState = useDebugMenuModal();

  useDebugKey({
    withCtrl: true,
    key: 'd',
    callback: () => {
      dispatch(updateDebugMenuModal(debugMenuModalState ? null : {}));
    },
  });

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

// NOTE: [react-compiler] this has to live here for the hook to be identified as static
function useActionsPanelInternal() {
  const [startCleanUpMedia, setStartCleanUpMedia] = useState(false);
  const ourPrimaryConversation = useSelector(getOurPrimaryConversation);
  const showDebugMenu = useDebugMode();
  const ourNumber = useSelector(getOurNumber);
  const isDarkTheme = useIsDarkTheme();

  useFetchLatestReleaseFromFileServer();
  // setup our own shortcuts so that it changes show in the appearance tab too
  useZoomShortcuts();
  useInterval(
    DecryptedAttachmentsManager.cleanUpOldDecryptedMedias,
    startCleanUpMedia ? cleanUpMediasInterval : null
  );

  // wait for cleanUpMediasInterval and then start cleaning up medias
  // this would be way easier to just be able to not trigger a call with the setInterval
  useMount(() => {
    const timeout = setTimeout(() => setStartCleanUpMedia(true), cleanUpMediasInterval);

    return () => clearTimeout(timeout);
  });

  return {
    ourPrimaryConversation,
    ourNumber,
    showDebugMenu,
    isDarkTheme,
  };
}

/**
 * ActionsPanel is the far left banner (not the left pane).
 * The panel with buttons to switch between the message/contact/settings/theme views
 */
export const ActionsPanel = () => {
  const dispatch = getAppDispatch();
  const { ourPrimaryConversation, ourNumber, showDebugMenu, isDarkTheme } =
    useActionsPanelInternal();

  const fsTTL30sEnabled = getFeatureFlagMemo('fsTTL30s');
  useDebugThemeSwitch();
  useUpdateBadgeCount();
  usePeriodicFetchRevocationList();
  useKeyboardShortcutsModalKeyboardShortcut();
  useUserSettingsModalKeyboardShortcut();
  useNewConversationKeyboardShortcut();

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
    fsTTL30sEnabled ? DURATION.SECONDS * 1 : DURATION.DAYS * 1
  );

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
