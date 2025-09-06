import { isEmpty } from 'lodash';
import { Dispatch } from 'react';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import {
  type LocalizedPopupDialogState,
  updateLocalizedPopupDialog,
} from '../../state/ducks/modalDialog';
import { ModalBasicHeader, SessionWrapperModal } from '../SessionWrapperModal';
import { SessionButton, SessionButtonType } from '../basic/SessionButton';
import { SpacerSM, SpacerXS } from '../basic/Text';
import { tr } from '../../localization/localeTools';
import { Localizer } from '../basic/Localizer';
import { ModalDescription } from './shared/ModalDescriptionContainer';
import { ModalFlexContainer } from './shared/ModalFlexContainer';

const StyledScrollDescriptionContainer = styled.div`
  max-height: 150px;
  overflow-y: auto;
  text-align: center;
`;

export function LocalizedPopupDialog(props: LocalizedPopupDialogState) {
  const dispatch = useDispatch();

  function onClose() {
    dispatch(updateLocalizedPopupDialog(null));
  }

  if (
    !props ||
    isEmpty(props) ||
    !props.title ||
    !props.description ||
    !props.title.token ||
    !props.description.token
  ) {
    return null;
  }

  return (
    <SessionWrapperModal
      modalId="localizedPopupDialog"
      headerChildren={
        <ModalBasicHeader title={<Localizer {...props.title} />} showExitIcon={true} />
      }
      onClose={onClose}
    >
      <StyledScrollDescriptionContainer>
        <ModalDescription localizerProps={props.description} dataTestId="modal-description" />
      </StyledScrollDescriptionContainer>
      <SpacerSM />

      <ModalFlexContainer>
        <SessionButton
          buttonType={SessionButtonType.Simple}
          onClick={onClose}
          dataTestId="session-confirm-ok-button"
        >
          {tr('okay')}
        </SessionButton>
      </ModalFlexContainer>
      <SpacerXS />
    </SessionWrapperModal>
  );
}

export const showLocalizedPopupDialog = (
  props: LocalizedPopupDialogState,
  dispatch: Dispatch<any>
) => {
  dispatch(updateLocalizedPopupDialog(props));
};
