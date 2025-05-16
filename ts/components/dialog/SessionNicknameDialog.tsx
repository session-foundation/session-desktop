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
import { SessionInput } from '../inputs';
import { localize } from '../../localization/localeTools';

type Props = {
  conversationId: string;
};

const StyledMaxWidth = styled.span`
  max-width: 30ch;
`;

export const SessionNicknameDialog = (props: Props) => {
  const { conversationId } = props;
  const currentNickname = useNickname(conversationId);
  const [nickname, setStateNickname] = useState(currentNickname || '');
  // this resolves to the real user name, and not the nickname (if set) like we do usually
  const displayName = useConversationRealName(conversationId);
  const dispatch = useDispatch();

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

      <SessionInput
        autoFocus={true}
        ariaLabel="nickname input"
        value={nickname}
        textSize="md"
        editable={true}
        monospaced={false}
        centerText={false}
        isTextArea={false}
        padding={'var(--margins-xl) var(--margins-md)'}
        inputDataTestId="nickname-input"
        onValueChanged={setStateNickname}
        placeholder={localize('nicknameEnter').toString()}
        onEnterPressed={saveNickname}
        error={'nickname-input error handling is still to do'}
      />

      <div className="session-modal__button-group">
        <SessionButton
          text={window.i18n('save')}
          buttonType={SessionButtonType.Simple}
          onClick={() => saveNickname(nickname)}
          dataTestId="set-nickname-confirm-button"
        />
        <SessionButton
          text={window.i18n('remove')}
          buttonColor={SessionButtonColor.Danger}
          buttonType={SessionButtonType.Simple}
          onClick={onClickRemove}
          dataTestId="set-nickname-remove-button"
        />
      </div>
    </SessionWrapperModal>
  );
};
