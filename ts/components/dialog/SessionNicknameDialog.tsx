import { useState } from 'react';
import { useDispatch } from 'react-redux';

import { ConvoHub } from '../../session/conversations';
import { changeNickNameModal } from '../../state/ducks/modalDialog';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { useConversationRealName, useNickname } from '../../hooks/useParamSelector';
import { PubKey } from '../../session/types';
import { localize } from '../../localization/localeTools';
import LIBSESSION_CONSTANTS from '../../session/utils/libsession/libsession_constants';
import { SimpleSessionInput } from '../inputs/SessionInput';
import { ClearInputButton } from '../inputs/ClearInputButton';
import {
  BasicModalHeader,
  ModalActionsContainer,
  SessionWrapperModal2,
} from '../SessionWrapperModal2';
import { ModalDescription } from './shared/ModalDescriptionContainer';

type Props = {
  conversationId: string;
};

function NicknameInput({
  onConfirm,
  nickname,
  setStateNickname,
}: {
  onConfirm: () => void;
  nickname: string;
  setStateNickname: (nickname: string) => void;
}) {
  const errorString =
    nickname.length > LIBSESSION_CONSTANTS.CONTACT_MAX_NAME_LENGTH
      ? localize('nicknameErrorShorter').toString()
      : '';
  return (
    <SimpleSessionInput
      ariaLabel="nickname input"
      value={nickname}
      textSize="md"
      padding={'var(--margins-xl) var(--margins-md)'}
      inputDataTestId="nickname-input"
      onValueChanged={setStateNickname}
      placeholder={localize('nicknameEnter').toString()}
      onEnterPressed={onConfirm}
      errorDataTestId="error-message"
      providedError={errorString}
      autoFocus={true}
      buttonEnd={
        <ClearInputButton
          dataTestId={'clear-nickname-button'}
          onClearInputClicked={() => {
            setStateNickname('');
          }}
          show={!!nickname}
        />
      }
    />
  );
}

export const SessionNicknameDialog = (props: Props) => {
  const { conversationId } = props;
  // this resolves to the real user name, and not the nickname (if set) like we do usually
  const displayName = useConversationRealName(conversationId);
  const dispatch = useDispatch();
  const currentNickname = useNickname(conversationId);
  const [nickname, setStateNickname] = useState(currentNickname || '');

  const onClickClose = () => {
    dispatch(changeNickNameModal(null));
  };

  const saveNickname = async (providedNickname: string | null) => {
    await ConvoHub.use().get(conversationId)?.setNickname(providedNickname, true);
    onClickClose();
  };

  const onClickRemove = async () => {
    await saveNickname(null);
  };

  return (
    <SessionWrapperModal2
      headerChildren={
        <BasicModalHeader title={localize('nicknameSet').toString()} showExitIcon={true} />
      }
      onClose={onClickClose}
      buttonChildren={
        <ModalActionsContainer>
          <SessionButton
            text={localize('save').toString()}
            disabled={!nickname}
            buttonType={SessionButtonType.Simple}
            onClick={() => saveNickname(nickname)}
            dataTestId="set-nickname-confirm-button"
          />
          <SessionButton
            text={localize('remove').toString()}
            buttonColor={SessionButtonColor.Danger}
            buttonType={SessionButtonType.Simple}
            onClick={onClickRemove}
            dataTestId="set-nickname-remove-button"
            disabled={!currentNickname} // "remove" disabled if no nickname were set for that user, on load
          />
        </ModalActionsContainer>
      }
    >
      <ModalDescription
        dataTestId="modal-description"
        localizerProps={{
          token: 'nicknameDescription',
          args: { name: displayName || PubKey.shorten(conversationId) },
        }}
      />
      <NicknameInput
        onConfirm={() => void saveNickname(nickname)}
        nickname={nickname}
        setStateNickname={setStateNickname}
      />
    </SessionWrapperModal2>
  );
};
