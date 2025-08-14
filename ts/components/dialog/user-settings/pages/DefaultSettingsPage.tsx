import { type RefObject, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import { useHotkey } from '../../../../hooks/useHotkey';
import { useOurConversationUsername, useOurAvatarPath } from '../../../../hooks/useParamSelector';
import { LOCALE_DEFAULTS } from '../../../../localization/constants';
import { UserUtils, ToastUtils } from '../../../../session/utils';
import { resetConversationExternal } from '../../../../state/ducks/conversations';
import {
  updateSessionProInfoModal,
  onionPathModal,
  updateSessionNetworkModal,
  updateConversationDetailsModal,
  userSettingsModal,
} from '../../../../state/ducks/modalDialog';
import { networkDataActions } from '../../../../state/ducks/networkData';
import { sectionActions, SectionType } from '../../../../state/ducks/section';
import { AccountIdPill } from '../../../basic/AccountIdPill';
import { Flex } from '../../../basic/Flex';
import { SessionIDNotEditable } from '../../../basic/SessionIdNotEditable';
import { PanelButtonGroup, PanelIconButton } from '../../../buttons';
import { ProIconButton } from '../../../buttons/ProButton';
import { type SessionIconProps, SessionIcon } from '../../../icon';
import { LUCIDE_ICONS_UNICODE } from '../../../icon/lucide';
import { type LucideIconProps, LucideIcon } from '../../../icon/LucideIcon';
import { SessionLucideIconButton } from '../../../icon/SessionIconButton';
import { QRView } from '../../../qrview/QrView';
import { ModalBasicHeader, SessionWrapperModal } from '../../../SessionWrapperModal';
import { showLinkVisitWarningDialog } from '../../OpenUrlModal';
import { SessionProInfoVariant } from '../../SessionProInfoModal';
import { ModalPencilIcon } from '../../shared/ModalPencilButton';
import { ProfileHeader, ProfileName } from '../components';
import type { ProfileDialogModes } from '../ProfileDialogModes';
import { tr } from '../../../../localization/localeTools';

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
  inputRef: RefObject<HTMLInputElement>
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
      style={{ width: '58px' }}
      {...props}
      iconSize="small"
    />
  );
}

function LucideIconForSettings(props: Omit<LucideIconProps, 'iconSize' | 'style'>) {
  return (
    <LucideIcon
      iconColor="var(--text-primary-color)"
      style={{ width: '58px' }}
      {...props}
      iconSize="medium"
    />
  );
}
const StyledUserSettingsDialog = styled.div``;

function SessionProSection() {
  const dispatch = useDispatch();
  return (
    <PanelButtonGroup>
      <PanelIconButton
        iconElement={
          <div style={{ width: '58px' }}>
            <ProIconButton onClick={undefined} iconSize="small" dataTestId="invalid-data-testid" />
          </div>
        }
        text={LOCALE_DEFAULTS.app_pro}
        onClick={() => {
          dispatch(updateSessionProInfoModal({ variant: SessionProInfoVariant.GENERIC }));
        }}
        dataTestId="session-pro-settings-menu-item"
        color="var(--renderer-span-primary-color)"
      />
    </PanelButtonGroup>
  );
}

function MiscSection() {
  const dispatch = useDispatch();
  return (
    <PanelButtonGroup>
      <PanelIconButton
        iconElement={
          <LucideIconForSettings
            iconColor="var(--renderer-span-primary-color)"
            unicode={LUCIDE_ICONS_UNICODE.HEART}
          />
        }
        text={tr('donate')}
        onClick={() => {
          showLinkVisitWarningDialog('https://session.foundation/donate#app', dispatch);
        }}
        dataTestId="donate-settings-menu-item"
      />
      <PanelIconButton
        iconElement={<LucideIconForSettings unicode={LUCIDE_ICONS_UNICODE.SEARCH} />}
        text={tr('onionRoutingPath')}
        onClick={() => {
          dispatch(onionPathModal({}));
        }}
        dataTestId="path-light-container"
      />
      <PanelIconButton
        iconElement={<SessionIconForSettings iconType="sessionToken" />}
        text={LOCALE_DEFAULTS.network_name}
        onClick={() => {
          // do a refresh request on open
          dispatch(networkDataActions.refreshInfoFromSeshServer() as any);
          dispatch(updateSessionNetworkModal({}));
        }}
        dataTestId="session-network-settings-menu-item"
      />
    </PanelButtonGroup>
  );
}

function SettingsSection() {
  const dispatch = useDispatch();

  return (
    <PanelButtonGroup>
      <PanelIconButton
        iconElement={<LucideIconForSettings unicode={LUCIDE_ICONS_UNICODE.LOCK_KEYHOLE} />}
        text={tr('sessionPrivacy')}
        onClick={() => {
          dispatch(userSettingsModal({ userSettingsPage: 'privacy' }));
        }}
        dataTestId="privacy-settings-menu-item"
      />
      <PanelIconButton
        iconElement={<LucideIconForSettings unicode={LUCIDE_ICONS_UNICODE.VOLUME_2} />}
        text={tr('sessionNotifications')}
        onClick={() => {
          throw new Error('Not implemented');
        }}
        dataTestId="notifications-settings-menu-item"
      />
      <PanelIconButton
        iconElement={<LucideIconForSettings unicode={LUCIDE_ICONS_UNICODE.MESSAGE_SQUARE} />}
        text={tr('sessionConversations')}
        onClick={() => {
          throw new Error('Not implemented');
        }}
        dataTestId="conversations-settings-menu-item"
      />
      <PanelIconButton
        iconElement={<LucideIconForSettings unicode={LUCIDE_ICONS_UNICODE.PAINTBRUSH_VERTICAL} />}
        text={tr('sessionAppearance')}
        onClick={() => {
          throw new Error('Not implemented');
        }}
        dataTestId="appearance-settings-menu-item"
      />
      <PanelIconButton
        iconElement={
          <LucideIconForSettings unicode={LUCIDE_ICONS_UNICODE.MESSAGE_SQUARE_WARNING} />
        }
        text={tr('sessionMessageRequests')}
        onClick={() => {
          dispatch(sectionActions.showLeftPaneSection(SectionType.Message));
          dispatch(sectionActions.setLeftOverlayMode('message-requests'));
          dispatch(resetConversationExternal());
        }}
        dataTestId="message-requests-settings-menu-item"
      />
      <PanelIconButton
        iconElement={<LucideIconForSettings unicode={LUCIDE_ICONS_UNICODE.SETTINGS} />}
        text={tr('preferences')}
        onClick={() => {
          throw new Error('Not implemented');
        }}
        dataTestId="preferences-settings-menu-item"
      />
    </PanelButtonGroup>
  );
}

function AdminSection() {
  return (
    <PanelButtonGroup>
      <PanelIconButton
        iconElement={<SessionIconForSettings iconType="recoveryPasswordFill" />}
        text={tr('sessionRecoveryPassword')}
        onClick={() => {
          throw new Error('Not implemented');
        }}
        dataTestId="recovery-password-settings-menu-item"
      />
      <PanelIconButton
        iconElement={<LucideIconForSettings unicode={LUCIDE_ICONS_UNICODE.CIRCLE_HELP} />}
        text={tr('sessionHelp')}
        onClick={() => {
          throw new Error('Not implemented');
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
        text={tr('sessionClearData')}
        onClick={() => {
          throw new Error('Not implemented');
        }}
        dataTestId="clear-data-settings-menu-item"
        color="var(--danger-color)"
      />
    </PanelButtonGroup>
  );
}

export const DefaultSettingPage = () => {
  const dispatch = useDispatch();

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
  useHotkey('Escape', () => closeDialog());

  function copyAccountIdToClipboard() {
    window.clipboard.writeText(us);
    ToastUtils.pushCopiedToClipBoard();
  }

  function closeDialog() {
    dispatch(userSettingsModal(null));
  }

  return (
    <StyledUserSettingsDialog data-testid="user-settings-dialog">
      <SessionWrapperModal
        headerChildren={
          <ModalBasicHeader
            title={tr('profile')}
            showExitIcon={true}
            extraRightButton={<ModalPencilIcon onClick={showUpdateProfileInformation} />}
          />
        }
        onClose={closeDialog}
        shouldOverflow={true}
        buttonChildren={null}
      >
        <Flex
          $container={true}
          $flexDirection="column"
          $alignItems="center"
          paddingBlock="var(--margins-md)"
          $flexGap="var(--margins-md)"
          width="100%"
        >
          {mode === 'qr' ? (
            <QRView sessionID={us} onExit={() => setMode('default')} />
          ) : (
            <ProfileHeader
              avatarPath={avatarPath}
              profileName={profileName}
              conversationId={us}
              onPlusAvatarClick={null}
              dataTestId="avatar-edit-profile-dialog"
              // no qr click here as a button is already doing that action (and the qr button looks bad when the small size as the +)
              // Note: this changes with the new Settings design
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
                iconColor="var(--primary-color)"
                onClick={copyAccountIdToClipboard}
              />
            }
            style={{ color: 'var(--text-primary-color)' }}
            onClick={copyAccountIdToClipboard}
          />

          <SessionProSection />
          <MiscSection />
          <SettingsSection />
          <AdminSection />
        </Flex>
      </SessionWrapperModal>
    </StyledUserSettingsDialog>
  );
};
