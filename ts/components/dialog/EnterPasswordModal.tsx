import { useDispatch } from 'react-redux';
import { useState } from 'react';

import { updateEnterPasswordModal } from '../../state/ducks/modalDialog';
import { SpacerSM } from '../basic/Text';

import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { localize } from '../../localization/localeTools';
import {
  BasicModalHeader,
  ModalActionsContainer,
  SessionWrapperModal2,
  WrapperModalWidth,
} from '../SessionWrapperModal2';
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
  const title = localize('sessionRecoveryPassword').toString();

  const [password, setPassword] = useState('');
  const [providedError, setProvidedError] = useState<string | undefined>(undefined);
  const dispatch = useDispatch();

  const verifyPassword = async () => {
    try {
      if (!password) {
        setProvidedError(localize('passwordIncorrect').toString());

        return;
      }

      // this throws if the password is invalid.
      await window.onTryPassword(password);

      setPasswordValid(true);
      onClickOk?.();
      dispatch(updateEnterPasswordModal(null));
    } catch (e) {
      window.log.error('window.onTryPassword failed with', e);
      setProvidedError(localize('passwordIncorrect').toString());
    }
  };

  const onClose = () => {
    if (onClickClose) {
      onClickClose();
    }
    dispatch(updateEnterPasswordModal(null));
  };

  return (
    <SessionWrapperModal2
      onClose={onClose}
      headerChildren={<BasicModalHeader title={title} showExitIcon={true} />}
      $contentMinWidth={WrapperModalWidth.narrow}
      buttonChildren={
        <ModalActionsContainer>
          <SessionButton
            text={localize('done').toString()}
            buttonType={SessionButtonType.Simple}
            onClick={verifyPassword}
            dataTestId="session-confirm-ok-button"
          />
          <SessionButton
            text={localize('cancel').toString()}
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
        placeholder={localize('passwordEnter').toString()}
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
    </SessionWrapperModal2>
  );
};
