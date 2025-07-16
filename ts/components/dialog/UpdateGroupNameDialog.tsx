/* eslint-disable @typescript-eslint/no-misused-promises */
import { useState } from 'react';

import { useDispatch } from 'react-redux';
import useKey from 'react-use/lib/useKey';
import { useIsClosedGroup, useIsPublic } from '../../hooks/useParamSelector';
import { ConvoHub } from '../../session/conversations';
import { PubKey } from '../../session/types';
import LIBSESSION_CONSTANTS from '../../session/utils/libsession/libsession_constants';
import { groupInfoActions } from '../../state/ducks/metaGroups';
import { updateGroupNameModal } from '../../state/ducks/modalDialog';
import {
  useGroupNameChangeFromUIPending,
  useLibGroupDescription,
} from '../../state/selectors/groups';
import { pickFileForAvatar } from '../../types/attachments/VisualAttachment';
import { Avatar, AvatarSize } from '../avatar/Avatar';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SpacerMD, SpacerSM } from '../basic/Text';
import { SessionSpinner } from '../loading';
import { tr } from '../../localization/localeTools';
import { SimpleSessionInput, SimpleSessionTextarea } from '../inputs/SessionInput';
import {
  ModalBasicHeader,
  ModalActionsContainer,
  SessionWrapperModal,
} from '../SessionWrapperModal';
import { ClearInputButton } from '../inputs/ClearInputButton';

function GroupAvatar({
  isPublic,
  conversationId,
  fireInputEvent,
  newAvatarObjectUrl,
  oldAvatarPath,
}: {
  isPublic: boolean;
  conversationId: string;
  newAvatarObjectUrl: string | null;
  oldAvatarPath: string | null;
  fireInputEvent: () => Promise<void>;
}) {
  if (!isPublic) {
    return null;
  }

  return (
    <div className="avatar-center">
      <div className="avatar-center-inner">
        <Avatar
          forcedAvatarPath={newAvatarObjectUrl || oldAvatarPath}
          size={AvatarSize.XL}
          pubkey={conversationId}
        />
        <div className="image-upload-section" role="button" onClick={fireInputEvent} />
      </div>
    </div>
  );
}

export function UpdateGroupNameDialog(props: { conversationId: string }) {
  const dispatch = useDispatch();
  const { conversationId } = props;
  const [newAvatarObjectUrl, setNewAvatarObjectUrl] = useState<string | null>(null);
  const isCommunity = useIsPublic(conversationId);
  const isClosedGroup = useIsClosedGroup(conversationId);
  const convo = ConvoHub.use().get(conversationId);
  const isNameChangePending = useGroupNameChangeFromUIPending();

  if (!convo) {
    throw new Error('UpdateGroupNameDialog corresponding convo not found');
  }

  if (!isClosedGroup) {
    throw new Error('groupNameUpdate dialog only works closed groups');
  }

  const oldAvatarPath = convo?.getAvatarPath() || null;
  const originalGroupName = convo?.getRealSessionUsername();
  const originalGroupDescription = useLibGroupDescription(conversationId);
  const [newGroupName, setNewGroupName] = useState(originalGroupName);
  const [newGroupDescription, setNewGroupDescription] = useState(originalGroupDescription);

  function closeDialog() {
    dispatch(updateGroupNameModal(null));
  }

  async function fireInputEvent() {
    const scaledObjectUrl = await pickFileForAvatar();
    if (scaledObjectUrl) {
      setNewAvatarObjectUrl(scaledObjectUrl);
    }
  }

  function onClickOK() {
    if (isNameChangePending) {
      return;
    }
    // When the user wants to apply the changes, we truncate
    // the group name and description if needed, silently (errors are displayed on input changes)
    const trimmedGroupName = newGroupName
      ?.slice(0, LIBSESSION_CONSTANTS.BASE_GROUP_MAX_NAME_LENGTH)
      .trim();
    const trimmedGroupDescription = newGroupDescription
      ?.slice(0, LIBSESSION_CONSTANTS.GROUP_INFO_DESCRIPTION_MAX_LENGTH)
      .trim();

    if (!trimmedGroupName) {
      return;
    }

    if (
      trimmedGroupName !== originalGroupName ||
      trimmedGroupDescription !== originalGroupDescription ||
      newAvatarObjectUrl !== oldAvatarPath
    ) {
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

  const errorStringName = !newGroupName
    ? tr('groupNameEnterPlease')
    : newGroupName.length > LIBSESSION_CONSTANTS.BASE_GROUP_MAX_NAME_LENGTH
      ? tr('groupNameEnterShorter')
      : '';
  const errorStringDescription =
    newGroupDescription &&
    newGroupDescription.length > LIBSESSION_CONSTANTS.GROUP_INFO_DESCRIPTION_MAX_LENGTH
      ? tr('updateGroupInformationEnterShorterDescription')
      : '';

  return (
    <SessionWrapperModal
      headerChildren={<ModalBasicHeader title={tr('updateGroupInformation')} />}
      onClose={closeDialog}
      buttonChildren={
        <ModalActionsContainer>
          <SessionButton
            text={tr('save')}
            onClick={onClickOK}
            buttonType={SessionButtonType.Simple}
            disabled={isNameChangePending || !newGroupName || !newGroupName.trim()}
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
      <GroupAvatar
        conversationId={conversationId}
        fireInputEvent={fireInputEvent}
        isPublic={isCommunity}
        newAvatarObjectUrl={newAvatarObjectUrl}
        oldAvatarPath={oldAvatarPath}
      />
      <SpacerMD />

      <SimpleSessionInput
        ariaLabel="group name input"
        value={newGroupName}
        textSize="md"
        padding="var(--margins-md) var(--margins-sm)"
        inputDataTestId="update-group-info-name-input"
        onValueChanged={setNewGroupName}
        placeholder={tr('groupNameEnter')}
        onEnterPressed={onClickOK}
        errorDataTestId="error-message"
        providedError={errorStringName}
        autoFocus={true}
        required={true}
        tabIndex={0}
        buttonEnd={
          <ClearInputButton
            dataTestId={'clear-group-info-name-button'}
            onClearInputClicked={() => {
              setNewGroupName('');
            }}
            show={!!newGroupName}
          />
        }
      />
      <SpacerSM />

      <SimpleSessionTextarea
        ariaLabel="group description input"
        value={newGroupDescription}
        textSize="md"
        padding="var(--margins-md) var(--margins-sm)"
        inputDataTestId="update-group-info-description-input"
        onValueChanged={setNewGroupDescription}
        placeholder={tr('groupDescriptionEnter')}
        errorDataTestId="error-message"
        providedError={errorStringDescription}
        autoFocus={false}
        tabIndex={1}
        required={false}
        singleLine={false}
        buttonEnd={
          <ClearInputButton
            dataTestId={'clear-group-info-description-button'}
            onClearInputClicked={() => {
              setNewGroupDescription('');
            }}
            show={!!newGroupDescription}
          />
        }
      />

      <SessionSpinner loading={isNameChangePending} />
    </SessionWrapperModal>
  );
}
