import { shell } from 'electron';
import { isEmpty } from 'lodash';
import { Dispatch, useCallback, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';
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
import {
  getUrlInteractionsForUrl,
  registerUrlInteraction,
  removeUrlInteraction,
  URLInteraction,
} from '../../util/urlHistory';
import { PanelToggleButton } from '../buttons/panel/PanelToggleButton';

const StyledScrollDescriptionContainer = styled.div`
  max-height: 150px;
  overflow-y: auto;
  text-align: center;
`;

function TrustToggle({ url }: { url: string }) {
  const [active, setActive] = useState<boolean>(false);

  const origin = useMemo(() => {
    if (URL.canParse(url)) {
      return new URL(url).origin;
    }
    return null;
  }, [url]);

  const onClick = useCallback(async () => {
    if (!origin) {
      return;
    }
    const newValue = !active;

    if (newValue) {
      await registerUrlInteraction(origin, URLInteraction.TRUST);
    } else {
      await removeUrlInteraction(origin, URLInteraction.TRUST);
    }
    setActive(newValue);
  }, [origin, active]);

  return (
    <PanelToggleButton
      textElement={<span style={{ textAlign: 'start' }}>Trust {origin} links from now on</span>}
      active={active}
      onClick={onClick}
      toggleDataTestId={'enable-typing-indicators-settings-toggle'}
      rowDataTestId={'enable-typing-indicators-settings-row'}
    />
  );
}

async function openUrl(url: string) {
  void shell.openExternal(url);
  await registerUrlInteraction(url, URLInteraction.OPEN);
}

export function OpenUrlModal(props: OpenUrlModalState) {
  const dispatch = useDispatch();

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
    MessageInteraction.copyBodyToClipboard(url);
    await registerUrlInteraction(url, URLInteraction.COPY);
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
        <SpacerXS />
        <TrustToggle url={url} />
      </StyledScrollDescriptionContainer>

      <SpacerXS />
    </SessionWrapperModal>
  );
}

export const showLinkVisitWarningDialog = (urlToOpen: string, dispatch: Dispatch<any>) => {
  const urlOrigin = URL.canParse(urlToOpen) ? new URL(urlToOpen).origin : null;
  if (urlOrigin) {
    const urlInteractions = getUrlInteractionsForUrl(urlOrigin);
    if (urlInteractions.includes(URLInteraction.TRUST)) {
      void openUrl(urlToOpen);
      return;
    }
  }

  dispatch(
    updateOpenUrlModal({
      urlToOpen,
    })
  );
};
