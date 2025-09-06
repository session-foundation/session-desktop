import { QuitModal } from '../dialog/QuitModal';
import { TermsOfServicePrivacyDialog } from '../dialog/TermsOfServicePrivacyDialog';
import { OpenUrlModal } from '../dialog/OpenUrlModal';
import {
  useQuitModalState,
  useTermsOfServicePrivacyModalState,
} from '../../state/onboarding/selectors/modals';
import { useOpenUrlModal } from '../../state/selectors/modal';

export const ModalContainer = () => {
  const quitModalState = useQuitModalState();
  const termsOfServicePrivacyModalState = useTermsOfServicePrivacyModalState();
  const openUrlModalState = useOpenUrlModal();

  // NOTE the order of the modals is important for the z-index
  return (
    <>
      {termsOfServicePrivacyModalState && (
        <TermsOfServicePrivacyDialog {...termsOfServicePrivacyModalState} />
      )}
      {openUrlModalState && <OpenUrlModal {...openUrlModalState} />}
      {/* Should be on top of all other modals */}
      {quitModalState && <QuitModal {...quitModalState} />}
    </>
  );
};
