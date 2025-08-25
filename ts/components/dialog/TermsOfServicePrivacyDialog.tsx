import { shell } from 'electron';
import { useDispatch } from 'react-redux';
import { updateTermsOfServicePrivacyModal } from '../../state/onboarding/ducks/modals';
import { SessionButton, SessionButtonType } from '../basic/SessionButton';
import {
  ModalBasicHeader,
  ModalActionsContainer,
  SessionWrapperModal,
} from '../SessionWrapperModal';
import { tr } from '../../localization/localeTools';
import { ModalDescription } from './shared/ModalDescriptionContainer';
import { ModalFlexContainer } from './shared/ModalFlexContainer';

export type TermsOfServicePrivacyDialogProps = {
  show: boolean;
};

export function TermsOfServicePrivacyDialog(props: TermsOfServicePrivacyDialogProps) {
  const { show } = props;

  const dispatch = useDispatch();

  const onClose = () => {
    dispatch(updateTermsOfServicePrivacyModal(null));
  };

  if (!show) {
    return null;
  }

  return (
    <SessionWrapperModal
      headerChildren={<ModalBasicHeader title={tr('urlOpen')} showExitIcon={true} />}
      onClose={onClose}
      buttonChildren={
        <ModalActionsContainer buttonType={SessionButtonType.Simple}>
          <SessionButton
            ariaLabel={'Terms of service button'}
            text={tr('onboardingTos')}
            buttonType={SessionButtonType.Simple}
            onClick={() => {
              void shell.openExternal('https://getsession.org/terms-of-service');
            }}
            dataTestId="terms-of-service-button"
          />
          <SessionButton
            ariaLabel={'Privacy policy button'}
            text={tr('onboardingPrivacy')}
            buttonType={SessionButtonType.Simple}
            onClick={() => {
              void shell.openExternal('https://getsession.org/privacy-policy');
            }}
            dataTestId="privacy-policy-button"
          />
        </ModalActionsContainer>
      }
    >
      <ModalFlexContainer>
        <ModalDescription
          dataTestId="modal-description"
          localizerProps={{
            token: 'urlOpenBrowser',
          }}
        />
      </ModalFlexContainer>
    </SessionWrapperModal>
  );
}
