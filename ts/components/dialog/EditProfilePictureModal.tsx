import { useState } from 'react';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import { ToastUtils, UserUtils } from '../../session/utils';
import { editProfileModal, updateEditProfilePictureModal } from '../../state/ducks/modalDialog';
import type { EditProfilePictureModalProps } from '../../types/ReduxTypes';
import { pickFileForAvatar } from '../../types/attachments/VisualAttachment';
import { SessionWrapperModal } from '../SessionWrapperModal';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SpacerLG } from '../basic/Text';
import { SessionSpinner } from '../loading';
import { ProfileAvatar } from './edit-profile/components';
import { PlusAvatarButton } from '../buttons/PlusAvatarButton';
import {
  useAvatarPath,
  useConversationUsername,
  useIsMe,
  useIsPublic,
} from '../../hooks/useParamSelector';
import { localize } from '../../localization/localeTools';
import { OpenGroupUtils } from '../../session/apis/open_group_api/utils';
import { PubKey } from '../../session/types';
import { groupInfoActions } from '../../state/ducks/metaGroups';
import { useGroupAvatarChangeFromUIPending } from '../../state/selectors/groups';
import { userActions } from '../../state/ducks/user';
import { ReduxSogsRoomInfos } from '../../state/ducks/sogsRoomInfo';
import { useOurAvatarIsUploading } from '../../state/selectors/user';
import { useAvatarOfRoomIsUploading } from '../../state/selectors/sogsRoomInfo';
import { SessionLucideIconButton } from '../icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';

const StyledAvatarContainer = styled.div`
  cursor: pointer;
`;

const StyledUploadButton = styled.div`
  background-color: var(--chat-buttons-background-color);
  border-radius: 50%;
  overflow: hidden;
  padding: 16px;
  aspect-ratio: 1;
`;

const UploadImageButton = () => {
  return (
    <div style={{ position: 'relative' }}>
      <StyledUploadButton>
        <SessionLucideIconButton
          unicode={LUCIDE_ICONS_UNICODE.IMAGE}
          iconSize={'huge2'}
          margin="13px 0 0 0"
        />
      </StyledUploadButton>
      <PlusAvatarButton dataTestId="image-upload-section" />
    </div>
  );
};

const triggerUploadProfileAvatar = async (
  scaledAvatarUrl: string | null,
  conversationId: string
) => {
  if (scaledAvatarUrl?.length) {
    try {
      const fetched = await fetch(scaledAvatarUrl);
      const blobContent = await fetched.blob();
      if (!blobContent || !blobContent.size) {
        throw new Error('Failed to fetch blob content from scaled avatar');
      }

      if (conversationId === UserUtils.getOurPubKeyStrFromCache()) {
        const newAvatarDecrypted = await blobContent.arrayBuffer();
        window.inboxStore?.dispatch(userActions.updateOurAvatar({ newAvatarDecrypted }) as any);
      } else if (OpenGroupUtils.isOpenGroupV2(conversationId)) {
        window.inboxStore?.dispatch(
          ReduxSogsRoomInfos.changeCommunityAvatar({
            conversationId,
            avatarObjectUrl: scaledAvatarUrl,
          }) as any
        );
      } else if (PubKey.is03Pubkey(conversationId)) {
        window.inboxStore?.dispatch(
          groupInfoActions.currentDeviceGroupAvatarChange({
            objectUrl: scaledAvatarUrl,
            groupPk: conversationId,
          }) as any
        );
      } else {
        throw new Error('uploadProfileAvatar: unsupported case');
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

const triggerRemovalProfileAvatar = async (conversationId: string) => {
  try {
    if (OpenGroupUtils.isOpenGroupV2(conversationId)) {
      throw new Error('triggerRemovalProfileAvatar: not supported for communities');
    }

    if (conversationId === UserUtils.getOurPubKeyStrFromCache()) {
      window.inboxStore?.dispatch(userActions.clearOurAvatar() as any);
    } else if (PubKey.is03Pubkey(conversationId)) {
      window.inboxStore?.dispatch(
        groupInfoActions.currentDeviceGroupAvatarRemoval({
          groupPk: conversationId,
        }) as any
      );
    } else {
      throw new Error('triggerRemovalProfileAvatar: unsupported case');
    }
  } catch (error) {
    if (error.message && error.message.length) {
      ToastUtils.pushToastError('edit-profile', error.message);
    }
  }
};

export const EditProfilePictureModal = ({ conversationId }: EditProfilePictureModalProps) => {
  const dispatch = useDispatch();

  const isMe = useIsMe(conversationId);
  const isCommunity = useIsPublic(conversationId);

  const avatarPath = useAvatarPath(conversationId) || '';
  const profileName = useConversationUsername(conversationId) || '';

  const groupAvatarChangePending = useGroupAvatarChangeFromUIPending();
  const ourAvatarIsUploading = useOurAvatarIsUploading();
  const sogsAvatarIsUploading = useAvatarOfRoomIsUploading(conversationId);

  const [newAvatarObjectUrl, setNewAvatarObjectUrl] = useState<string | null>(avatarPath);

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
    if (newAvatarObjectUrl === avatarPath) {
      window.log.debug('Avatar Object URL has not changed!');
      return;
    }

    await triggerUploadProfileAvatar(newAvatarObjectUrl, conversationId);
  };

  const handleRemove = async () => {
    if (isCommunity) {
      throw new Error('community do not support removing avatars, only changing them');
    }
    await triggerRemovalProfileAvatar(conversationId);
    setNewAvatarObjectUrl(null);
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

      {ourAvatarIsUploading || groupAvatarChangePending || sogsAvatarIsUploading ? (
        <SessionSpinner loading={true} />
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
            {/* we cannot remove avatars from communities, only change them */}
            {!isCommunity ? (
              <SessionButton
                text={localize('remove').toString()}
                buttonColor={SessionButtonColor.Danger}
                buttonType={SessionButtonType.Simple}
                onClick={handleRemove}
                disabled={!avatarPath}
              />
            ) : null}
          </div>
        </>
      )}
    </SessionWrapperModal>
  );
};
