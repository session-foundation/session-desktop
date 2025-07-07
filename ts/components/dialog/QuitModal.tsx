import { useState } from 'react';
import { useDispatch } from 'react-redux';
import useKey from 'react-use/lib/useKey';
import { updateQuitModal, type QuitModalProps } from '../../state/onboarding/ducks/modals';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { ButtonChildrenContainer, SessionWrapperModal2 } from '../SessionWrapperModal2';
import { Localizer } from '../basic/Localizer';
import { StyledModalDescriptionContainer } from './shared/ModalDescriptionContainer';
import { localize } from '../../localization/localeTools';

export const QuitModal = (props: QuitModalProps) => {
  const dispatch = useDispatch();
  const { onClickOk, onClickCancel, i18nMessage } = props;
  const title = localize('warning').toString();

  const [isLoading, setIsLoading] = useState(false);

  const onClickOkHandler = async () => {
    if (onClickOk) {
      setIsLoading(true);
      try {
        await onClickOk();
      } catch (e) {
        window.log.warn(e);
      } finally {
        setIsLoading(false);
      }
    }

    dispatch(updateQuitModal(null));
  };

  /**
   * Performs specified on close action then removes the modal.
   */
  const onClickCancelHandler = () => {
    onClickCancel?.();
    dispatch(updateQuitModal(null));
  };

  const onClickClose = () => {
    dispatch(updateQuitModal(null));
  };

  useKey('Enter', () => {
    void onClickOkHandler();
  });

  useKey('Escape', () => {
    onClickCancelHandler();
  });

  return (
    <SessionWrapperModal2
      title={title}
      onClose={onClickClose}
      showExitIcon={false}
      buttonChildren={
        <ButtonChildrenContainer>
          <SessionButton
            text={localize('quitButton').toString()}
            buttonColor={SessionButtonColor.Danger}
            buttonType={SessionButtonType.Simple}
            onClick={onClickOkHandler}
            disabled={isLoading}
            dataTestId="session-confirm-ok-button"
          />
          <SessionButton
            text={localize('cancel').toString()}
            buttonColor={undefined}
            buttonType={SessionButtonType.Simple}
            onClick={onClickCancelHandler}
            disabled={isLoading}
            dataTestId="session-confirm-cancel-button"
          />
        </ButtonChildrenContainer>
      }
    >
      <StyledModalDescriptionContainer data-testid="modal-description">
        <Localizer {...i18nMessage} />
      </StyledModalDescriptionContainer>
    </SessionWrapperModal2>
  );
};
