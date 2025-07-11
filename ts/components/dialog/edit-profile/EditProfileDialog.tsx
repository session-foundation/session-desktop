import { isEmpty } from 'lodash';
import { RefObject, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';

import { Dispatch } from '@reduxjs/toolkit';
import { UserUtils } from '../../../session/utils';
import { SessionIDNonEditable, YourSessionIDPill } from '../../basic/YourSessionIDPill';

import { useHotkey } from '../../../hooks/useHotkey';
import { useOurAvatarPath, useOurConversationUsername } from '../../../hooks/useParamSelector';
import { ProfileManager } from '../../../session/profile_manager/ProfileManager';
import { editProfileModal } from '../../../state/ducks/modalDialog';
import { Flex } from '../../basic/Flex';
import { Spacer3XL, SpacerLG, SpacerSM, SpacerXL } from '../../basic/Text';
import { SessionSpinner } from '../../loading';
import { ProfileHeader, ProfileName, QRView } from './components';
import { EmptyDisplayNameError, RetrieveDisplayNameError } from '../../../session/utils/errors';
import { localize } from '../../../localization/localeTools';
import { sanitizeDisplayNameOrToast } from '../../registration/utils';
import { useEditProfilePictureCallback } from '../../menuAndSettingsHooks/useEditProfilePictureCallback';
import { SimpleSessionInput } from '../../inputs/SessionInput';
import {
  ModalBasicHeader,
  ModalActionsContainer,
  SessionWrapperModal,
} from '../../SessionWrapperModal';
import { ModalBackButton } from '../shared/ModalBackButton';
import { SessionButtonColor, SessionButton } from '../../basic/SessionButton';
import { CopyToClipboardButton } from '../../buttons';

// #region Shortcuts
const handleKeyQRMode = (
  mode: ProfileDialogModes,
  setMode: (mode: ProfileDialogModes) => void,
  loading: boolean
) => {
  if (loading) {
    return;
  }
  switch (mode) {
    case 'default':
      setMode('qr');
      break;
    case 'qr':
      setMode('default');
      break;
    case 'edit':
    default:
  }
};

const handleKeyEditMode = (
  mode: ProfileDialogModes,
  setMode: (mode: ProfileDialogModes) => void,
  onClick: () => Promise<void>,
  loading: boolean
) => {
  if (loading) {
    return;
  }
  switch (mode) {
    case 'default':
      setMode('edit');
      break;
    case 'edit':
      void onClick();
      break;
    case 'qr':
    default:
  }
};

const handleKeyCancel = (
  mode: ProfileDialogModes,
  setMode: (mode: ProfileDialogModes) => void,
  inputRef: RefObject<HTMLInputElement>,
  updatedProfileName: string,
  setProfileName: (name: string) => void,
  setProfileNameError: (error: string | undefined) => void,
  loading: boolean
) => {
  if (loading) {
    return;
  }
  switch (mode) {
    case 'edit':
    case 'qr':
      if (inputRef.current !== null && document.activeElement === inputRef.current) {
        return;
      }
      setMode('default');
      if (mode === 'edit') {
        setProfileNameError(undefined);
        setProfileName(updatedProfileName);
      }
      break;
    case 'default':
    default:
  }
};

const handleKeyEscape = (
  mode: ProfileDialogModes,
  setMode: (mode: ProfileDialogModes) => void,
  updatedProfileName: string,
  setProfileName: (name: string) => void,
  setProfileNameError: (error: string | undefined) => void,
  loading: boolean,
  dispatch: Dispatch
) => {
  if (loading || mode === 'lightbox') {
    return;
  }

  if (mode === 'edit') {
    setMode('default');
    setProfileNameError(undefined);
    setProfileName(updatedProfileName);
  } else {
    dispatch(editProfileModal(null));
  }
};

// #endregion

const StyledEditProfileDialog = styled.div`
  .avatar-center-inner {
    position: relative;
  }

  input {
    border: none;
  }
`;

const StyledSessionIdSection = styled(Flex)`
  .session-button {
    width: 160px;
  }
`;

export type ProfileDialogModes = 'default' | 'edit' | 'qr' | 'lightbox';

export const EditProfileDialog = () => {
  const dispatch = useDispatch();

  const _profileName = useOurConversationUsername() || '';
  const [profileName, setProfileName] = useState(_profileName);
  const [updatedProfileName, setUpdateProfileName] = useState(profileName);
  const [profileNameError, setProfileNameError] = useState<string | undefined>(undefined);
  const [cannotContinue, setCannotContinue] = useState(true);

  const copyButtonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const avatarPath = useOurAvatarPath() || '';
  const us = UserUtils.getOurPubKeyStrFromCache();

  const editProfilePictureCb = useEditProfilePictureCallback({ conversationId: us });
  const [mode, setMode] = useState<ProfileDialogModes>('default');
  const [loading, setLoading] = useState(false);

  const closeDialog = (event?: any) => {
    if (event?.key || loading) {
      return;
    }
    dispatch(editProfileModal(null));
  };

  const onClickOK = async () => {
    try {
      setLoading(true);
      const sanitizedName = sanitizeDisplayNameOrToast(profileName);

      // this should never happen, but just in case
      if (isEmpty(sanitizedName)) {
        return;
      }

      // Note: this will not throw, but just truncate the display name if it is too long.
      // I guess it is expected as there is no UI to show anything else than a generic error?
      const validName = await ProfileManager.updateOurProfileDisplayName(sanitizedName);
      setUpdateProfileName(validName);
      setProfileName(validName);
      setMode('default');
    } catch (err) {
      window.log.error('Profile update error', err);
      setCannotContinue(true);

      if (err instanceof EmptyDisplayNameError || err instanceof RetrieveDisplayNameError) {
        setProfileNameError(localize('displayNameErrorDescription').toString());
      } else {
        setProfileNameError(localize('errorUnknown').toString());
      }
    } finally {
      setLoading(false);
    }
  };

  const handleProfileHeaderClick = () => {
    if (loading) {
      return;
    }
    closeDialog();
    editProfilePictureCb?.();
  };

  useHotkey('v', () => handleKeyQRMode(mode, setMode, loading), loading);
  useHotkey('Enter', () => handleKeyEditMode(mode, setMode, onClickOK, loading), loading);
  useHotkey(
    'Backspace',
    () =>
      handleKeyCancel(
        mode,
        setMode,
        inputRef,
        updatedProfileName,
        setProfileName,
        setProfileNameError,
        loading
      ),
    loading
  );
  useHotkey(
    'Escape',
    () =>
      handleKeyEscape(
        mode,
        setMode,
        updatedProfileName,
        setProfileName,
        setProfileNameError,
        loading,
        dispatch
      ),
    loading
  );

  return (
    <StyledEditProfileDialog className="edit-profile-dialog" data-testid="edit-profile-dialog">
      <SessionWrapperModal
        headerChildren={
          <ModalBasicHeader
            title={localize('profile').toString()}
            showExitIcon={true}
            leftButton={
              mode === 'edit' || mode === 'qr' ? (
                <ModalBackButton
                  onClick={() => {
                    if (loading) {
                      return;
                    }
                    setMode('default');
                  }}
                />
              ) : undefined
            }
          />
        }
        onClose={closeDialog}
        buttonChildren={
          mode === 'default' || mode === 'qr' || mode === 'lightbox' ? (
            // some bottom margin as the buttons have a border and appear to close to the edge
            <ModalActionsContainer extraBottomMargin={true}>
              <CopyToClipboardButton
                buttonColor={SessionButtonColor.PrimaryDark}
                copyContent={us}
                hotkey={true}
                reference={copyButtonRef}
                dataTestId="copy-button-profile-update"
                style={{ minWidth: '125px' }}
              />
              {mode === 'default' ? (
                <SessionButton
                  text={localize('qrView').toString()}
                  onClick={() => {
                    setMode('qr');
                  }}
                  buttonColor={SessionButtonColor.PrimaryDark}
                  dataTestId="view-qr-code-button"
                  style={{ minWidth: '125px' }}
                />
              ) : null}
            </ModalActionsContainer>
          ) : (
            !loading && (
              <ModalActionsContainer extraBottomMargin={true}>
                <SessionButton
                  text={localize('save').toString()}
                  onClick={onClickOK}
                  disabled={cannotContinue}
                  buttonColor={SessionButtonColor.PrimaryDark}
                  dataTestId="save-button-profile-update"
                  style={{ minWidth: '125px' }}
                />
              </ModalActionsContainer>
            )
          )
        }
      >
        {mode === 'qr' ? (
          <QRView sessionID={us} setMode={setMode} />
        ) : (
          <>
            <SpacerXL />
            <ProfileHeader
              avatarPath={avatarPath}
              profileName={profileName}
              conversationId={us}
              onClick={handleProfileHeaderClick}
              onQRClick={() => {
                if (loading) {
                  return;
                }
                setMode('qr');
              }}
            />
          </>
        )}

        <SpacerLG />

        {mode === 'default' && (
          <ProfileName
            profileName={updatedProfileName || profileName}
            onClick={() => {
              if (loading) {
                return;
              }
              setMode('edit');
            }}
          />
        )}

        {mode === 'edit' && (
          <SimpleSessionInput
            autoFocus={true}
            placeholder={localize('displayNameEnter').toString()}
            value={profileName}
            onValueChanged={(name: string) => {
              setProfileName(name);
              setCannotContinue(false);
            }}
            onEnterPressed={() => void onClickOK()}
            disabled={loading}
            tabIndex={0}
            required={true}
            centerText={true}
            providedError={profileNameError}
            textSize={'xl'}
            inputRef={inputRef}
            inputDataTestId="profile-name-input"
            errorDataTestId="error-message"
          />
        )}

        {mode !== 'qr' ? <Spacer3XL /> : <SpacerSM />}

        <StyledSessionIdSection
          $container={true}
          $flexDirection="column"
          $justifyContent="center"
          $alignItems="center"
          width={'100%'}
        >
          <YourSessionIDPill />
          <SessionIDNonEditable dataTestId="your-account-id" sessionId={us} />
          <SessionSpinner loading={loading} height={'74px'} />
        </StyledSessionIdSection>
      </SessionWrapperModal>
    </StyledEditProfileDialog>
  );
};
