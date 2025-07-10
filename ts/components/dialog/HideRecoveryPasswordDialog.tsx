import { isEmpty } from 'lodash';
import { useDispatch } from 'react-redux';
import { SettingsKey } from '../../data/settings-key';
import { updateHideRecoveryPasswordModal } from '../../state/ducks/modalDialog';
import { sectionActions } from '../../state/ducks/section';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SpacerMD } from '../basic/Text';
import {
  ModalBasicHeader,
  ModalActionsContainer,
  SessionWrapperModal,
} from '../SessionWrapperModal';
import { localize } from '../../localization/localeTools';
import { ModalDescription } from './shared/ModalDescriptionContainer';

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
    await window.setSettingValue(SettingsKey.hideRecoveryPassword, true);
    onClose();
    dispatch(sectionActions.showSettingsSection('privacy'));
  };

  if (isEmpty(state)) {
    return null;
  }

  const leftButtonProps =
    state === 'firstWarning'
      ? {
          text: localize('theContinue').toString(),
          buttonColor: SessionButtonColor.Danger,
          onClick: () => {
            dispatch(updateHideRecoveryPasswordModal({ state: 'secondWarning' }));
          },
          dataTestId: 'session-confirm-ok-button' as const,
        }
      : {
          text: localize('cancel').toString(),
          onClick: onClose,
          dataTestId: 'session-confirm-cancel-button' as const,
        };

  const rightButtonProps =
    state === 'firstWarning'
      ? {
          text: localize('cancel').toString(),
          onClick: onClose,
          dataTestId: 'session-confirm-cancel-button' as const,
        }
      : {
          text: localize('yes').toString(),
          buttonColor: SessionButtonColor.Danger,
          onClick: () => {
            void onConfirmation();
          },
          dataTestId: 'session-confirm-ok-button' as const,
        };

  return (
    <SessionWrapperModal
      headerChildren={
        <ModalBasicHeader title={localize('recoveryPasswordHidePermanently').toString()} />
      }
      onClose={onClose}
      buttonChildren={
        <ModalActionsContainer>
          <SessionButton {...leftButtonProps} buttonType={SessionButtonType.Simple} />
          <SessionButton {...rightButtonProps} buttonType={SessionButtonType.Simple} />
        </ModalActionsContainer>
      }
    >
      <ModalDescription
        dataTestId="modal-description"
        localizerProps={{
          token:
            state === 'firstWarning'
              ? 'recoveryPasswordHidePermanentlyDescription1'
              : 'recoveryPasswordHidePermanentlyDescription2',
        }}
      />

      <SpacerMD />
    </SessionWrapperModal>
  );
}
