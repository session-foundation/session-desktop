import { isEmpty } from 'lodash';
import { useDispatch } from 'react-redux';
import { SettingsKey } from '../../data/settings-key';
import { updateHideRecoveryPasswordModal, userSettingsModal } from '../../state/ducks/modalDialog';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SpacerMD } from '../basic/Text';
import {
  ModalBasicHeader,
  ModalActionsContainer,
  SessionWrapperModal,
} from '../SessionWrapperModal';
import { tr } from '../../localization/localeTools';
import { ModalDescription } from './shared/ModalDescriptionContainer';
import { ModalFlexContainer } from './shared/ModalFlexContainer';

export type HideRecoveryPasswordDialogProps = {
  state: 'firstWarning' | 'secondWarning';
};

export function HideRecoveryPasswordDialog(props: HideRecoveryPasswordDialogProps) {
  const { state } = props;

  const dispatch = useDispatch();

  const onClose = () => {
    dispatch(updateHideRecoveryPasswordModal(null));
  };

  const onConfirmation = async () => {
    dispatch(userSettingsModal({ userSettingsPage: 'default' }));

    await window.setSettingValue(SettingsKey.settingsHideRecoveryPassword, true);
    onClose();
  };

  if (isEmpty(state)) {
    return null;
  }

  const leftButtonProps =
    state === 'firstWarning'
      ? {
          text: tr('theContinue'),
          buttonColor: SessionButtonColor.Danger,
          onClick: () => {
            dispatch(updateHideRecoveryPasswordModal({ state: 'secondWarning' }));
          },
          dataTestId: 'session-confirm-ok-button' as const,
        }
      : {
          text: tr('cancel'),
          onClick: onClose,
          dataTestId: 'session-confirm-cancel-button' as const,
        };

  const rightButtonProps =
    state === 'firstWarning'
      ? {
          text: tr('cancel'),
          onClick: onClose,
          dataTestId: 'session-confirm-cancel-button' as const,
        }
      : {
          text: tr('yes'),
          buttonColor: SessionButtonColor.Danger,
          onClick: () => {
            void onConfirmation();
          },
          dataTestId: 'session-confirm-ok-button' as const,
        };

  return (
    <SessionWrapperModal
      headerChildren={<ModalBasicHeader title={tr('recoveryPasswordHidePermanently')} />}
      onClose={onClose}
      buttonChildren={
        <ModalActionsContainer buttonType={SessionButtonType.Simple}>
          <SessionButton {...leftButtonProps} buttonType={SessionButtonType.Simple} />
          <SessionButton {...rightButtonProps} buttonType={SessionButtonType.Simple} />
        </ModalActionsContainer>
      }
    >
      <ModalFlexContainer>
        <ModalDescription
          dataTestId="modal-description"
          localizerProps={{
            token:
              state === 'firstWarning'
                ? 'recoveryPasswordHidePermanentlyDescription1'
                : 'recoveryPasswordHidePermanentlyDescription2',
          }}
        />
      </ModalFlexContainer>
      <SpacerMD />
    </SessionWrapperModal>
  );
}
