import { useDispatch } from 'react-redux';
import { useState } from 'react';

import { updateEnterPasswordModal } from '../../state/ducks/modalDialog';
import { SpacerSM } from '../basic/Text';

import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { tr } from '../../localization/localeTools';
import {
  ModalBasicHeader,
  ModalActionsContainer,
  SessionWrapperModal,
  WrapperModalWidth,
} from '../SessionWrapperModal';
import { ShowHideSessionInput } from '../inputs/SessionInput';

export type EnterPasswordModalProps = {
  setPasswordValid: (value: boolean) => void;
  onClickOk?: () => void;
  onClickClose?: () => void;
};

const showHideButtonAriaLabels = {
  hide: 'Hide recovery password toggle',
  show: 'Reveal recovery password toggle',
} as const;

const showHideButtonDataTestIds = {
  hide: 'hide-password-input-toggle',
  show: 'reveal-password-input-toggle',
} as const;

export const EnterPasswordModal = (props: EnterPasswordModalProps) => {
  const { setPasswordValid, onClickOk, onClickClose } = props;
  const title = tr('sessionRecoveryPassword');

  const [password, setPassword] = useState('');
  const [providedError, setProvidedError] = useState<string | undefined>(undefined);
  const dispatch = useDispatch();

  const verifyPassword = async () => {
    try {
      if (!password) {
        setProvidedError(tr('passwordIncorrect'));

        return;
      }

      // this throws if the password is invalid.
      await window.onTryPassword(password);

      setPasswordValid(true);
      onClickOk?.();
      dispatch(updateEnterPasswordModal(null));
    } catch (e) {
      window.log.error('window.onTryPassword failed with', e);
      setProvidedError(tr('passwordIncorrect'));
    }
  };

  const onClose = () => {
    if (onClickClose) {
      onClickClose();
    }
    dispatch(updateEnterPasswordModal(null));
  };

  return (
    <SessionWrapperModal
      onClose={onClose}
      headerChildren={<ModalBasicHeader title={title} showExitIcon={true} />}
      $contentMinWidth={WrapperModalWidth.narrow}
      buttonChildren={
        <ModalActionsContainer buttonType={SessionButtonType.Simple}>
          <SessionButton
            text={tr('enter')}
            buttonType={SessionButtonType.Simple}
            onClick={verifyPassword}
            dataTestId="session-confirm-ok-button"
          />
          <SessionButton
            text={tr('cancel')}
            buttonType={SessionButtonType.Simple}
            buttonColor={SessionButtonColor.Danger}
            onClick={onClose}
            dataTestId="session-confirm-cancel-button"
          />
        </ModalActionsContainer>
      }
    >
      <SpacerSM />
      <ShowHideSessionInput
        ariaLabel="password input"
        placeholder={tr('passwordEnter')}
        value={password}
        onValueChanged={str => {
          setPassword(str);
          if (providedError) {
            setProvidedError(undefined);
          }
        }}
        padding="var(--margins-sm) var(--margins-md)"
        onEnterPressed={() => void verifyPassword()}
        providedError={providedError}
        errorDataTestId="error-message"
        inputDataTestId="password-input"
        showHideButtonAriaLabels={showHideButtonAriaLabels}
        showHideButtonDataTestIds={showHideButtonDataTestIds}
      />
    </SessionWrapperModal>
  );
};
