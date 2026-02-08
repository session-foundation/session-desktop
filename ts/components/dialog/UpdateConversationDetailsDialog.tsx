/* eslint-disable @typescript-eslint/no-misused-promises */
import { useState } from 'react';
import useMount from 'react-use/lib/useMount';
import { isEmpty } from 'lodash';
import { getAppDispatch } from '../../state/dispatch';

import {
  useAvatarPath,
  useAvatarPointer,
  useIsClosedGroup,
  useIsMe,
  useIsPublic,
} from '../../hooks/useParamSelector';
import { ConvoHub } from '../../session/conversations';
import { PubKey } from '../../session/types';
import LIBSESSION_CONSTANTS from '../../session/utils/libsession/libsession_constants';
import { groupInfoActions } from '../../state/ducks/metaGroups';
import {
  updateConversationDetailsModal,
  updateEditProfilePictureModal,
} from '../../state/ducks/modalDialog';
import {
  useGroupNameChangeFromUIPending,
  useLibGroupDescription,
} from '../../state/selectors/groups';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SpacerMD, SpacerSM } from '../basic/Text';
import { SessionSpinner } from '../loading';
import { tr } from '../../localization/localeTools';
import { SimpleSessionInput } from '../inputs/SessionInput';
import {
  ModalBasicHeader,
  ModalActionsContainer,
  SessionWrapperModal,
} from '../SessionWrapperModal';
import { ClearInputButton } from '../inputs/ClearInputButton';
import { ProfileAvatar } from './user-settings/components';
import { AvatarSize } from '../avatar/Avatar';
import {
  useChangeDetailsOfRoomPending,
  useRoomDescription,
} from '../../state/selectors/sogsRoomInfo';
import { ReduxSogsRoomInfos } from '../../state/ducks/sogsRoomInfo';
import type { WithConvoId } from '../../session/types/with';
import { UploadFirstImageButton } from '../buttons/avatar/UploadFirstImageButton';
import { sanitizeDisplayNameOrToast } from '../registration/utils';
import { ProfileManager } from '../../session/profile_manager/ProfileManager';
import { getFeatureFlag } from '../../state/ducks/types/releasedFeaturesReduxTypes';
import { SimpleSessionTextarea } from '../inputs/SimpleSessionTextarea';
import { ConversationModel } from '../../models/conversation';

/**
 * We want the description to be at most 200 visible characters, in addition
 * to being at most GROUP_INFO_DESCRIPTION_MAX_LENGTH bytes long.
 *
 */
const maxCharLength = 200;

function useNameErrorString({
  isMe,
  isPublic,
  newName,
}: {
  newName: string | undefined;
  isPublic: boolean;
  isMe: boolean;
}) {
  const byteLength = new TextEncoder().encode(newName).length;
  if (isMe) {
    return !newName?.trim()
      ? tr('displayNameErrorDescription')
      : byteLength > LIBSESSION_CONSTANTS.CONTACT_MAX_NAME_LENGTH
        ? tr('displayNameErrorDescriptionShorter')
        : '';
  }
  if (isPublic) {
    return !newName?.trim()
      ? tr('communityNameEnterPlease')
      : byteLength > LIBSESSION_CONSTANTS.BASE_GROUP_MAX_NAME_LENGTH
        ? tr('updateCommunityInformationEnterShorterName')
        : '';
  }
  return !newName?.trim()
    ? tr('groupNameEnterPlease')
    : byteLength > LIBSESSION_CONSTANTS.BASE_GROUP_MAX_NAME_LENGTH
      ? tr('groupNameEnterShorter')
      : '';
}

function useDescriptionErrorString({
  isMe,
  isPublic,
  newDescription,
}: {
  newDescription: string | undefined;
  isPublic: boolean;
  isMe: boolean;
}) {
  if (isMe) {
    // no error possible for description on isMe
    return '';
  }

  if (!newDescription) {
    // description is always optional
    return '';
  }

  // "👨🏻‍❤️‍💋‍👨🏻" is supposed to be 1char, but 35 bytes, and this is the only way
  // I found to have this to have the correct count
  const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
  const charLength = [...segmenter.segment(newDescription)].length;

  const byteLength = new TextEncoder().encode(newDescription).length;

  if (
    byteLength <= LIBSESSION_CONSTANTS.GROUP_INFO_DESCRIPTION_MAX_LENGTH &&
    charLength <= maxCharLength
  ) {
    return '';
  }
  return isPublic
    ? tr('updateCommunityInformationEnterShorterDescription')
    : tr('updateGroupInformationEnterShorterDescription');
}

// NOTE: [react-compiler] this has to live here for the hook to be identified as static
function useUpdateConversationDetailsDialogInternal(convo: ConversationModel) {
  const conversationId = convo.id;
  const nameOnOpen = convo.getRealSessionUsername() ?? '';
  const [avatarPointerOnMount, setAvatarPointerOnMount] = useState<string>('');
  const [newName, setNewName] = useState(nameOnOpen);
  const originalGroupDescription = useLibGroupDescription(conversationId);
  const originalCommunityDescription = useRoomDescription(conversationId);
  const isPublic = useIsPublic(conversationId);
  const descriptionOnOpen = isPublic ? originalCommunityDescription : originalGroupDescription;
  const [newDescription, setNewDescription] = useState(descriptionOnOpen);
  const avatarPath = useAvatarPath(conversationId) || '';
  const isMe = useIsMe(conversationId);
  const isCommunityChangePending = useChangeDetailsOfRoomPending(conversationId);
  const isGroupChangePending = useGroupNameChangeFromUIPending();
  const isClosedGroup = useIsClosedGroup(conversationId);
  const isNameChangePending = isPublic ? isCommunityChangePending : isGroupChangePending;

  useMount(() => {
    setAvatarPointerOnMount(convo?.getAvatarPointer() || '');
  });

  if (!isClosedGroup && !isPublic && !isMe) {
    throw new Error(
      'UpdateGroupOrCommunityDetailsDialog dialog only works groups/communities or ourselves'
    );
  }

  return {
    isNameChangePending,
    newName,
    newDescription,
    isMe,
    nameOnOpen,
    descriptionOnOpen,
    isPublic,
    avatarPointerOnMount,
    avatarPath,
    setNewName,
    setNewDescription,
  };
}

const useAvatarPointerLocal = useAvatarPointer;

export function UpdateConversationDetailsDialog(props: WithConvoId) {
  const dispatch = getAppDispatch();
  const { conversationId } = props;
  const refreshedAvatarPointer = useAvatarPointerLocal(conversationId) ?? '';
  const convo = ConvoHub.use().get(conversationId);

  const {
    isNameChangePending,
    newName,
    newDescription,
    isMe,
    nameOnOpen,
    descriptionOnOpen,
    isPublic,
    avatarPointerOnMount,
    avatarPath,
    setNewName,
    setNewDescription,
  } = useUpdateConversationDetailsDialogInternal(convo);

  if (!convo) {
    throw new Error('UpdateGroupOrCommunityDetailsDialog corresponding convo not found');
  }

  function closeDialog() {
    dispatch(updateConversationDetailsModal(null));
  }

  function onClickOK() {
    if (!!errorStringName || !!errorStringDescription || isNameChangePending) {
      return;
    }

    // if we click save, but the only change was an avatar change, we can close the dialog right
    // away (as the avatar was updated as part of of the EditProfilePictureModal)
    if (!nameOrDescriptionWasUpdated && avatarWasUpdated) {
      closeDialog();
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
      if (isMe) {
        const sanitizedName = sanitizeDisplayNameOrToast(trimmedGroupName);

        // this should never happen, but just in case
        if (isEmpty(sanitizedName)) {
          return;
        }

        // this truncates if the display name is too long
        // Note: this not doing any network calls. No need for a loader in this case
        void ProfileManager.updateOurProfileDisplayName(sanitizedName);
        closeDialog();

        return;
      }
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

  const errorStringName = useNameErrorString({ newName, isPublic, isMe });
  const errorStringDescription = useDescriptionErrorString({ isMe, isPublic, newDescription });

  function handleEditProfilePicture() {
    if (
      isPublic ||
      isMe ||
      (PubKey.is03Pubkey(conversationId) && getFeatureFlag('useClosedGroupV2QAButtons'))
    ) {
      dispatch(updateEditProfilePictureModal({ conversationId }));
      return;
    }
    throw new Error('handleEditProfilePicture is only for communities or ourselves for now');
  }

  const nameOrDescriptionWasUpdated =
    newName !== nameOnOpen || newDescription !== descriptionOnOpen;
  const avatarWasUpdated = avatarPointerOnMount !== refreshedAvatarPointer;
  const avatarNameOrDescUpdated = nameOrDescriptionWasUpdated || avatarWasUpdated;

  const partDetail = isMe ? 'profile' : isPublic ? 'community' : 'group';

  const canSave = avatarNameOrDescUpdated;
  const canCancel = !avatarWasUpdated;

  return (
    <SessionWrapperModal
      modalId="updateConversationDetailsModal"
      headerChildren={
        <ModalBasicHeader
          title={tr(
            partDetail === 'profile'
              ? 'updateProfileInformation'
              : partDetail === 'community'
                ? 'updateCommunityInformation'
                : 'updateGroupInformation'
          )}
        />
      }
      onClose={closeDialog}
      buttonChildren={
        <ModalActionsContainer buttonType={SessionButtonType.Simple}>
          {canSave ? (
            <SessionButton
              text={tr('save')}
              onClick={onClickOK}
              buttonType={SessionButtonType.Simple}
              disabled={!!errorStringName || !!errorStringDescription || isNameChangePending}
            />
          ) : null}
          {canCancel ? (
            <SessionButton
              text={tr('cancel')}
              buttonColor={SessionButtonColor.Danger}
              buttonType={SessionButtonType.Simple}
              onClick={closeDialog}
            />
          ) : null}
        </ModalActionsContainer>
      }
    >
      {isPublic || isMe ? (
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
      <SpacerMD />
      <SimpleSessionInput
        ariaLabel={`name input for ${partDetail}`}
        value={newName}
        textSize="md"
        padding="var(--margins-md) var(--margins-sm)"
        inputDataTestId={`update-${partDetail}-info-name-input`}
        onValueChanged={setNewName}
        placeholder={tr(`${partDetail === 'profile' ? 'display' : partDetail}NameEnter`)}
        onEnterPressed={onClickOK}
        errorDataTestId="error-message"
        providedError={errorStringName}
        autoFocus={true}
        required={true}
        tabIndex={0}
        allowEscapeKeyPassthrough={true}
        buttonEnd={
          <ClearInputButton
            dataTestId={`clear-${partDetail}-info-name-button`}
            onClearInputClicked={() => {
              setNewName('');
            }}
            show={!!newName}
          />
        }
      />
      <SpacerSM />
      {!isMe && partDetail !== 'profile' && (
        <SimpleSessionTextarea
          ariaLabel={`description input for ${partDetail}`}
          value={newDescription}
          textSize="md"
          padding="var(--margins-md) var(--margins-sm)"
          inputDataTestId={`update-${partDetail}-info-description-input`}
          onValueChanged={setNewDescription}
          placeholder={tr(`${partDetail}DescriptionEnter`)}
          errorDataTestId="error-message"
          providedError={errorStringDescription}
          autoFocus={false}
          tabIndex={1}
          required={false}
          singleLine={false}
          allowEscapeKeyPassthrough={true}
          buttonEnd={
            <ClearInputButton
              dataTestId={`clear-${partDetail}-info-description-button`}
              onClearInputClicked={() => {
                setNewDescription('');
              }}
              show={!!newDescription}
            />
          }
        />
      )}
      <SessionSpinner $loading={isNameChangePending} />
      <SpacerSM />
    </SessionWrapperModal>
  );
}
