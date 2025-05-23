/* eslint-disable @typescript-eslint/no-misused-promises */
import { useState } from 'react';

import { motion } from 'framer-motion';
import { useDispatch } from 'react-redux';
import useKey from 'react-use/lib/useKey';
import styled from 'styled-components';
import { useIsClosedGroup, useIsPublic } from '../../hooks/useParamSelector';
import { ConvoHub } from '../../session/conversations';
import { PubKey } from '../../session/types';
import LIBSESSION_CONSTANTS from '../../session/utils/libsession/libsession_constants';
import { groupInfoActions } from '../../state/ducks/metaGroups';
import { updateGroupNameModal } from '../../state/ducks/modalDialog';
import { useGroupNameChangeFromUIPending } from '../../state/selectors/groups';
import { THEME_GLOBALS } from '../../themes/globals';
import { pickFileForAvatar } from '../../types/attachments/VisualAttachment';
import { SessionWrapperModal } from '../SessionWrapperModal';
import { Avatar, AvatarSize } from '../avatar/Avatar';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SpacerMD } from '../basic/Text';
import { SessionSpinner } from '../loading';

const StyledErrorMessage = styled(motion.p)`
  text-align: center;
  color: var(--danger-color);
  display: block;
  user-select: none;
`;

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
  const [errorMsg, setErrorMsg] = useState('');
  const [errorDisplayed, setErrorDisplayed] = useState(false);
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
  const [newGroupName, setNewGroupName] = useState(originalGroupName);

  function closeDialog() {
    dispatch(updateGroupNameModal(null));
  }

  function onShowError(msg: string) {
    if (errorMsg === msg) {
      return;
    }
    setErrorMsg(msg);
    setErrorDisplayed(true);

    setTimeout(() => {
      setErrorDisplayed(false);
    }, 3000);
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
    const trimmedGroupName = newGroupName?.trim();
    if (!trimmedGroupName) {
      onShowError(window.i18n('groupNameEnterPlease'));

      return;
    }

    if (trimmedGroupName.length > LIBSESSION_CONSTANTS.BASE_GROUP_MAX_NAME_LENGTH) {
      onShowError(window.i18n('groupNameEnterShorter'));

      return;
    }
    onShowError('');

    if (trimmedGroupName !== originalGroupName || newAvatarObjectUrl !== oldAvatarPath) {
      if (!PubKey.is03Pubkey(conversationId)) {
        throw new Error('Only 03-group are supported here');
      }
      const updateNameAction = groupInfoActions.currentDeviceGroupNameChange({
        groupPk: conversationId,
        newName: trimmedGroupName,
      });
      dispatch(updateNameAction as any);
      // keeping the dialog open until the async thunk is done (via isNameChangePending)
    }
  }

  useKey('Escape', closeDialog);
  useKey('Esc', closeDialog);
  useKey('Enter', onClickOK);

  const okText = window.i18n('okay');
  const cancelText = window.i18n('cancel');

  return (
    <SessionWrapperModal title={window.i18n('groupName')} onClose={() => closeDialog()}>
      {errorMsg ? (
        <>
          <SpacerMD />
          <StyledErrorMessage
            initial={{ opacity: 0 }}
            animate={{ opacity: errorDisplayed ? 1 : 0 }}
            transition={{ duration: THEME_GLOBALS['--duration-modal-error-shown'] }}
            style={{ marginTop: errorDisplayed ? '0' : '-5px' }}
            data-testid="error-message"
          >
            {errorMsg}
          </StyledErrorMessage>
          <SpacerMD />
        </>
      ) : null}

      <GroupAvatar
        conversationId={conversationId}
        fireInputEvent={fireInputEvent}
        isPublic={isCommunity}
        newAvatarObjectUrl={newAvatarObjectUrl}
        oldAvatarPath={oldAvatarPath}
      />
      <SpacerMD />

      <input
        type="text"
        value={newGroupName}
        placeholder={window.i18n('groupNameEnter')}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            onClickOK();
            e.preventDefault();
          }
        }}
        onChange={e => setNewGroupName(e.target.value)}
        tabIndex={0}
        required={true}
        aria-required={true}
        autoFocus={true}
        maxLength={LIBSESSION_CONSTANTS.BASE_GROUP_MAX_NAME_LENGTH}
        data-testid="group-name-input"
      />

      <SessionSpinner loading={isNameChangePending} />

      <div className="session-modal__button-group">
        <SessionButton
          text={okText}
          onClick={onClickOK}
          buttonType={SessionButtonType.Simple}
          disabled={isNameChangePending}
        />
        <SessionButton
          text={cancelText}
          buttonColor={SessionButtonColor.Danger}
          buttonType={SessionButtonType.Simple}
          onClick={closeDialog}
        />
      </div>
    </SessionWrapperModal>
  );
}
