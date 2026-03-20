import { shell } from 'electron';
import { isEmpty } from 'lodash';
import { Dispatch } from 'react';
import styled from 'styled-components';
import { getAppDispatch } from '../../state/dispatch';
import { MessageInteraction } from '../../interactions';
import { OpenUrlModalState, updateOpenUrlModal } from '../../state/ducks/modalDialog';
import {
  ModalBasicHeader,
  ModalActionsContainer,
  SessionWrapperModal,
} from '../SessionWrapperModal';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SpacerXS } from '../basic/Text';
import { ModalDescription } from './shared/ModalDescriptionContainer';
import { tr } from '../../localization/localeTools';
import { registerUrlInteraction, URLInteraction } from '../../util/urlHistory';

const StyledScrollDescriptionContainer = styled.div`
  max-height: 150px;
  overflow-y: auto;
  text-align: center;
`;

async function openUrl(url: string) {
  void shell.openExternal(url);
  await registerUrlInteraction(url, URLInteraction.OPEN);
}

async function copyUrl(url: string) {
  MessageInteraction.copyBodyToClipboard(url);
  await registerUrlInteraction(url, URLInteraction.COPY);
}

export function OpenUrlModal(props: OpenUrlModalState) {
  const dispatch = getAppDispatch();

  if (!props || isEmpty(props) || !props.urlToOpen) {
    return null;
  }
  const url = props.urlToOpen;

  function onClose() {
    dispatch(updateOpenUrlModal(null));
  }

  async function onClickOpen() {
    await openUrl(url);
    onClose();
  }

  async function onClickCopy() {
    await copyUrl(url);
    onClose();
  }

  return (
    <SessionWrapperModal
      modalId="openUrlModal"
      headerChildren={<ModalBasicHeader title={tr('urlOpen')} showExitIcon={true} />}
      onClose={onClose}
      buttonChildren={
        <ModalActionsContainer buttonType={SessionButtonType.Simple}>
          <SessionButton
            text={tr('open')}
            buttonColor={SessionButtonColor.Danger}
            buttonType={SessionButtonType.Simple}
            onClick={onClickOpen}
            dataTestId="open-url-confirm-button"
          />
          <SessionButton
            text={tr('urlCopy')}
            buttonType={SessionButtonType.Simple}
            onClick={onClickCopy}
            dataTestId="copy-url-button"
          />
        </ModalActionsContainer>
      }
    >
      <StyledScrollDescriptionContainer>
        <ModalDescription
          dataTestId="modal-description"
          localizerProps={{ token: 'urlOpenDescription', asTag: 'span', url }}
        />
      </StyledScrollDescriptionContainer>

      <SpacerXS />
    </SessionWrapperModal>
  );
}

export const showLinkVisitWarningDialog = (urlToOpen: string, dispatch: Dispatch<any>) => {
  dispatch(
    updateOpenUrlModal({
      urlToOpen,
    })
  );
};

export const openUrlNoDialog = (urlToOpen: string) => {
  void openUrl(urlToOpen);
};
