import { type RefObject, useRef, useState } from 'react';
import styled from 'styled-components';
import useMount from 'react-use/lib/useMount';
import { getAppDispatch } from '../../../../state/dispatch';
import { useHotkey } from '../../../../hooks/useHotkey';
import { useOurConversationUsername, useOurAvatarPath } from '../../../../hooks/useParamSelector';
import { UserUtils, ToastUtils } from '../../../../session/utils';
import { resetConversationExternal } from '../../../../state/ducks/conversations';
import {
  onionPathModal,
  updateConversationDetailsModal,
  userSettingsModal,
  updateDeleteAccountModal,
  UserSettingsModalState,
} from '../../../../state/ducks/modalDialog';
import { networkDataActions } from '../../../../state/ducks/networkData';
import { sectionActions } from '../../../../state/ducks/section';
import { AccountIdPill } from '../../../basic/AccountIdPill';
import { Flex } from '../../../basic/Flex';
import { SessionIDNotEditable } from '../../../basic/SessionIdNotEditable';
import { PanelButtonGroup, PanelIconButton } from '../../../buttons';
import { ProIconButton } from '../../../buttons/ProButton';
import { type SessionIconProps, SessionIcon } from '../../../icon';
import { LUCIDE_ICONS_UNICODE } from '../../../icon/lucide';
import { type LucideIconProps, LucideIcon } from '../../../icon/LucideIcon';
import { SessionIconButton, SessionLucideIconButton } from '../../../icon/SessionIconButton';
import { QRView } from '../../../qrview/QrView';
import { ModalBasicHeader } from '../../../SessionWrapperModal';
import { showLinkVisitWarningDialog } from '../../OpenUrlModal';
import { ModalPencilIcon } from '../../shared/ModalPencilButton';
import { ProfileHeader, ProfileName } from '../components';
import type { ProfileDialogModes } from '../ProfileDialogModes';
import { tr } from '../../../../localization/localeTools';
import { getIsProAvailableMemo } from '../../../../hooks/useIsProAvailable';
import { setDebugMode } from '../../../../state/ducks/debug';
import { useHideRecoveryPasswordEnabled } from '../../../../state/selectors/settings';
import { OnionStatusLight } from '../../OnionStatusPathDialog';
import { UserSettingsModalContainer } from '../components/UserSettingsModalContainer';
import { useCurrentUserHasExpiredPro, useCurrentUserHasPro } from '../../../../hooks/useHasPro';
import { NetworkTime } from '../../../../util/NetworkTime';
import { APP_URL, DURATION_SECONDS } from '../../../../session/constants';
import { getFeatureFlag } from '../../../../state/ducks/types/releasedFeaturesReduxTypes';
import { useUserSettingsCloseAction } from './userSettingsHooks';
import {
  useProBackendProDetails,
  useProBackendRefetch,
} from '../../../../state/selectors/proBackendData';

const handleKeyQRMode = (mode: ProfileDialogModes, setMode: (mode: ProfileDialogModes) => void) => {
  switch (mode) {
    case 'default':
      setMode('qr');
      break;
    case 'qr':
      setMode('default');
      break;
    default:
  }
};

const handleKeyCancel = (
  mode: ProfileDialogModes,
  setMode: (mode: ProfileDialogModes) => void,
  inputRef: RefObject<HTMLInputElement | null>
) => {
  switch (mode) {
    case 'qr':
      if (inputRef.current !== null && document.activeElement === inputRef.current) {
        return;
      }
      setMode('default');
      break;
    case 'default':
    default:
  }
};

function SessionIconForSettings(props: Omit<SessionIconProps, 'iconSize' | 'style'>) {
  return (
    <SessionIcon
      iconColor="var(--text-primary-color)"
      style={{ width: 'var(--user-settings-icon-min-width)' }}
      {...props}
      iconSize="large"
    />
  );
}

function LucideIconForSettings(props: Omit<LucideIconProps, 'iconSize' | 'style'>) {
  return (
    <LucideIcon
      iconColor="var(--text-primary-color)"
      style={{ width: 'var(--user-settings-icon-min-width)' }}
      {...props}
      iconSize="large"
    />
  );
}

function SessionProSection() {
  const dispatch = getAppDispatch();

  const isProAvailable = getIsProAvailableMemo();
  const userHasPro = useCurrentUserHasPro();
  const currentUserHasExpiredPro = useCurrentUserHasExpiredPro();

  if (!isProAvailable) {
    return null;
  }

  return (
    <PanelButtonGroup>
      <PanelIconButton
        iconElement={
          <div style={{ width: 'var(--user-settings-icon-min-width)' }}>
            <ProIconButton onClick={undefined} iconSize="small" dataTestId="invalid-data-testid" />
          </div>
        }
        text={{
          token: userHasPro
            ? 'sessionProBeta'
            : currentUserHasExpiredPro
              ? 'proRenewBeta'
              : 'upgradeSession',
        }}
        onClick={() => {
          dispatch(userSettingsModal({ userSettingsPage: 'pro' }));
        }}
        dataTestId="session-pro-settings-menu-item"
        color="var(--renderer-span-primary-color)"
      />
    </PanelButtonGroup>
  );
}

function MiscSection() {
  const dispatch = getAppDispatch();
  return (
    <PanelButtonGroup>
      <PanelIconButton
        iconElement={
          <LucideIconForSettings
            iconColor="var(--renderer-span-primary-color)"
            unicode={LUCIDE_ICONS_UNICODE.HEART}
          />
        }
        text={{ token: 'donate' }}
        onClick={() => {
          showLinkVisitWarningDialog(APP_URL.DONATE, dispatch);
        }}
        dataTestId="donate-settings-menu-item"
      />
      <PanelIconButton
        iconElement={
          <div style={{ width: 'var(--user-settings-icon-min-width)' }}>
            <OnionStatusLight inActionPanel={false} handleClick={undefined} />
          </div>
        }
        text={{ token: 'onionRoutingPath' }}
        onClick={() => {
          dispatch(onionPathModal({}));
        }}
        dataTestId="path-light-container"
      />
      <PanelIconButton
        iconElement={<SessionIconForSettings iconType="sessionToken" />}
        text={{ token: 'networkName' }}
        onClick={() => {
          // do a refresh request on open
          dispatch(networkDataActions.refreshInfoFromSeshServer() as any);
          dispatch(userSettingsModal({ userSettingsPage: 'network' }));
        }}
        dataTestId="session-network-settings-menu-item"
      />
    </PanelButtonGroup>
  );
}

function SettingsSection() {
  const dispatch = getAppDispatch();

  return (
    <PanelButtonGroup>
      <PanelIconButton
        iconElement={<LucideIconForSettings unicode={LUCIDE_ICONS_UNICODE.LOCK_KEYHOLE} />}
        text={{ token: 'sessionPrivacy' }}
        onClick={() => {
          dispatch(userSettingsModal({ userSettingsPage: 'privacy' }));
        }}
        dataTestId="privacy-settings-menu-item"
      />
      <PanelIconButton
        iconElement={<LucideIconForSettings unicode={LUCIDE_ICONS_UNICODE.VOLUME_2} />}
        text={{ token: 'sessionNotifications' }}
        onClick={() => {
          dispatch(userSettingsModal({ userSettingsPage: 'notifications' }));
        }}
        dataTestId="notifications-settings-menu-item"
      />
      <PanelIconButton
        iconElement={<LucideIconForSettings unicode={LUCIDE_ICONS_UNICODE.MESSAGE_SQUARE} />}
        text={{ token: 'sessionConversations' }}
        onClick={() => {
          dispatch(userSettingsModal({ userSettingsPage: 'conversations' }));
        }}
        dataTestId="conversations-settings-menu-item"
      />
      <PanelIconButton
        iconElement={<LucideIconForSettings unicode={LUCIDE_ICONS_UNICODE.PAINTBRUSH_VERTICAL} />}
        text={{ token: 'sessionAppearance' }}
        onClick={() => {
          dispatch(userSettingsModal({ userSettingsPage: 'appearance' }));
        }}
        dataTestId="appearance-settings-menu-item"
      />
      <PanelIconButton
        iconElement={
          <LucideIconForSettings unicode={LUCIDE_ICONS_UNICODE.MESSAGE_SQUARE_WARNING} />
        }
        text={{ token: 'sessionMessageRequests' }}
        onClick={() => {
          dispatch(sectionActions.setLeftOverlayMode('message-requests'));
          dispatch(userSettingsModal(null));
          dispatch(resetConversationExternal());
        }}
        dataTestId="message-requests-settings-menu-item"
      />
      <PanelIconButton
        iconElement={<LucideIconForSettings unicode={LUCIDE_ICONS_UNICODE.SETTINGS} />}
        text={{ token: 'preferences' }}
        onClick={() => {
          dispatch(userSettingsModal({ userSettingsPage: 'preferences' }));
        }}
        dataTestId="preferences-settings-menu-item"
      />
    </PanelButtonGroup>
  );
}

function AdminSection() {
  const dispatch = getAppDispatch();
  const recoveryPasswordHidden = useHideRecoveryPasswordEnabled();

  return (
    <PanelButtonGroup>
      {!recoveryPasswordHidden ? (
        <PanelIconButton
          iconElement={<SessionIconForSettings iconType="recoveryPasswordFill" />}
          text={{ token: 'sessionRecoveryPassword' }}
          onClick={() => {
            dispatch(userSettingsModal({ userSettingsPage: 'recovery-password' }));
          }}
          dataTestId="recovery-password-settings-menu-item"
        />
      ) : null}
      <PanelIconButton
        iconElement={<SessionIconForSettings iconType="questionNoCircle" />}
        text={{ token: 'sessionHelp' }}
        onClick={() => {
          dispatch(userSettingsModal({ userSettingsPage: 'help' }));
        }}
        dataTestId="help-settings-menu-item"
      />
      <PanelIconButton
        iconElement={
          <LucideIconForSettings
            unicode={LUCIDE_ICONS_UNICODE.TRASH2}
            iconColor="var(--danger-color)"
          />
        }
        text={{ token: 'sessionClearData' }}
        onClick={() => {
          dispatch(updateDeleteAccountModal({}));
        }}
        dataTestId="clear-data-settings-menu-item"
        color="var(--danger-color)"
      />
    </PanelButtonGroup>
  );
}

const StyledVersionInfo = styled.div`
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: var(--margins-xs);
  background: none;
  font-size: var(--font-size-sm);
`;

const StyledSpanSessionInfo = styled.span<{ opacity?: number }>`
  opacity: ${props => props.opacity ?? 0.5};
  transition: var(--default-duration);
  user-select: text;
  cursor: pointer;

  &:hover {
    opacity: 1;
  }
`;

const SessionInfo = () => {
  const [clickCount, setClickCount] = useState(0);

  const dispatch = getAppDispatch();

  return (
    <StyledVersionInfo>
      <SessionIconButton
        iconSize="medium"
        iconType="sessionTokenLogoWithText"
        onClick={() => {
          showLinkVisitWarningDialog('https://token.getsession.org/', dispatch);
        }}
        // disable transition here as the transition does the opposite that usual (hovering makes it more opaque/bright)
        style={{ transition: 'none' }}
      />
      <Flex
        $container={true}
        $flexDirection="row"
        $alignItems="center"
        $flexGap="var(--margins-sm)"
      >
        <StyledSpanSessionInfo
          onClick={() => {
            showLinkVisitWarningDialog(
              `https://github.com/session-foundation/session-desktop/releases/tag/v${window.versionInfo.version}`,
              dispatch
            );
          }}
        >
          v{window.versionInfo.version}
        </StyledSpanSessionInfo>
        <StyledSpanSessionInfo
          onClick={() => {
            setClickCount(clickCount + 1);
            if (clickCount === 10) {
              dispatch(setDebugMode(true));
              setClickCount(0);
            }
          }}
        >
          {window.versionInfo.commitHash?.slice(0, 8)}
        </StyledSpanSessionInfo>
      </Flex>
    </StyledVersionInfo>
  );
};

export const DefaultSettingPage = (modalState: UserSettingsModalState) => {
  const dispatch = getAppDispatch();
  const closeAction = useUserSettingsCloseAction(modalState);
  const { t } = useProBackendProDetails();
  const refetch = useProBackendRefetch();

  const profileName = useOurConversationUsername() || '';
  const [enlargedImage, setEnlargedImage] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const avatarPath = useOurAvatarPath() || '';
  const us = UserUtils.getOurPubKeyStrFromCache();

  const [mode, setMode] = useState<ProfileDialogModes>('default');

  const showUpdateProfileInformation = () => {
    dispatch(updateConversationDetailsModal({ conversationId: us }));
  };

  useHotkey('v', () => handleKeyQRMode(mode, setMode));
  useHotkey('Backspace', () => handleKeyCancel(mode, setMode, inputRef));

  function copyAccountIdToClipboard() {
    window.clipboard.writeText(us);
    ToastUtils.pushCopiedToClipBoard();
  }

  useMount(() => {
    if (!getFeatureFlag('proAvailable')) {
      return;
    }
    if (NetworkTime.nowSeconds() > t + 1 * DURATION_SECONDS.MINUTES) {
      void refetch();
    }
  });

  return (
    <UserSettingsModalContainer
      headerChildren={
        <ModalBasicHeader
          title={tr('sessionSettings')}
          showExitIcon={true}
          extraRightButton={<ModalPencilIcon onClick={showUpdateProfileInformation} />}
        />
      }
      onClose={closeAction || undefined}
    >
      <Flex
        $container={true}
        $flexDirection="column"
        $alignItems="center"
        $paddingBlock="var(--margins-md)"
        $flexGap="var(--margins-md)"
        width="100%"
      >
        {mode === 'qr' ? (
          <QRView sessionID={us} onExit={() => setMode('default')} />
        ) : (
          <ProfileHeader
            avatarPath={avatarPath}
            conversationId={us}
            onPlusAvatarClick={null}
            dataTestId="avatar-edit-profile-dialog"
            onQRClick={() => setMode('qr')}
            enlargedImage={enlargedImage}
            toggleEnlargedImage={() => setEnlargedImage(!enlargedImage)}
          />
        )}
        {mode === 'default' && (
          <ProfileName profileName={profileName} onClick={showUpdateProfileInformation} />
        )}

        <AccountIdPill accountType="ours" />
        <SessionIDNotEditable
          dataTestId="your-account-id"
          sessionId={us}
          displayType="3lines"
          tooltipNode={
            <SessionLucideIconButton
              iconSize="small"
              unicode={LUCIDE_ICONS_UNICODE.COPY}
              iconColor="var(--renderer-span-primary)"
              onClick={copyAccountIdToClipboard}
            />
          }
          style={{
            color: 'var(--text-primary-color)',
            fontSize: 'var(--font-size-h8)',
            lineHeight: 1.1,
          }}
          onClick={copyAccountIdToClipboard}
        />

        <SessionProSection />
        <MiscSection />
        <SettingsSection />
        <AdminSection />
        <SessionInfo />
      </Flex>
    </UserSettingsModalContainer>
  );
};
