import styled from 'styled-components';
import useUpdate from 'react-use/lib/useUpdate';
import { type Dispatch, useState, ReactNode } from 'react';
import { getAppDispatch } from '../../../state/dispatch';
import { Flex } from '../../basic/Flex';
import { updateDebugMenuModal } from '../../../state/ducks/modalDialog';
import {
  AboutInfo,
  DataGenerationActions,
  DebugActions,
  DebugUrlInteractionsSection,
  ExperimentalActions,
  LoggingDebugSection,
  OtherInfo,
  Playgrounds,
} from './components';
import {
  ModalBasicHeader,
  SessionWrapperModal,
  WrapperModalWidth,
} from '../../SessionWrapperModal';
import {
  DebugFeatureFlags,
  FeatureFlagDumper,
  FeatureFlags,
  ProDebugSection,
} from './FeatureFlags';
import { ReleaseChannel } from './ReleaseChannel';
import { useHotkey } from '../../../hooks/useHotkey';
import { PopoverPlaygroundPage } from './playgrounds/PopoverPlaygroundPage';
import { ProPlaygroundPage } from './playgrounds/ProPlaygroundPage';
import { ModalBackButton } from '../shared/ModalBackButton';
import { PanelButtonGroup } from '../../buttons';
import { isDebugMode } from '../../../shared/env_vars';

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
  Pro = 2,
}

export type DebugMenuPageProps = {
  setPage: Dispatch<DEBUG_MENU_PAGE>;
};

export function DebugMenuSection({
  title,
  titleAdornment,
  children,
  rowWrap,
}: {
  title?: string;
  titleAdornment?: ReactNode;
  children: ReactNode;
  rowWrap?: boolean;
}) {
  return (
    <PanelButtonGroup
      style={{
        maxWidth: '550px',
      }}
      containerStyle={{
        paddingBlock: 'var(--margins-md)',
        paddingInline: 'var(--margins-lg)',
        gap: 'var(--margins-sm)',
        width: '100%',
        ...(rowWrap
          ? {
              flexDirection: 'row',
              flexWrap: 'wrap',
            }
          : {}),
      }}
    >
      {title ? (
        <h2 style={{ width: '100%', display: 'flex', gap: '4px' }}>
          {title}
          {titleAdornment ?? null}
        </h2>
      ) : null}
      {children}
    </PanelButtonGroup>
  );
}

function MainPage({ setPage }: DebugMenuPageProps) {
  // NOTE we use forceUpdate here and pass it through so the entire modal refreshes when a flag is toggled
  const forceUpdate = useUpdate();
  const isDebug = isDebugMode();
  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'flex-start',
        gap: 'var(--margins-lg)',
      }}
    >
      {!isDebug ? (
        <DebugMenuSection>
          {
            "The debug menu contains feature flag controls and experiments for unreleased Session features. They might not work, or may even break your client. Only use this menu if you know what you're doing. Some debug menu options are only available in debug mode."
          }
        </DebugMenuSection>
      ) : null}
      <FeatureFlags forceUpdate={forceUpdate} />
      <ProDebugSection forceUpdate={forceUpdate} setPage={setPage} />
      {isDebug ? <FeatureFlagDumper forceUpdate={forceUpdate} /> : null}
      {isDebug ? <DebugFeatureFlags forceUpdate={forceUpdate} /> : null}
      <DebugActions />
      {isDebug ? <ExperimentalActions forceUpdate={forceUpdate} /> : null}
      <LoggingDebugSection forceUpdate={forceUpdate} />
      <Playgrounds setPage={setPage} />
      {isDebug ? <DataGenerationActions /> : null}
      {isDebug ? <DebugUrlInteractionsSection /> : null}
      <ReleaseChannel />
      <div>
        <AboutInfo />
        <OtherInfo />
      </div>
    </div>
  );
}

function getPage(page: DEBUG_MENU_PAGE, setPage: Dispatch<DEBUG_MENU_PAGE>) {
  switch (page) {
    case DEBUG_MENU_PAGE.POPOVER:
      return <PopoverPlaygroundPage />;
    case DEBUG_MENU_PAGE.Pro:
      return <ProPlaygroundPage setPage={setPage} />;
    case DEBUG_MENU_PAGE.MAIN:
    default:
      return <MainPage setPage={setPage} />;
  }
}

export function DebugMenuModal() {
  const dispatch = getAppDispatch();

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
    <SessionWrapperModal
      modalId="debugMenuModal"
      headerChildren={
        <ModalBasicHeader
          title="Debug Menu"
          showExitIcon={true}
          extraLeftButton={
            page !== DEBUG_MENU_PAGE.MAIN ? (
              <ModalBackButton onClick={() => setPage(DEBUG_MENU_PAGE.MAIN)} />
            ) : null
          }
        />
      }
      topAnchor="5vh"
      onClose={onClose}
      $contentMaxWidth={WrapperModalWidth.debug}
      shouldOverflow={true}
      allowOutsideClick={false}
    >
      <StyledContent
        dir="ltr"
        $container={true}
        $flexDirection="column"
        $alignItems="flex-start"
        $padding="var(--margins-sm) 0 var(--margins-xl)"
      >
        {getPage(page, setPage)}
      </StyledContent>
    </SessionWrapperModal>
  );
}
