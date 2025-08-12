import { RefObject, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';

import { UserUtils } from '../../../session/utils';

import { useHotkey } from '../../../hooks/useHotkey';
import { useOurAvatarPath, useOurConversationUsername } from '../../../hooks/useParamSelector';
import {
  updateConversationDetailsModal,
  userSettingsModal,
} from '../../../state/ducks/modalDialog';
import { ProfileHeader, ProfileName, QRView } from './components';
import { tr } from '../../../localization/localeTools';
import { ModalBasicHeader, SessionWrapperModal } from '../../SessionWrapperModal';
import { SessionIDNotEditable } from '../../basic/SessionIdNotEditable';
import { Flex } from '../../basic/Flex';
import { AccountIdPill } from '../../basic/AccountIdPill';
import { ModalPencilIcon } from '../shared/ModalPencilButton';
import type { ProfileDialogModes } from './ProfileDialogModes';
import { SessionLucideIconButton } from '../../icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from '../../icon/lucide';
import { PanelButtonGroup, PanelIconButton } from '../../buttons';
import { LOCALE_DEFAULTS } from '../../../localization/constants';
import { ProIconButton } from '../../buttons/ProButton';
import { LucideIcon, type LucideIconProps } from '../../icon/LucideIcon';
import { SessionIcon, type SessionIconProps } from '../../icon';

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

function SessionIconForSettings(props: Omit<SessionIconProps, 'iconSize'>) {
  return <SessionIcon iconColor="var(--text-primary-color)" {...props} iconSize="small" />;
}

function LucideIconForSettings(props: Omit<LucideIconProps, 'iconSize'>) {
  return <LucideIcon iconColor="var(--text-primary-color)" {...props} iconSize="medium" />;
}
const StyledUserSettingsDialog = styled.div``;

function SessionProSection() {
  return (
    <PanelButtonGroup>
      <PanelIconButton
        iconElement={
          <ProIconButton onClick={undefined} iconSize="small" dataTestId="invalid-data-testid" />
        }
        text={LOCALE_DEFAULTS.app_pro}
        onClick={() => {
          throw new Error('Not implemented'); // TODO: add link to pro page
        }}
        dataTestId="session-pro-settings-menu-item"
        color="var(--renderer-span-primary-color)"
      />
    </PanelButtonGroup>
  );
}

function MiscSection() {
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
          throw new Error('Not implemented');
        }}
        dataTestId="donate-settings-menu-item"
      />
      <PanelIconButton
        iconElement={<LucideIconForSettings unicode={LUCIDE_ICONS_UNICODE.SEARCH} />}
        text={tr('onionRoutingPath')}
        onClick={() => {
          throw new Error('Not implemented');
        }}
        dataTestId="path-light-container"
      />
      <PanelIconButton
        iconElement={<SessionIconForSettings iconType="sessionToken" />}
        text={LOCALE_DEFAULTS.network_name}
        onClick={() => {
          throw new Error('Not implemented');
        }}
        dataTestId="session-network-settings-menu-item"
      />
    </PanelButtonGroup>
  );
}

function SettingsSection() {
  return (
    <PanelButtonGroup>
      <PanelIconButton
        iconElement={<LucideIconForSettings unicode={LUCIDE_ICONS_UNICODE.LOCK_KEYHOLE} />}
        text={tr('sessionPrivacy')}
        onClick={() => {
          throw new Error('Not implemented');
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
          throw new Error('Not implemented');
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

export const UserSettingsDialog = () => {
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
