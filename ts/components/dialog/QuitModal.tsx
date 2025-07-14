import { useState } from 'react';
import { useDispatch } from 'react-redux';
import useKey from 'react-use/lib/useKey';
import { updateQuitModal, type QuitModalProps } from '../../state/onboarding/ducks/modals';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import {
  ModalBasicHeader,
  ModalActionsContainer,
  SessionWrapperModal,
} from '../SessionWrapperModal';
import { ModalDescription } from './shared/ModalDescriptionContainer';
import { tr } from '../../localization/localeTools';

export const QuitModal = (props: QuitModalProps) => {
  const dispatch = useDispatch();
  const { onClickOk, onClickCancel, i18nMessage } = props;
  const title = tr('warning');

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
    <SessionWrapperModal
      headerChildren={<ModalBasicHeader title={title} />}
      onClose={onClickClose}
      buttonChildren={
        <ModalActionsContainer>
          <SessionButton
            text={tr('quitButton')}
            buttonColor={SessionButtonColor.Danger}
            buttonType={SessionButtonType.Simple}
            onClick={onClickOkHandler}
            disabled={isLoading}
            dataTestId="session-confirm-ok-button"
          />
          <SessionButton
            text={tr('cancel')}
            buttonColor={undefined}
            buttonType={SessionButtonType.Simple}
            onClick={onClickCancelHandler}
            disabled={isLoading}
            dataTestId="session-confirm-cancel-button"
          />
        </ModalActionsContainer>
      }
    >
      <ModalDescription dataTestId="modal-description" localizerProps={i18nMessage} />
    </SessionWrapperModal>
  );
};
