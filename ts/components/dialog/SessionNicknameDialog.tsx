import { useState } from 'react';
import { useDispatch } from 'react-redux';

import { ConvoHub } from '../../session/conversations';
import { changeNickNameModal } from '../../state/ducks/modalDialog';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { useConversationRealName, useNickname } from '../../hooks/useParamSelector';
import { PubKey } from '../../session/types';
import { tr } from '../../localization/localeTools';
import LIBSESSION_CONSTANTS from '../../session/utils/libsession/libsession_constants';
import { ModalSimpleSessionInput } from '../inputs/SessionInput';
import { ClearInputButton } from '../inputs/ClearInputButton';
import {
  ModalBasicHeader,
  ModalActionsContainer,
  SessionWrapperModal,
} from '../SessionWrapperModal';
import { ModalDescription } from './shared/ModalDescriptionContainer';
import { ModalFlexContainer } from './shared/ModalFlexContainer';

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
      ? tr('nicknameErrorShorter')
      : '';
  return (
    <ModalSimpleSessionInput
      ariaLabel="nickname input"
      value={nickname}
      textSize="md"
      inputDataTestId="nickname-input"
      onValueChanged={setStateNickname}
      placeholder={tr('nicknameEnter')}
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
    <SessionWrapperModal
      headerChildren={<ModalBasicHeader title={tr('nicknameSet')} showExitIcon={true} />}
      onClose={onClickClose}
      buttonChildren={
        <ModalActionsContainer>
          <SessionButton
            text={tr('save')}
            disabled={!nickname}
            buttonType={SessionButtonType.Simple}
            onClick={() => saveNickname(nickname)}
            dataTestId="set-nickname-confirm-button"
          />
          <SessionButton
            text={tr('remove')}
            buttonColor={SessionButtonColor.Danger}
            buttonType={SessionButtonType.Simple}
            onClick={onClickRemove}
            dataTestId="set-nickname-remove-button"
            disabled={!currentNickname} // "remove" disabled if no nickname were set for that user, on load
          />
        </ModalActionsContainer>
      }
    >
      <ModalFlexContainer>
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
      </ModalFlexContainer>
    </SessionWrapperModal>
  );
};
