import { useCallback, useState } from 'react';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import { ToastUtils, UserUtils } from '../../session/utils';
import { editProfileModal, updateEditProfilePictureModal } from '../../state/ducks/modalDialog';
import type { EditProfilePictureModalProps } from '../../types/ReduxTypes';
import { pickFileForAvatar } from '../../types/attachments/VisualAttachment';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SessionSpinner } from '../loading';
import { ProfileAvatar } from './edit-profile/components';
import { PlusAvatarButton } from '../buttons/PlusAvatarButton';
import {
  useAvatarPath,
  useConversationUsername,
  useIsMe,
  useIsPublic,
} from '../../hooks/useParamSelector';
import { tr } from '../../localization/localeTools';
import { OpenGroupUtils } from '../../session/apis/open_group_api/utils';
import { PubKey } from '../../session/types';
import { groupInfoActions } from '../../state/ducks/metaGroups';
import { useGroupAvatarChangeFromUIPending } from '../../state/selectors/groups';
import { userActions } from '../../state/ducks/user';
import { ReduxSogsRoomInfos } from '../../state/ducks/sogsRoomInfo';
import { useOurAvatarIsUploading } from '../../state/selectors/user';
import { useAvatarOfRoomIsUploading } from '../../state/selectors/sogsRoomInfo';
import { SessionIconButton, SessionLucideIconButton } from '../icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';
import {
  ModalActionsContainer,
  ModalBasicHeader,
  SessionWrapperModal,
} from '../SessionWrapperModal';
import { useHasPro } from '../../hooks/useHasPro';
import { useIsProAvailable } from '../../hooks/useIsProAvailable';
import { SpacerLG } from '../basic/Text';
import {
  SessionProInfoVariant,
  useShowSessionProInfoDialogCbWithVariant,
} from './SessionProInfoModal';

const StyledAvatarContainer = styled.div`
  cursor: pointer;
`;

const StyledUploadButton = styled.div`
  background-color: var(--chat-buttons-background-color);
  border-radius: 50%;
  overflow: hidden;
  padding: var(--margins-lg);
  aspect-ratio: 1;
`;

const StyledCTADescription = styled.span<{ reverseDirection: boolean }>`
  text-align: center;
  font-size: var(--font-size-lg);
  color: var(--text-secondary-color);
  line-height: normal;
  display: inline-flex;
  flex-direction: ${props => (props.reverseDirection ? 'row-reverse' : 'row')};
  align-items: center;
  gap: var(--margins-xs);
  padding: 3px;
`;

const UploadImageButton = () => {
  return (
    <div style={{ position: 'relative' }}>
      <StyledUploadButton>
        <SessionLucideIconButton unicode={LUCIDE_ICONS_UNICODE.IMAGE} iconSize={'max'} margin="0" />
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
        window.inboxStore?.dispatch(
          userActions.updateOurAvatar({ mainAvatarDecrypted: newAvatarDecrypted }) as any
        );
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
  const hasPro = useHasPro();
  const isProAvailable = useIsProAvailable();

  const avatarPath = useAvatarPath(conversationId) || '';
  const profileName = useConversationUsername(conversationId) || '';

  const groupAvatarChangePending = useGroupAvatarChangeFromUIPending();
  const ourAvatarIsUploading = useOurAvatarIsUploading();
  const sogsAvatarIsUploading = useAvatarOfRoomIsUploading(conversationId);

  const [newAvatarObjectUrl, setNewAvatarObjectUrl] = useState<string | null>(avatarPath);
  const [isNewAvatarAnimated, setIsNewAvatarAnimated] = useState<boolean>(false);

  const resetState = () => {
    setNewAvatarObjectUrl(null);
    setIsNewAvatarAnimated(false);
  };

  const handleShowProInfoModal = useShowSessionProInfoDialogCbWithVariant();

  const closeDialog = useCallback(() => {
    dispatch(updateEditProfilePictureModal(null));
    if (isMe) {
      dispatch(editProfileModal({}));
    }
  }, [dispatch, isMe]);

  const handleAvatarClick = async () => {
    const res = await pickFileForAvatar();

    if (!res) {
      window.log.error('Failed to pick avatar');
      resetState();

      return;
    }

    if (res) {
      setIsNewAvatarAnimated(res.mainAvatarDetails.isAnimated);
      const blob = new Blob([res.mainAvatarDetails.outputBuffer], {
        type: res.mainAvatarDetails.format,
      });
      const blobUrl = URL.createObjectURL(blob);
      setNewAvatarObjectUrl(blobUrl);
    }
  };

  const handleUpload = async () => {
    if (newAvatarObjectUrl === avatarPath) {
      window.log.debug('Avatar Object URL has not changed!');
      return;
    }

    // TODO: Add way to check if group and if group is pro

    /**
     * Can upload animated profile picture if:
     * A. Pro user uploading their own profile picture
     * B. Group admin uploading a group profile picture and at least 1 admin is Pro.
     * C. Community admin uploading a community profile picture
     */
    if (isProAvailable && isNewAvatarAnimated && !hasPro && !isCommunity) {
      handleShowProInfoModal(SessionProInfoVariant.PROFILE_PICTURE_ANIMATED);
      window.log.debug('Attempted to upload an animated profile picture without pro!');
      return;
    }

    await triggerUploadProfileAvatar(newAvatarObjectUrl, conversationId);
  };

  const loading = ourAvatarIsUploading || groupAvatarChangePending || sogsAvatarIsUploading;

  const newAvatarLoaded = newAvatarObjectUrl !== avatarPath;

  const handleRemove = async () => {
    if (isCommunity) {
      throw new Error('community do not support removing avatars, only changing them');
    }
    await triggerRemovalProfileAvatar(conversationId);
    resetState();
  };

  const handleClear = async () => {
    if (loading || !newAvatarLoaded) {
      return;
    }
    resetState();
  };

  const handleClick = () => {
    void handleAvatarClick();
  };

  return (
    <SessionWrapperModal
      onClose={closeDialog}
      headerChildren={
        <ModalBasicHeader title={tr('profileDisplayPictureSet')} showExitIcon={!loading} />
      }
      buttonChildren={
        <ModalActionsContainer extraBottomMargin={true}>
          <SessionButton
            text={tr('save')}
            buttonType={SessionButtonType.Simple}
            onClick={handleUpload}
            disabled={!newAvatarObjectUrl || loading}
            dataTestId="save-button-profile-update"
          />
          {/* we cannot remove avatars from communities, only change them */}
          {newAvatarObjectUrl && newAvatarLoaded ? (
            <SessionButton
              text={tr('clear')}
              buttonColor={SessionButtonColor.Danger}
              buttonType={SessionButtonType.Simple}
              onClick={handleClear}
              disabled={!newAvatarObjectUrl || loading}
            />
          ) : !isCommunity ? (
            <SessionButton
              text={tr('remove')}
              buttonColor={SessionButtonColor.Danger}
              buttonType={SessionButtonType.Simple}
              onClick={handleRemove}
              disabled={!avatarPath || loading}
            />
          ) : null}
        </ModalActionsContainer>
      }
    >
      {isMe && isProAvailable && !isCommunity ? (
        <>
          <StyledCTADescription reverseDirection={hasPro}>
            {tr(
              hasPro
                ? 'proAnimatedDisplayPictureModalDescription'
                : 'proAnimatedDisplayPicturesNonProModalDescription'
            )}
            <SessionIconButton
              sizeIsWidth={false}
              iconType={'sessionPro'}
              iconSize={'medium'}
              backgroundColor={'var(--primary-color)'}
              borderRadius={'6px'}
              iconColor={'var(--black-color)'}
              disabled={loading}
              onClick={() =>
                handleShowProInfoModal(
                  hasPro
                    ? SessionProInfoVariant.ALREADY_PRO_PROFILE_PICTURE_ANIMATED
                    : SessionProInfoVariant.PROFILE_PICTURE_ANIMATED
                )
              }
            />
          </StyledCTADescription>
        </>
      ) : null}
      <div
        className="avatar-center"
        role="button"
        onClick={handleClick}
        data-testid={'image-upload-click'}
      >
        <SpacerLG />
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
        <SpacerLG />
      </div>
      <SessionSpinner loading={loading} />
    </SessionWrapperModal>
  );
};
