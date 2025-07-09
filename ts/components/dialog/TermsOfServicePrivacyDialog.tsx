import { shell } from 'electron';
import { useDispatch } from 'react-redux';
import { updateTermsOfServicePrivacyModal } from '../../state/onboarding/ducks/modals';
import { SessionButton, SessionButtonType } from '../basic/SessionButton';
import { ButtonChildrenContainer, SessionWrapperModal2 } from '../SessionWrapperModal2';
import { localize } from '../../localization/localeTools';
import { ModalDescription } from './shared/ModalDescriptionContainer';

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
    <SessionWrapperModal2
      title={localize('urlOpen').toString()}
      onClose={onClose}
      showExitIcon={true}
      buttonChildren={
        <ButtonChildrenContainer>
          <SessionButton
            ariaLabel={'Terms of service button'}
            text={localize('onboardingTos').toString()}
            buttonType={SessionButtonType.Simple}
            onClick={() => {
              void shell.openExternal('https://getsession.org/terms-of-service');
            }}
            dataTestId="terms-of-service-button"
          />
          <SessionButton
            ariaLabel={'Privacy policy button'}
            text={localize('onboardingPrivacy').toString()}
            buttonType={SessionButtonType.Simple}
            onClick={() => {
              void shell.openExternal('https://getsession.org/privacy-policy');
            }}
            dataTestId="privacy-policy-button"
          />
        </ButtonChildrenContainer>
      }
    >
      <ModalDescription
        dataTestId="modal-description"
        localizerProps={{
          token: 'urlOpenBrowser',
        }}
      />
    </SessionWrapperModal2>
  );
}
