import { useState } from 'react';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';

import { ConvoHub } from '../../session/conversations';
import { changeNickNameModal } from '../../state/ducks/modalDialog';
import { SessionWrapperModal } from '../SessionWrapperModal';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SpacerLG } from '../basic/Text';
import { useConversationRealName, useNickname } from '../../hooks/useParamSelector';
import { PubKey } from '../../session/types';
import { Localizer } from '../basic/Localizer';
import { localize } from '../../localization/localeTools';
import LIBSESSION_CONSTANTS from '../../session/utils/libsession/libsession_constants';
import { SimpleSessionInput } from '../inputs/SessionInput';
import { ClearInputButton } from '../inputs/ClearInputButton';

type Props = {
  conversationId: string;
};

const StyledMaxWidth = styled.span`
  max-width: 30ch;
`;

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
    <SessionWrapperModal
      title={window.i18n('nicknameSet')}
      onClose={onClickClose}
      showExitIcon={true}
      showHeader={true}
      headerReverse={true}
    >
      <StyledMaxWidth className="session-modal__centered">
        <Localizer
          token="nicknameDescription"
          args={{
            name: displayName || PubKey.shorten(conversationId),
          }}
        />
        <SpacerLG />
      </StyledMaxWidth>
      <NicknameInput
        onConfirm={() => void saveNickname(nickname)}
        nickname={nickname}
        setStateNickname={setStateNickname}
      />
      <div className="session-modal__button-group">
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
      </div>
    </SessionWrapperModal>
  );
};
