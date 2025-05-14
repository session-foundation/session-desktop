import { useState } from 'react';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import { clearOurAvatar, uploadOurAvatar } from '../../interactions/conversationInteractions';
import { ToastUtils, UserUtils } from '../../session/utils';
import { editProfileModal, updateEditProfilePictureModal } from '../../state/ducks/modalDialog';
import type { EditProfilePictureModalProps } from '../../types/ReduxTypes';
import { pickFileForAvatar } from '../../types/attachments/VisualAttachment';
import { SessionWrapperModal } from '../SessionWrapperModal';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SpacerLG } from '../basic/Text';
import { SessionIconButton } from '../icon';
import { SessionSpinner } from '../loading';
import { ProfileAvatar } from './edit-profile/components';
import { PlusAvatarButton } from '../buttons/PlusAvatarButton';
import { useAvatarPath, useConversationUsername, useIsMe } from '../../hooks/useParamSelector';
import { localize } from '../../localization/localeTools';
import { OpenGroupUtils } from '../../session/apis/open_group_api/utils';
import { initiateOpenGroupUpdate } from '../../session/group/open-group';

const StyledAvatarContainer = styled.div`
  cursor: pointer;
`;

const StyledUploadButton = styled.div`
  background-color: var(--chat-buttons-background-color);
  border-radius: 50%;
  overflow: hidden;
`;

const UploadImageButton = () => {
  return (
    <div style={{ position: 'relative' }}>
      <StyledUploadButton>
        <SessionIconButton iconType="thumbnail" iconSize={80} iconPadding="16px" />
      </StyledUploadButton>
      <PlusAvatarButton dataTestId="image-upload-section" />
    </div>
  );
};

const uploadProfileAvatar = async (scaledAvatarUrl: string | null, conversationId: string) => {
  if (scaledAvatarUrl?.length) {
    try {
      const blobContent = await (await fetch(scaledAvatarUrl)).blob();
      if (!blobContent || !blobContent.size) {
        throw new Error('Failed to fetch blob content from scaled avatar');
      }

      if (conversationId === UserUtils.getOurPubKeyStrFromCache()) {
        await uploadOurAvatar(await blobContent.arrayBuffer());
      } else if (OpenGroupUtils.isOpenGroupV2(conversationId)) {
        await initiateOpenGroupUpdate(conversationId, { objectUrl: scaledAvatarUrl });
      } else {
        throw new Error('dome');
      }
    } catch (error) {
      if (error.message && error.message.length) {
        ToastUtils.pushToastError('edit-profile', error.message);
      }
      window.log.error(
        'showEditProfileDialog Error ensuring that image is properly sized:',
        error && error.stack ? error.stack : error
      );
    }
  }
};

export const EditProfilePictureModal = ({ conversationId }: EditProfilePictureModalProps) => {
  const dispatch = useDispatch();

  const isMe = useIsMe(conversationId);

  const avatarPath = useAvatarPath(conversationId) || '';
  const profileName = useConversationUsername(conversationId) || '';

  const [newAvatarObjectUrl, setNewAvatarObjectUrl] = useState<string | null>(avatarPath);
  const [loading, setLoading] = useState(false);

  const closeDialog = () => {
    dispatch(updateEditProfilePictureModal(null));
    if (isMe) {
      dispatch(editProfileModal({}));
    }
  };

  const handleAvatarClick = async () => {
    const updatedAvatarObjectUrl = await pickFileForAvatar();
    if (updatedAvatarObjectUrl) {
      setNewAvatarObjectUrl(updatedAvatarObjectUrl);
    }
  };

  const handleUpload = async () => {
    setLoading(true);
    if (newAvatarObjectUrl === avatarPath) {
      window.log.debug('Avatar Object URL has not changed!');
      return;
    }

    await uploadProfileAvatar(newAvatarObjectUrl, conversationId);
    setLoading(false);
    dispatch(updateEditProfilePictureModal(null));
  };

  const handleRemove = async () => {
    setLoading(true);
    await clearOurAvatar();
    setNewAvatarObjectUrl(null);
    setLoading(false);
    dispatch(updateEditProfilePictureModal(null));
  };

  const handleClick = () => {
    void handleAvatarClick();
  };

  return (
    <SessionWrapperModal
      title={localize('profileDisplayPictureSet').toString()}
      onClose={closeDialog}
      showHeader={true}
      headerReverse={true}
      showExitIcon={true}
    >
      <div
        className="avatar-center"
        role="button"
        onClick={handleClick}
        data-testid={'image-upload-click'}
      >
        <StyledAvatarContainer className="avatar-center-inner">
          {newAvatarObjectUrl || avatarPath ? (
            <ProfileAvatar
              newAvatarObjectUrl={newAvatarObjectUrl}
              avatarPath={avatarPath}
              profileName={profileName}
              conversationId={conversationId}
              onPlusAvatarClick={handleClick}
            />
          ) : (
            <UploadImageButton />
          )}
        </StyledAvatarContainer>
      </div>

      {loading ? (
        <SessionSpinner loading={loading} />
      ) : (
        <>
          <SpacerLG />
          <div className="session-modal__button-group">
            <SessionButton
              text={localize('save').toString()}
              buttonType={SessionButtonType.Simple}
              onClick={handleUpload}
              disabled={newAvatarObjectUrl === avatarPath}
              dataTestId="save-button-profile-update"
            />
            <SessionButton
              text={localize('remove').toString()}
              buttonColor={SessionButtonColor.Danger}
              buttonType={SessionButtonType.Simple}
              onClick={handleRemove}
              disabled={!avatarPath}
            />
          </div>
        </>
      )}
    </SessionWrapperModal>
  );
};
