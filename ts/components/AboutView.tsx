import { useEffect } from 'react';
import styled from 'styled-components';
import { Provider } from 'react-redux';
import { shell } from 'electron';
import { SessionTheme } from '../themes/SessionTheme';
import { switchThemeTo } from '../themes/switchTheme';
import { SessionToastContainer } from './SessionToastContainer';
import { Flex } from './basic/Flex';
import { themeStore } from '../state/theme/store';
import { SessionButton, SessionButtonType } from './basic/SessionButton';
import { Localizer } from './basic/Localizer';
import { CopyToClipboardButton } from './buttons';
import { localize } from '../localization/localeTools';

const StyledContent = styled(Flex)`
  background-color: var(--background-primary-color);
  color: var(--text-primary-color);
  text-align: center;

  font-family: var(--font-default);
  font-size: var(--font-size-sm);
  height: 100%;
  width: 100%;

  a {
    color: var(--text-primary-color);
  }

  img:first-child {
    filter: brightness(0) saturate(100%) invert(75%) sepia(84%) saturate(3272%) hue-rotate(103deg)
      brightness(106%) contrast(103%);
    margin: var(--margins-2xl) 0 var(--margins-lg);
  }

  img:nth-child(2) {
    filter: var(--session-logo-text-current-filter);
    margin-bottom: var(--margins-xl);
  }

  .session-button {
    font-size: var(--font-size-sm);
    font-weight: 400;
    min-height: var(--font-size-sm);
    height: var(--font-size-sm);
    font-size: var(--font-size-sm);
    margin-bottom: var(--margins-sm);
  }
`;

export const AboutView = () => {
  // Add debugging metadata - environment if not production, app instance name
  const environmentStates = [];

  if (window.getEnvironment() !== 'production') {
    environmentStates.push(window.getEnvironment());
  }

  if (window.getAppInstance()) {
    environmentStates.push(window.getAppInstance());
  }

  const version = window.getVersion();
  const versionInfo = localize('updateVersion').withArgs({ version }).toString();
  const systemInfo = localize('systemInformationDesktop')
    .withArgs({
      information: window.getOSRelease(),
    })
    .toString();
  const commitInfo = localize('commitHashDesktop')
    .withArgs({
      hash: window.getCommitHash() || localize('unknown').toString(),
    })
    .toString();

  useEffect(() => {
    if (window.theme) {
      void switchThemeTo({
        theme: window.theme,
        usePrimaryColor: true,
      });
    }
  }, []);

  return (
    <Provider store={themeStore}>
      <SessionTheme>
        <SessionToastContainer />
        <StyledContent
          $container={true}
          $flexDirection={'column'}
          $justifyContent={'center'}
          $alignItems={'center'}
        >
          <img
            src="images/session/session_icon.png"
            alt="session brand icon"
            width="200"
            height="200"
          />
          <img
            src="images/session/session-text.svg"
            alt="session brand text"
            width={192}
            height={26}
          />
          <CopyToClipboardButton
            className="version"
            text={versionInfo}
            buttonType={SessionButtonType.Simple}
          />
          <SessionButton
            buttonType={SessionButtonType.Simple}
            margin="0 0 var(--margins-lg) 0"
            style={{ textDecoration: 'underline' }}
            onClick={() => {
              void shell.openExternal(
                `https://github.com/session-foundation/session-desktop/releases/tag/v${version}`
              );
            }}
          >
            <Localizer token="updateReleaseNotes" />
          </SessionButton>
          <CopyToClipboardButton
            className="os"
            text={systemInfo}
            buttonType={SessionButtonType.Simple}
          />
          <CopyToClipboardButton
            className="commitHash"
            text={commitInfo}
            buttonType={SessionButtonType.Simple}
          />
          {environmentStates.length ? (
            <CopyToClipboardButton
              className="environment"
              text={environmentStates.join(' - ')}
              buttonType={SessionButtonType.Simple}
            />
          ) : null}
          <a href="https://getsession.org" style={{ margin: '0 0 var(--margins-lg) 0' }}>
            https://getsession.org
          </a>
          <a className="privacy" href="https://getsession.org/privacy-policy">
            <Localizer token="onboardingPrivacy" />
          </a>
          <a className="privacy" href="https://getsession.org/terms-of-service/">
            <Localizer token="onboardingTos" />
          </a>
        </StyledContent>
      </SessionTheme>
    </Provider>
  );
};
