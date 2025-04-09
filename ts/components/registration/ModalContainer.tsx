import { useSelector } from 'react-redux';
import {
  getQuitModalState,
  getTermsOfServicePrivacyModalState,
} from '../../state/onboarding/selectors/modals';
import { QuitModal } from '../dialog/QuitModal';
import { TermsOfServicePrivacyDialog } from '../dialog/TermsOfServicePrivacyDialog';
import { getOpenUrlModalState } from '../../state/selectors/modal';
import { OpenUrlModal } from '../dialog/OpenUrlModal';

export const ModalContainer = () => {
  const quitModalState = useSelector(getQuitModalState);
  const termsOfServicePrivacyModalState = useSelector(getTermsOfServicePrivacyModalState);
  const openUrlModalState = useSelector(getOpenUrlModalState);

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
