import { Provider } from 'react-redux';
import styled from 'styled-components';

import useMount from 'react-use/lib/useMount';
import { onboardingStore } from '../../state/onboarding/store';
import { SessionTheme } from '../../themes/SessionTheme';
import { setSignInByLinking } from '../../util/storage';
import { SessionToastContainer } from '../SessionToastContainer';
import { Flex } from '../basic/Flex';
import { ModalContainer } from './ModalContainer';
import { RegistrationStages } from './RegistrationStages';
import { Hero } from './components';
import { themeStore } from '../../state/theme/store';

const StyledFullscreenContainer = styled(Flex)`
  position: relative;
  width: 100%;
  height: 100%;
  background-color: var(--background-primary-color);
  color: var(--text-primary-color);
`;

const StyledSessionContent = styled(Flex)`
  z-index: 1;
`;

export const SessionRegistrationView = () => {
  useMount(() => {
    void setSignInByLinking(false);
  });

  return (
    <Provider store={themeStore}>
      <Provider store={onboardingStore}>
        <SessionTheme>
          <StyledFullscreenContainer $container={true} $alignItems="center">
            <Hero />
            <StyledSessionContent
              $flexDirection="column"
              $alignItems="center"
              $container={true}
              height="100%"
              $flexGrow={1}
            >
              <Flex $container={true} $margin="auto" $alignItems="center" $flexDirection="column">
                <SessionToastContainer />
                <ModalContainer />
                <RegistrationStages />
              </Flex>
            </StyledSessionContent>
          </StyledFullscreenContainer>
        </SessionTheme>
      </Provider>
    </Provider>
  );
};
