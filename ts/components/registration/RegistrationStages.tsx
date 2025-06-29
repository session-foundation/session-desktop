import { AnimatePresence } from 'framer-motion';
import styled from 'styled-components';
import { useDispatch } from 'react-redux';
import { Data } from '../../data/data';
import { ConvoHub } from '../../session/conversations';
import {
  AccountCreation,
  AccountRestoration,
  Onboarding,
} from '../../state/onboarding/ducks/registration';
import {
  useOnboardAccountCreationStep,
  useOnboardAccountRestorationStep,
  useOnboardStep,
} from '../../state/onboarding/selectors/registration';
import { Storage } from '../../util/storage';
import { Flex } from '../basic/Flex';
import { SpacerXL, SpacerXS } from '../basic/Text';
import { SessionIcon } from '../icon';
import { OnboardContainer } from './components';
import { CreateAccount, RestoreAccount, Start } from './stages';
import { showLinkVisitWarningDialog } from '../dialog/OpenUrlModal';
import { SessionLucideIconButton } from '../icon/SessionIconButton';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';

export async function resetRegistration() {
  await Data.removeAll();
  Storage.reset();
  await Storage.fetch();
  ConvoHub.use().reset();
  await ConvoHub.use().load();
}

const StyledRegistrationContainer = styled(Flex)`
  width: 348px;
  .session-button {
    width: 100%;
    margin: 0;
  }
`;

export const RegistrationStages = () => {
  const step = useOnboardStep();
  const creationStep = useOnboardAccountCreationStep();
  const restorationStep = useOnboardAccountRestorationStep();

  const dispatch = useDispatch();

  return (
    <AnimatePresence>
      <StyledRegistrationContainer $container={true} $flexDirection="column">
        <Flex $container={true} $alignItems="center" height={'30px'}>
          <SessionIcon iconColor="var(--primary-color)" iconSize={'huge'} iconType="brand" />
          <SpacerXS />
          <div style={{ flexGrow: 1, zIndex: -1 }}>
            <SessionIcon iconSize={140} iconType="session" iconColor="var(--text-primary-color)" />
          </div>
          <Flex $container={true} $alignItems="center">
            <SessionLucideIconButton
              ariaLabel="FAQ Link"
              unicode={LUCIDE_ICONS_UNICODE.CIRCLE_HELP}
              iconSize={'medium'}
              padding="4px"
              iconColor="var(--text-primary-color)"
              dataTestId="session-faq-link"
              onClick={() => {
                showLinkVisitWarningDialog('https://getsession.org/faq', dispatch);
              }}
            />
          </Flex>
        </Flex>

        <Flex $container={true} $flexDirection="column" $alignItems="center">
          <SpacerXL />
          <OnboardContainer
            key={`${Onboarding[step]}-${step === Onboarding.CreateAccount ? AccountCreation[creationStep] : AccountRestoration[restorationStep]}`}
            animate={
              step !== Onboarding.Start &&
              restorationStep !== AccountRestoration.Finishing &&
              restorationStep !== AccountRestoration.Finished &&
              restorationStep !== AccountRestoration.Complete
            }
          >
            {step === Onboarding.Start ? <Start /> : null}
            {step === Onboarding.CreateAccount ? <CreateAccount /> : null}
            {step === Onboarding.RestoreAccount ? <RestoreAccount /> : null}
          </OnboardContainer>
        </Flex>
      </StyledRegistrationContainer>
    </AnimatePresence>
  );
};
