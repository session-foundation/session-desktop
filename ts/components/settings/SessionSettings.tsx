import { useState } from 'react';
import styled from 'styled-components';

import { useDispatch } from 'react-redux';
import useMount from 'react-use/lib/useMount';
import { SettingsHeader } from './SessionSettingsHeader';

import { SessionIconButton } from '../icon';

import { SessionNotificationGroupSettings } from './SessionNotificationGroupSettings';

import { sessionPassword } from '../../state/ducks/modalDialog';
import { sectionActions, SectionType } from '../../state/ducks/section';
import type { PasswordAction, SessionSettingCategory } from '../../types/ReduxTypes';
import { getPasswordHash } from '../../util/storage';
import { SettingsCategoryAppearance } from './section/CategoryAppearance';
import { CategoryConversations } from './section/CategoryConversations';
import { SettingsCategoryHelp } from './section/CategoryHelp';
import { SettingsCategoryPermissions } from './section/CategoryPermissions';
import { SettingsCategoryPrivacy } from './section/CategoryPrivacy';
import { SettingsCategoryRecoveryPassword } from './section/CategoryRecoveryPassword';
import { setDebugMode } from '../../state/ducks/debug';
import { showLinkVisitWarningDialog } from '../dialog/OpenUrlModal';

export function displayPasswordModal(
  passwordAction: PasswordAction,
  onPasswordUpdated: (action: string) => void
) {
  window.inboxStore?.dispatch(
    sessionPassword({
      passwordAction,
      onOk: () => {
        onPasswordUpdated(passwordAction);
      },
    })
  );
}

export function getMediaPermissionsSettings() {
  return window.getSettingValue('media-permissions');
}

export function getCallMediaPermissionsSettings() {
  return window.getSettingValue('call-media-permissions');
}

export interface SettingsViewProps {
  category: SessionSettingCategory;
}

const StyledVersionInfo = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;

  padding: var(--margins-sm) var(--margins-md);
  background: none;
  font-size: var(--font-size-xs);
`;

const StyledSpanSessionInfo = styled.span<{ opacity?: number }>`
  opacity: ${props => props.opacity ?? 0.5};
  transition: var(--default-duration);
  user-select: text;
  cursor: pointer;

  &:hover {
    opacity: 1;
  }
`;

const SessionInfo = () => {
  const [clickCount, setClickCount] = useState(0);

  const dispatch = useDispatch();

  return (
    <StyledVersionInfo>
      <StyledSpanSessionInfo
        onClick={() => {
          showLinkVisitWarningDialog(
            `https://github.com/session-foundation/session-desktop/releases/tag/v${window.versionInfo.version}`,
            dispatch
          );
        }}
      >
        v{window.versionInfo.version}
      </StyledSpanSessionInfo>
      <StyledSpanSessionInfo opacity={0.8}>
        <SessionIconButton
          iconSize="medium"
          iconType="sessionTokenLogoWithText"
          onClick={() => {
            showLinkVisitWarningDialog('https://token.getsession.org/', dispatch);
          }}
        />
      </StyledSpanSessionInfo>
      <StyledSpanSessionInfo
        onClick={() => {
          setClickCount(clickCount + 1);
          if (clickCount === 10) {
            dispatch(setDebugMode(true));
            setClickCount(0);
          }
        }}
      >
        {window.versionInfo.commitHash}
      </StyledSpanSessionInfo>
    </StyledVersionInfo>
  );
};

const SettingInCategory = (props: {
  category: SessionSettingCategory;
  onPasswordUpdated: (action: string) => void;
  hasPassword: boolean;
}) => {
  const { category, onPasswordUpdated, hasPassword } = props;

  switch (category) {
    // special case for blocked user
    case 'conversations':
      return <CategoryConversations />;
    case 'appearance':
      return <SettingsCategoryAppearance />;
    case 'notifications':
      return <SessionNotificationGroupSettings />;
    case 'privacy':
      return (
        <SettingsCategoryPrivacy onPasswordUpdated={onPasswordUpdated} hasPassword={hasPassword} />
      );
    case 'help':
      return <SettingsCategoryHelp />;
    case 'permissions':
      return <SettingsCategoryPermissions />;
    case 'recovery-password':
      return <SettingsCategoryRecoveryPassword />;

    // these are just buttons or modals and don't have screens
    case 'message-requests':
    case 'session-network':
    case 'clear-data':
    default:
      return null;
  }
};

const StyledSettingsView = styled.div`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
`;

const StyledSettingsList = styled.div`
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
`;

export const SessionSettingsView = (props: SettingsViewProps) => {
  const { category } = props;
  const dispatch = useDispatch();

  const [hasPassword, setHasPassword] = useState(true);
  useMount(() => {
    const hash = getPasswordHash();
    setHasPassword(!!hash);
  });

  function onPasswordUpdated(action: string) {
    if (action === 'set' || action === 'change') {
      setHasPassword(true);
      dispatch(sectionActions.showLeftPaneSection(SectionType.Message));
    }

    if (action === 'remove') {
      setHasPassword(false);
    }
  }

  return (
    <div className="session-settings">
      <SettingsHeader category={category} />
      <StyledSettingsView>
        <StyledSettingsList>
          <SettingInCategory
            category={category}
            onPasswordUpdated={onPasswordUpdated}
            hasPassword={hasPassword}
          />
        </StyledSettingsList>
        <SessionInfo />
      </StyledSettingsView>
    </div>
  );
};
