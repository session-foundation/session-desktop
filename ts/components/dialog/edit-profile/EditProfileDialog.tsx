import { isEmpty } from 'lodash';
import { RefObject, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import useClickAway from 'react-use/lib/useClickAway';
import { Dispatch } from '@reduxjs/toolkit';

import { UserUtils } from '../../../session/utils';

import { useHotkey } from '../../../hooks/useHotkey';
import { useOurAvatarPath, useOurConversationUsername } from '../../../hooks/useParamSelector';
import { ProfileManager } from '../../../session/profile_manager/ProfileManager';
import { editProfileModal } from '../../../state/ducks/modalDialog';
import { SessionSpinner } from '../../loading';
import { ProfileHeader, ProfileName, QRView } from './components';
import { EmptyDisplayNameError, RetrieveDisplayNameError } from '../../../session/utils/errors';
import { tr } from '../../../localization/localeTools';
import { sanitizeDisplayNameOrToast } from '../../registration/utils';
import { useEditProfilePictureCallback } from '../../menuAndSettingsHooks/useEditProfilePictureCallback';
import { SimpleSessionInput } from '../../inputs/SessionInput';
import {
  ModalBasicHeader,
  ModalActionsContainer,
  SessionWrapperModal,
  ModalBottomButtonWithBorder,
} from '../../SessionWrapperModal';
import { SessionButtonColor } from '../../basic/SessionButton';
import { CopyToClipboardButton } from '../../buttons';
import { SessionIDNotEditable } from '../../basic/SessionIdNotEditable';
import { Flex } from '../../basic/Flex';
import { AccountIdPill } from '../../basic/AccountIdPill';
import { ModalPencilIcon } from '../shared/ModalPencilButton';
import type { ProfileDialogModes } from './ProfileDialogModes';

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
  cancelEdit: () => void,
  loading: boolean,
  dispatch: Dispatch
) => {
  if (loading) {
    return;
  }

  if (mode === 'edit') {
    cancelEdit();
  } else {
    dispatch(editProfileModal(null));
  }
};

// #endregion

const StyledEditProfileDialog = styled.div`
  input {
    border: none;
  }
`;

export const EditProfileDialog = () => {
  const dispatch = useDispatch();

  const _profileName = useOurConversationUsername() || '';
  const [profileName, setProfileName] = useState(_profileName);
  const [profileNameError, setProfileNameError] = useState<string | undefined>(undefined);
  const [cannotContinue, setCannotContinue] = useState(true);
  const [enlargedImage, setEnlargedImage] = useState(false);

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
      setProfileName(validName);
      setMode('default');
    } catch (err) {
      window.log.error('Profile update error', err);
      setCannotContinue(true);

      if (err instanceof EmptyDisplayNameError || err instanceof RetrieveDisplayNameError) {
        setProfileNameError(tr('displayNameErrorDescription'));
      } else {
        setProfileNameError(tr('errorUnknown'));
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
        profileName,
        setProfileName,
        setProfileNameError,
        loading
      ),
    loading
  );
  useHotkey('Escape', () => handleKeyEscape(mode, cancelEdit, loading, dispatch), loading);

  function cancelEdit() {
    if (loading) {
      return;
    }
    setMode('default');
    setProfileNameError(undefined);
    setProfileName(_profileName);
  }

  useClickAway(inputRef, () => {
    if (mode === 'edit') {
      cancelEdit();
    }
  });

  return (
    <StyledEditProfileDialog className="edit-profile-dialog" data-testid="edit-profile-dialog">
      <SessionWrapperModal
        headerChildren={
          <ModalBasicHeader
            title={tr('profile')}
            showExitIcon={true}
            extraRightButton={<ModalPencilIcon onClick={() => setMode('edit')} />}
          />
        }
        onClose={closeDialog}
        shouldOverflow={true}
        buttonChildren={
          mode === 'default' || mode === 'qr' ? (
            // some bottom margin as the buttons have a border and appear to close to the edge
            <ModalActionsContainer extraBottomMargin={true}>
              <CopyToClipboardButton
                buttonColor={SessionButtonColor.PrimaryDark}
                copyContent={us}
                hotkey={true}
                reference={copyButtonRef}
                dataTestId="copy-button-profile-update"
              />
              {mode === 'default' ? (
                <ModalBottomButtonWithBorder
                  text={tr('qrView')}
                  onClick={() => {
                    setMode('qr');
                  }}
                  buttonColor={SessionButtonColor.PrimaryDark}
                  dataTestId="view-qr-code-button"
                />
              ) : null}
            </ModalActionsContainer>
          ) : (
            !loading && (
              <ModalActionsContainer extraBottomMargin={true}>
                <ModalBottomButtonWithBorder
                  text={tr('save')}
                  onClick={onClickOK}
                  disabled={cannotContinue}
                  dataTestId="save-button-profile-update"
                />
                <ModalBottomButtonWithBorder
                  text={tr('cancel')}
                  onClick={cancelEdit}
                  dataTestId="invalid-data-testid"
                />
              </ModalActionsContainer>
            )
          )
        }
      >
        <Flex
          $container={true}
          $flexDirection="column"
          $alignItems="center"
          paddingBlock="var(--margins-md)"
          $flexGap="var(--margins-md)"
        >
          {mode === 'qr' ? (
            <QRView sessionID={us} onExit={() => setMode('default')} />
          ) : (
            <ProfileHeader
              avatarPath={avatarPath}
              conversationId={us}
              onPlusAvatarClick={handleProfileHeaderClick}
              dataTestId="avatar-edit-profile-dialog"
              // no qr click here as a button is already doing that action (and the qr button looks bad when the small size as the +)
              // Note: this changes with the new Settings design
              onQRClick={null}
              enlargedImage={enlargedImage}
              toggleEnlargedImage={() => setEnlargedImage(!enlargedImage)}
            />
          )}
          {mode === 'default' && (
            <ProfileName
              profileName={profileName}
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
              placeholder={tr('displayNameEnter')}
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
              padding="var(--margins-xs) var(--margins-lg)"
            />
          )}
          <AccountIdPill accountType="ours" />
          <SessionIDNotEditable
            dataTestId="your-account-id"
            sessionId={us}
            displayType="2lines"
            tooltipNode={null}
            style={{ color: 'var(--text-primary-color)' }}
          />
          <SessionSpinner loading={loading} height={'74px'} />
        </Flex>
      </SessionWrapperModal>
    </StyledEditProfileDialog>
  );
};
