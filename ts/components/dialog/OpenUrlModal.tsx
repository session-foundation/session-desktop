import { shell } from 'electron';
import { isEmpty } from 'lodash';
import { Dispatch } from 'react';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import { MessageInteraction } from '../../interactions';
import { OpenUrlModalState, updateOpenUrlModal } from '../../state/ducks/modalDialog';
import { ButtonChildrenContainer, SessionWrapperModal2 } from '../SessionWrapperModal2';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { I18nSubText } from '../basic/I18nSubText';
import { SpacerSM, SpacerXS } from '../basic/Text';

const StyledScrollDescriptionContainer = styled.div`
  max-height: 150px;
  overflow-y: auto;
  text-align: center;
`;

export function OpenUrlModal(props: OpenUrlModalState) {
  const dispatch = useDispatch();

  if (!props || isEmpty(props) || !props.urlToOpen) {
    return null;
  }
  const url = props.urlToOpen;

  function onClose() {
    dispatch(updateOpenUrlModal(null));
  }

  function onClickOpen() {
    void shell.openExternal(url);
    onClose();
  }

  function onClickCopy() {
    MessageInteraction.copyBodyToClipboard(url);
    onClose();
  }

  return (
    <SessionWrapperModal2
      title={window.i18n('urlOpen')}
      onClose={onClose}
      showExitIcon={true}
      showHeader={true}
      buttonChildren={
        <ButtonChildrenContainer>
          <SessionButton
            text={window.i18n('open')}
            buttonColor={SessionButtonColor.Danger}
            buttonType={SessionButtonType.Simple}
            onClick={onClickOpen}
            dataTestId="open-url-confirm-button"
          />
          <SessionButton
            text={window.i18n('urlCopy')}
            buttonType={SessionButtonType.Simple}
            onClick={onClickCopy}
            dataTestId="copy-url-button"
          />
        </ButtonChildrenContainer>
      }
    >
      <StyledScrollDescriptionContainer>
        <I18nSubText
          localizerProps={{ token: 'urlOpenDescription', asTag: 'span', args: { url } }}
          dataTestId="modal-description"
        />
      </StyledScrollDescriptionContainer>
      <SpacerSM />

      <SpacerXS />
    </SessionWrapperModal2>
  );
}

export const showLinkVisitWarningDialog = (urlToOpen: string, dispatch: Dispatch<any>) => {
  dispatch(
    updateOpenUrlModal({
      urlToOpen,
    })
  );
};
