import { useCallback, useState } from 'react';
import type { AnyAction, Dispatch } from 'redux';
import styled from 'styled-components';
import { getAppDispatch } from '../../state/dispatch';
import { ToastUtils, UserUtils } from '../../session/utils';
import {
  userSettingsModal,
  updateEditProfilePictureModal,
  updateConversationDetailsModal,
  updateSessionCTA,
} from '../../state/ducks/modalDialog';
import type { EditProfilePictureModalProps } from '../../types/ReduxTypes';
import { pickFileForAvatar } from '../../types/attachments/VisualAttachment';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SessionSpinner } from '../loading';
import { ProfileAvatar } from './user-settings/components';
import { useAvatarPath, useIsMe, useIsPublic } from '../../hooks/useParamSelector';
import { tr } from '../../localization/localeTools';
import { OpenGroupUtils } from '../../session/apis/open_group_api/utils';
import { PubKey } from '../../session/types';
import { groupInfoActions } from '../../state/ducks/metaGroups';
import { useGroupAvatarChangeFromUIPending } from '../../state/selectors/groups';
import { userActions } from '../../state/ducks/user';
import { ReduxSogsRoomInfos } from '../../state/ducks/sogsRoomInfo';
import { useOurAvatarIsUploading, useOurAvatarUploadFailed } from '../../state/selectors/user';
import { useAvatarOfRoomIsUploading } from '../../state/selectors/sogsRoomInfo';
import {
  ModalActionsContainer,
  ModalBasicHeader,
  SessionWrapperModal,
} from '../SessionWrapperModal';
import { useIsProAvailable } from '../../hooks/useIsProAvailable';
import { SpacerLG, SpacerSM } from '../basic/Text';
import { AvatarSize } from '../avatar/Avatar';
import { ProIconButton } from '../buttons/ProButton';
import { useProBadgeOnClickCb } from '../menuAndSettingsHooks/useProBadgeOnClickCb';
import { useUserHasPro } from '../../hooks/useHasPro';
import { Localizer } from '../basic/Localizer';
import { UploadFirstImageButton } from '../buttons/avatar/UploadFirstImageButton';
import { Flex } from '../basic/Flex';
import { LucideIcon } from '../icon/LucideIcon';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';
import {
  useEditProfilePictureModal,
  useUpdateConversationDetailsModal,
} from '../../state/selectors/modal';
import { CTAVariant } from './cta/types';

const StyledAvatarContainer = styled.div`
  cursor: pointer;
  position: relative;
`;

const StyledCTADescription = styled.span<{ reverseDirection: boolean }>`
  text-align: center;
  cursor: pointer;
  font-size: var(--font-size-lg);
  color: var(--text-secondary-color);
  line-height: normal;
  display: inline-flex;
  flex-direction: ${props => (props.reverseDirection ? 'row-reverse' : 'row')};
  align-items: center;
  gap: var(--margins-xs);
  padding: 3px;
`;

const triggerUploadProfileAvatar = async (
  scaledAvatarUrl: string | null,
  conversationId: string,
  dispatch: Dispatch<AnyAction>
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
        dispatch(userActions.updateOurAvatar({ mainAvatarDecrypted: newAvatarDecrypted }) as any);
      } else if (OpenGroupUtils.isOpenGroupV2(conversationId)) {
        dispatch(
          ReduxSogsRoomInfos.roomAvatarChange({
            conversationId,
            avatarObjectUrl: scaledAvatarUrl,
          }) as any
        );
      } else if (PubKey.is03Pubkey(conversationId)) {
        dispatch(
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
        'triggerUploadProfileAvatar Error ensuring that image is properly sized:',
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
  const dispatch = getAppDispatch();

  const isMe = useIsMe(conversationId);
  const isCommunity = useIsPublic(conversationId);
  const userHasPro = useUserHasPro(conversationId);
  const isProAvailable = useIsProAvailable();

  const avatarPath = useAvatarPath(conversationId) || '';

  const groupAvatarChangePending = useGroupAvatarChangeFromUIPending();
  const ourAvatarIsUploading = useOurAvatarIsUploading();
  const ourAvatarUploadFailed = useOurAvatarUploadFailed();
  const sogsAvatarIsUploading = useAvatarOfRoomIsUploading(conversationId);
  const [isProcessing, setIsProcessing] = useState(false);

  const [newAvatarObjectUrl, setNewAvatarObjectUrl] = useState<string | null>(avatarPath);
  const [isNewAvatarAnimated, setIsNewAvatarAnimated] = useState<boolean>(false);

  const avatarChanged = newAvatarObjectUrl !== avatarPath;

  const resetState = () => {
    setNewAvatarObjectUrl(null);
    setIsNewAvatarAnimated(false);
  };

  const editProfilePictureModal = useEditProfilePictureModal();
  const conversationDetailsModal = useUpdateConversationDetailsModal();

  const afterActionButtonCallback = useCallback(() => {
    dispatch(updateEditProfilePictureModal(null));
    dispatch(updateConversationDetailsModal(null));
  }, [dispatch]);

  const actionButtonNextModalAfterCloseCallback = useCallback(() => {
    dispatch(userSettingsModal({ userSettingsPage: 'default' }));
    dispatch(updateConversationDetailsModal(conversationDetailsModal));
    dispatch(updateEditProfilePictureModal(editProfilePictureModal));
  }, [dispatch, conversationDetailsModal, editProfilePictureModal]);

  const proBadgeCb = useProBadgeOnClickCb({
    context: 'edit-profile-pic',
    args: {
      cta: {
        variant: userHasPro
          ? CTAVariant.PRO_ANIMATED_DISPLAY_PICTURE_ACTIVATED
          : CTAVariant.PRO_ANIMATED_DISPLAY_PICTURE,
        afterActionButtonCallback,
        actionButtonNextModalAfterCloseCallback,
      },
    },
  });

  const closeDialog = useCallback(() => {
    dispatch(updateEditProfilePictureModal(null));
    if (isMe) {
      dispatch(userSettingsModal({ userSettingsPage: 'default' }));
    }
  }, [dispatch, isMe]);

  const isPublic = useIsPublic(conversationId);

  const handleAvatarClick = async () => {
    const res = await pickFileForAvatar(setIsProcessing);

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
    if (!avatarChanged) {
      window.log.debug('Avatar Object URL has not changed!');
      return;
    }

    /**
     * Can upload animated profile picture if:
     * A. Pro user uploading their own profile picture
     * B. Group admin uploading a group profile picture and at least 1 admin is Pro.
     * C. Community admin uploading a community profile picture
     * All of those are taken care of as part of the `isProUser` check in the conversation model
     */
    if (isProAvailable && !userHasPro && isNewAvatarAnimated && !isCommunity) {
      dispatch(
        updateSessionCTA({
          variant: CTAVariant.PRO_ANIMATED_DISPLAY_PICTURE,
          afterActionButtonCallback,
          actionButtonNextModalAfterCloseCallback,
        })
      );
      window.log.debug('Attempted to upload an animated profile picture without pro!');
      return;
    }

    await triggerUploadProfileAvatar(newAvatarObjectUrl, conversationId, dispatch);
  };

  const loading =
    ourAvatarIsUploading || groupAvatarChangePending || sogsAvatarIsUploading || isProcessing;

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
    if (isPublic) {
      closeDialog();
    }
  };

  const handleClick = () => {
    void handleAvatarClick();
  };

  return (
    <SessionWrapperModal
      modalId="editProfilePictureModal"
      onClose={closeDialog}
      headerChildren={
        <ModalBasicHeader
          title={tr(isCommunity ? 'setCommunityDisplayPicture' : 'profileDisplayPictureSet')}
          showExitIcon={!loading}
        />
      }
      buttonChildren={
        <ModalActionsContainer buttonType={SessionButtonType.Outline}>
          <SessionButton
            text={tr('save')}
            buttonType={SessionButtonType.Simple}
            onClick={handleUpload}
            disabled={!newAvatarObjectUrl || !avatarChanged || loading}
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
      $flexGap="var(--margins-sm)"
    >
      {isMe && proBadgeCb.cb ? (
        <StyledCTADescription reverseDirection={userHasPro} onClick={proBadgeCb.cb}>
          {tr(
            userHasPro
              ? 'proAnimatedDisplayPictureModalDescription'
              : 'proAnimatedDisplayPicturesNonProModalDescription'
          )}
          <ProIconButton
            iconSize={'medium'}
            dataTestId="pro-badge-edit-profile-picture"
            disabled={loading}
            onClick={proBadgeCb.cb}
          />
        </StyledCTADescription>
      ) : null}
      <div role="button" data-testid={'image-upload-click'}>
        <SpacerLG />
        <StyledAvatarContainer>
          {newAvatarObjectUrl || avatarPath ? (
            <ProfileAvatar
              newAvatarObjectUrl={newAvatarObjectUrl}
              avatarPath={avatarPath}
              conversationId={conversationId}
              onPlusAvatarClick={handleClick}
              onAvatarClick={handleClick}
              avatarSize={AvatarSize.XL}
              dataTestId={'avatar-edit-profile-picture-dialog'}
            />
          ) : (
            <UploadFirstImageButton onClick={handleClick} />
          )}
        </StyledAvatarContainer>
      </div>
      {ourAvatarUploadFailed && isMe ? (
        <Flex
          $container={true}
          $justifyContent="center"
          $alignItems="center"
          $flexGap="var(--margins-xs)"
          style={{
            marginTop: 'var(--margins-lg)',
            color: 'var(--danger-color)',
          }}
        >
          <LucideIcon unicode={LUCIDE_ICONS_UNICODE.TRIANGLE_ALERT} iconSize="small" />
          <Localizer token="profileErrorUpdate" />
        </Flex>
      ) : null}
      {loading ? (
        <>
          <SpacerSM />
          {isMe && !isProcessing ? <Localizer token="updating" /> : null}
          <SessionSpinner loading={loading} height="30px" />
        </>
      ) : (
        <SpacerLG />
      )}
    </SessionWrapperModal>
  );
};
