import { shell } from 'electron';
import { isEmpty } from 'lodash';
import { Dispatch } from 'react';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import { MessageInteraction } from '../../interactions';
import { OpenUrlModalState, updateOpenUrlModal } from '../../state/ducks/modalDialog';
import {
  BasicModalHeader,
  ButtonChildrenContainer,
  SessionWrapperModal2,
} from '../SessionWrapperModal2';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SpacerSM, SpacerXS } from '../basic/Text';
import { ModalDescription } from './shared/ModalDescriptionContainer';
import { localize } from '../../localization/localeTools';

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
      headerChildren={
        <BasicModalHeader title={localize('urlOpen').toString()} showExitIcon={true} />
      }
      onClose={onClose}
      buttonChildren={
        <ButtonChildrenContainer>
          <SessionButton
            text={localize('open').toString()}
            buttonColor={SessionButtonColor.Danger}
            buttonType={SessionButtonType.Simple}
            onClick={onClickOpen}
            dataTestId="open-url-confirm-button"
          />
          <SessionButton
            text={localize('urlCopy').toString()}
            buttonType={SessionButtonType.Simple}
            onClick={onClickCopy}
            dataTestId="copy-url-button"
          />
        </ButtonChildrenContainer>
      }
    >
      <StyledScrollDescriptionContainer>
        <ModalDescription
          dataTestId="modal-description"
          localizerProps={{ token: 'urlOpenDescription', asTag: 'span', args: { url } }}
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
