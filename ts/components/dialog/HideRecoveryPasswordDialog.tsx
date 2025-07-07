import { isEmpty } from 'lodash';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import { SettingsKey } from '../../data/settings-key';
import { updateHideRecoveryPasswordModal } from '../../state/ducks/modalDialog';
import { sectionActions } from '../../state/ducks/section';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SpacerMD } from '../basic/Text';
import { Localizer } from '../basic/Localizer';
import { ButtonChildrenContainer, SessionWrapperModal2 } from '../SessionWrapperModal2';
import { localize } from '../../localization/localeTools';

const StyledDescriptionContainer = styled.div`
  width: 280px;
  line-height: var(--font-line-height);
`;

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
    <SessionWrapperModal2
      title={localize('recoveryPasswordHidePermanently').toString()}
      onClose={onClose}
      showExitIcon={false}
      buttonChildren={
        <ButtonChildrenContainer>
          <SessionButton {...leftButtonProps} buttonType={SessionButtonType.Simple} />
          <SessionButton {...rightButtonProps} buttonType={SessionButtonType.Simple} />
        </ButtonChildrenContainer>
      }
    >
      <StyledDescriptionContainer data-testid="modal-description">
        <Localizer
          token={
            state === 'firstWarning'
              ? 'recoveryPasswordHidePermanentlyDescription1'
              : 'recoveryPasswordHidePermanentlyDescription2'
          }
        />
      </StyledDescriptionContainer>
      <SpacerMD />
    </SessionWrapperModal2>
  );
}
