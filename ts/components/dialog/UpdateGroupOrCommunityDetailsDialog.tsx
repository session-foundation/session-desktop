/* eslint-disable @typescript-eslint/no-misused-promises */
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import useKey from 'react-use/lib/useKey';

import { useAvatarPath, useIsClosedGroup, useIsPublic } from '../../hooks/useParamSelector';
import { ConvoHub } from '../../session/conversations';
import { PubKey } from '../../session/types';
import LIBSESSION_CONSTANTS from '../../session/utils/libsession/libsession_constants';
import { groupInfoActions } from '../../state/ducks/metaGroups';
import {
  updateEditProfilePictureModal,
  updateGroupOrCommunityDetailsModal,
} from '../../state/ducks/modalDialog';
import {
  useGroupNameChangeFromUIPending,
  useLibGroupDescription,
} from '../../state/selectors/groups';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SpacerMD, SpacerSM } from '../basic/Text';
import { SessionSpinner } from '../loading';
import { tr } from '../../localization/localeTools';
import { SimpleSessionInput, SimpleSessionTextarea } from '../inputs/SessionInput';
import {
  ModalBasicHeader,
  ModalActionsContainer,
  ModalTopAnchor,
  SessionWrapperModal,
} from '../SessionWrapperModal';
import { ClearInputButton } from '../inputs/ClearInputButton';
import { UploadFirstImageButton } from './edit-profile/UploadFirstImage';
import { ProfileAvatar } from './edit-profile/components';
import { AvatarSize } from '../avatar/Avatar';
import {
  useChangeDetailsOfRoomPending,
  useRoomDescription,
} from '../../state/selectors/sogsRoomInfo';
import { ReduxSogsRoomInfos } from '../../state/ducks/sogsRoomInfo';

export function UpdateGroupOrCommunityDetailsDialog(props: { conversationId: string }) {
  const dispatch = useDispatch();
  const { conversationId } = props;
  const isClosedGroup = useIsClosedGroup(conversationId);
  const isPublic = useIsPublic(conversationId);
  const convo = ConvoHub.use().get(conversationId);
  const isGroupChangePending = useGroupNameChangeFromUIPending();
  const isCommunityChangePending = useChangeDetailsOfRoomPending(conversationId);

  const isNameChangePending = isPublic ? isCommunityChangePending : isGroupChangePending;

  if (!convo) {
    throw new Error('UpdateGroupOrCommunityDetailsDialog corresponding convo not found');
  }

  if (!isClosedGroup && !isPublic) {
    throw new Error('groupNameUpdate dialog only works closed groups');
  }
  const originalGroupDescription = useLibGroupDescription(conversationId);
  const originalCommunityDescription = useRoomDescription(conversationId);

  const nameOnOpen = convo.getRealSessionUsername();
  const descriptionOnOpen = isPublic ? originalCommunityDescription : originalGroupDescription;

  const [newName, setNewName] = useState(nameOnOpen);

  const [newDescription, setNewDescription] = useState(descriptionOnOpen);

  const avatarPath = useAvatarPath(conversationId) || '';

  function closeDialog() {
    dispatch(updateGroupOrCommunityDetailsModal(null));
  }

  function onClickOK() {
    if (isNameChangePending) {
      return;
    }
    // When the user wants to apply the changes, we truncate
    // the group name and description if needed, silently (errors are displayed on input changes)
    const trimmedGroupName = newName
      ?.slice(0, LIBSESSION_CONSTANTS.BASE_GROUP_MAX_NAME_LENGTH)
      .trim();
    const trimmedGroupDescription = newDescription
      ?.slice(0, LIBSESSION_CONSTANTS.GROUP_INFO_DESCRIPTION_MAX_LENGTH)
      .trim();

    if (!trimmedGroupName) {
      return;
    }

    if (trimmedGroupName !== nameOnOpen || trimmedGroupDescription !== descriptionOnOpen) {
      if (isPublic) {
        const updateDetailsAction = ReduxSogsRoomInfos.roomDetailsChange({
          conversationId,
          newName: trimmedGroupName,
          newDescription: trimmedGroupDescription,
        });
        dispatch(updateDetailsAction as any);

        return;
      }
      if (!PubKey.is03Pubkey(conversationId)) {
        throw new Error('Only 03-group are supported here');
      }
      const updateNameAction = groupInfoActions.currentDeviceGroupNameChange({
        groupPk: conversationId,
        newName: trimmedGroupName,
        newDescription: trimmedGroupDescription,
      });
      dispatch(updateNameAction as any);
      // keeping the dialog open until the async thunk is done (via isNameChangePending)
    }
  }

  useKey('Escape', closeDialog);
  useKey('Esc', closeDialog);

  const errorStringName = !newName
    ? tr(isPublic ? 'communityNameEnterPlease' : 'groupNameEnterPlease')
    : newName.length > LIBSESSION_CONSTANTS.BASE_GROUP_MAX_NAME_LENGTH
      ? tr(isPublic ? 'updateCommunityInformationEnterShorterName' : 'groupNameEnterShorter')
      : '';
  const errorStringDescription =
    newDescription && newDescription.length > LIBSESSION_CONSTANTS.GROUP_INFO_DESCRIPTION_MAX_LENGTH
      ? tr(
          isPublic
            ? 'updateCommunityInformationEnterShorterDescription'
            : 'updateGroupInformationEnterShorterDescription'
        )
      : '';

  function handleEditProfilePicture() {
    if (!isPublic) {
      throw new Error('handleEditProfilePicture is only for communities');
    }
    dispatch(updateEditProfilePictureModal({ conversationId }));
  }

  const noChanges = newName === nameOnOpen && newDescription === descriptionOnOpen;

  return (
    <SessionWrapperModal
      headerChildren={
        <ModalBasicHeader
          title={tr(isPublic ? 'updateCommunityInformation' : 'updateGroupInformation')}
        />
      }
      onClose={closeDialog}
      topAnchor={ModalTopAnchor.Normal}
      buttonChildren={
        <ModalActionsContainer>
          <SessionButton
            text={tr('save')}
            onClick={onClickOK}
            buttonType={SessionButtonType.Simple}
            disabled={isNameChangePending || !newName || !newName.trim() || noChanges}
          />
          <SessionButton
            text={tr('cancel')}
            buttonColor={SessionButtonColor.Danger}
            buttonType={SessionButtonType.Simple}
            onClick={closeDialog}
          />
        </ModalActionsContainer>
      }
    >
      {isPublic ? (
        avatarPath ? (
          <ProfileAvatar
            avatarPath={avatarPath}
            conversationId={conversationId}
            onPlusAvatarClick={handleEditProfilePicture}
            onAvatarClick={handleEditProfilePicture}
            avatarSize={AvatarSize.XL}
            dataTestId={'avatar-edit-profile-picture-dialog'}
          />
        ) : (
          <UploadFirstImageButton onClick={handleEditProfilePicture} />
        )
      ) : null}
      {/* right now we only support changing the name of a community */}
      <SpacerMD />
      <SimpleSessionInput
        ariaLabel="name input"
        value={newName}
        textSize="md"
        padding="var(--margins-md) var(--margins-sm)"
        inputDataTestId={
          isPublic ? 'update-community-info-name-input' : 'update-group-info-name-input'
        }
        onValueChanged={setNewName}
        placeholder={tr(isPublic ? 'communityNameEnter' : 'groupNameEnter')}
        onEnterPressed={onClickOK}
        errorDataTestId="error-message"
        providedError={errorStringName}
        autoFocus={true}
        required={true}
        tabIndex={0}
        buttonEnd={
          <ClearInputButton
            dataTestId={
              isPublic ? 'clear-community-info-name-button' : 'clear-group-info-name-button'
            }
            onClearInputClicked={() => {
              setNewName('');
            }}
            show={!!newName}
          />
        }
      />
      <SpacerSM />
      <SimpleSessionTextarea
        ariaLabel="description input"
        value={newDescription}
        textSize="md"
        padding="var(--margins-md) var(--margins-sm)"
        inputDataTestId={
          isPublic
            ? 'update-community-info-description-input'
            : 'update-group-info-description-input'
        }
        onValueChanged={setNewDescription}
        placeholder={tr(isPublic ? 'communityDescriptionEnter' : 'groupDescriptionEnter')}
        errorDataTestId="error-message"
        providedError={errorStringDescription}
        autoFocus={false}
        tabIndex={1}
        required={false}
        singleLine={false}
        buttonEnd={
          <ClearInputButton
            dataTestId={
              isPublic
                ? 'clear-community-info-description-button'
                : 'clear-group-info-description-button'
            }
            onClearInputClicked={() => {
              setNewDescription('');
            }}
            show={!!newDescription}
          />
        }
      />
      <SessionSpinner loading={isNameChangePending} />
      <SpacerSM />
    </SessionWrapperModal>
  );
}
