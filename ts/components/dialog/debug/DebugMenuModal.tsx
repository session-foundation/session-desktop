import { AnimatePresence } from 'framer-motion';
import styled from 'styled-components';
import { useDispatch } from 'react-redux';
import useUpdate from 'react-use/lib/useUpdate';
import { type Dispatch, useState } from 'react';
import { Flex } from '../../basic/Flex';
import { updateDebugMenuModal } from '../../../state/ducks/modalDialog';
import {
  AboutInfo,
  DataGenerationActions,
  DebugActions,
  ExperimentalActions,
  LoggingActions,
  OtherInfo,
  Playgrounds,
} from './components';
import { SessionWrapperModal2 } from '../../SessionWrapperModal2';
import { FeatureFlags } from './FeatureFlags';
import { ReleaseChannel } from './ReleaseChannel';
import { useHotkey } from '../../../hooks/useHotkey';
import { PopoverPlaygroundPage } from './playgrounds/PopoverPlaygroundPage';

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

export enum DEBUG_MENU_PAGE {
  MAIN = 0,
  POPOVER = 1,
}

export type DebugMenuPageProps = {
  setPage: Dispatch<DEBUG_MENU_PAGE>;
};

function MainPage({ setPage }: DebugMenuPageProps) {
  // NOTE we use forceUpdate here and pass it through so the entire modal refreshes when a flag is toggled
  const forceUpdate = useUpdate();
  return (
    <>
      <DebugActions />
      <LoggingActions />
      <Playgrounds setPage={setPage} />
      <ExperimentalActions forceUpdate={forceUpdate} />
      <DataGenerationActions />
      <FeatureFlags flags={window.sessionFeatureFlags} forceUpdate={forceUpdate} />
      <ReleaseChannel />
      <AboutInfo />
      <OtherInfo />
    </>
  );
}

function getPage(page: DEBUG_MENU_PAGE, setPage: Dispatch<DEBUG_MENU_PAGE>) {
  switch (page) {
    case DEBUG_MENU_PAGE.POPOVER:
      return <PopoverPlaygroundPage />;
    case DEBUG_MENU_PAGE.MAIN:
    default:
      return <MainPage setPage={setPage} />;
  }
}

export function DebugMenuModal() {
  const dispatch = useDispatch();

  const [page, setPage] = useState<DEBUG_MENU_PAGE>(DEBUG_MENU_PAGE.MAIN);

  const onClose = () => {
    dispatch(updateDebugMenuModal(null));
  };

  const makeTogglesActive = (query: string, active: boolean) => {
    const elements = document.querySelectorAll(query);
    for (let i = 0; i < elements.length; i++) {
      const toggleElement = elements[i] as any; // See SessionToggle
      if (active && toggleElement.getAttribute('data-active') === 'false') {
        toggleElement.click();
      }
      if (!active && toggleElement.getAttribute('data-active') === 'true') {
        toggleElement.click();
      }
    }
  };

  useHotkey('d', () => {
    makeTogglesActive('[id*="feature-flag-toggle-debug-debug"] > [role="button"]', true);
  });

  useHotkey('s', () => {
    makeTogglesActive('[id*="feature-flag-toggle-debug-debug"] > [role="button"]', false);
  });

  return (
    <AnimatePresence>
      <SessionWrapperModal2
        title={'Debug Menu'}
        onClose={onClose}
        showExitIcon={true}
        contentBorder={false}
        $contentMaxWidth={'75%'}
        shouldOverflow={true}
        allowOutsideClick={false}
      >
        <StyledContent
          $container={true}
          $flexDirection="column"
          $alignItems="flex-start"
          padding="var(--margins-sm) 0 var(--margins-xl)"
        >
          {getPage(page, setPage)}
        </StyledContent>
      </SessionWrapperModal2>
    </AnimatePresence>
  );
}
