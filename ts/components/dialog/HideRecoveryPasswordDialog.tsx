import { isEmpty } from 'lodash';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import { SettingsKey } from '../../data/settings-key';
import { updateHideRecoveryPasswordModal } from '../../state/ducks/modalDialog';
import { sectionActions } from '../../state/ducks/section';
import { SessionWrapperModal } from '../SessionWrapperModal';
import { Flex } from '../basic/Flex';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SpacerMD } from '../basic/Text';
import { Localizer } from '../basic/Localizer';

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
          text: window.i18n('theContinue'),
          buttonColor: SessionButtonColor.Danger,
          onClick: () => {
            dispatch(updateHideRecoveryPasswordModal({ state: 'secondWarning' }));
          },
          dataTestId: 'session-confirm-ok-button' as const,
        }
      : {
          text: window.i18n('cancel'),
          onClick: onClose,
          dataTestId: 'session-confirm-cancel-button' as const,
        };

  const rightButtonProps =
    state === 'firstWarning'
      ? {
          text: window.i18n('cancel'),
          onClick: onClose,
          dataTestId: 'session-confirm-cancel-button' as const,
        }
      : {
          text: window.i18n('yes'),
          buttonColor: SessionButtonColor.Danger,
          onClick: () => {
            void onConfirmation();
          },
          dataTestId: 'session-confirm-ok-button' as const,
        };

  return (
    <SessionWrapperModal
      title={window.i18n('recoveryPasswordHidePermanently')}
      onClose={onClose}
      showExitIcon={false}
      showHeader={true}
      additionalClassName="no-body-padding"
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
      <Flex $container={true} $justifyContent="center" $alignItems="center" width="100%">
        <SessionButton {...leftButtonProps} buttonType={SessionButtonType.Ghost} />
        <SessionButton {...rightButtonProps} buttonType={SessionButtonType.Ghost} />
      </Flex>
    </SessionWrapperModal>
  );
}
