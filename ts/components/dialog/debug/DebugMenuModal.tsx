import { AnimatePresence } from 'framer-motion';
import styled from 'styled-components';
import { useDispatch } from 'react-redux';
import { Flex } from '../../basic/Flex';
import { SpacerMD, SpacerSM } from '../../basic/Text';
import { updateDebugMenuModal } from '../../../state/ducks/modalDialog';
import { AboutInfo, DebugActions, OtherInfo } from './components';
import { SessionWrapperModal } from '../../SessionWrapperModal';
import { FeatureFlags } from './FeatureFlags';

const StyledContent = styled(Flex)`
  padding-inline: var(--margins-sm);

  h2 {
    font-size: var(--font-size-xl);
  }

  h2,
  h3 {
    margin: var(--margins-md) 0;
    padding: 0;
    text-decoration: underline;
  }

  p,
  i {
    line-height: 1.4;
    margin: 0;
    padding: 0;
    text-align: start;
  }
`;

export function DebugMenuModal() {
  const dispatch = useDispatch();

  const onClose = () => {
    dispatch(updateDebugMenuModal(null));
  };

  return (
    <AnimatePresence>
      <SessionWrapperModal title={'Debug Menu'} onClose={onClose} showExitIcon={true}>
        <StyledContent
          $container={true}
          $flexDirection="column"
          $alignItems="flex-start"
          padding="var(--margins-sm) 0"
        >
          <DebugActions />
          <SpacerSM />
          <FeatureFlags flags={window.sessionFeatureFlags} />
          <SpacerMD />
          <AboutInfo />
          <OtherInfo />
          <SpacerMD />
        </StyledContent>
      </SessionWrapperModal>
    </AnimatePresence>
  );
}
