import { type UserSettingsModalState } from '../../../state/ducks/modalDialog';
import { assertUnreachable } from '../../../types/sqlSharedTypes';
import { AppearanceSettingsPage } from './pages/AppearanceSettingsPage';
import { BlockedContactsSettingsPage } from './pages/BlockedContactsSettingsPage';
import { ConversationSettingsPage } from './pages/ConversationSettingsPage';
import { DefaultSettingPage } from './pages/DefaultSettingsPage';
import { EditPasswordSettingsPage } from './pages/EditPasswordSettingsPage';
import { HelpSettingsPage } from './pages/HelpSettingsPage';
import { SessionNetworkPage } from './pages/network/SessionNetworkPage';
import { NotificationsSettingsPage } from './pages/NotificationsSettingsPage';
import { PreferencesSettingsPage } from './pages/PreferencesSettingsPage';
import { PrivacySettingsPage } from './pages/PrivacySettingsPage';
import { ProxySettingsPage } from './pages/ProxySettingsPage';
import { RecoveryPasswordSettingsPage } from './pages/RecoveryPasswordSettingsPage';
import { ProNonOriginatingPage } from './pages/user-pro/ProNonOriginatingPage';
import { ProSettingsPage } from './pages/user-pro/ProSettingsPage';

export const UserSettingsDialog = (modalState: UserSettingsModalState) => {
  if (!modalState?.userSettingsPage) {
    return null;
  }

  const { userSettingsPage } = modalState;

  switch (userSettingsPage) {
    case 'default':
      return <DefaultSettingPage {...modalState} />;
    case 'privacy':
      return <PrivacySettingsPage {...modalState} />;
    case 'notifications':
      return <NotificationsSettingsPage {...modalState} />;
    case 'conversations':
      return <ConversationSettingsPage {...modalState} />;
    case 'help':
      return <HelpSettingsPage {...modalState} />;
    case 'preferences':
      return <PreferencesSettingsPage {...modalState} />;
    case 'blocked-contacts':
      return <BlockedContactsSettingsPage {...modalState} />;
    case 'appearance':
      return <AppearanceSettingsPage {...modalState} />;
    case 'recovery-password':
      return <RecoveryPasswordSettingsPage {...modalState} />;
    case 'password':
      return <EditPasswordSettingsPage {...modalState} />;
    case 'proxy':
      return <ProxySettingsPage {...modalState} />;
    case 'network':
      return <SessionNetworkPage {...modalState} />;
    case 'pro':
      return <ProSettingsPage {...modalState} />;
    case 'proNonOriginating':
      return <ProNonOriginatingPage {...modalState} />;
    case 'message-requests':
      // the `message-request` is not a page of the user settings page, but a page in the left pane header currently.
      return null;
    case 'clear-data':
      // the `clear-data` is not a page of the user settings page, but a separate dialog.
      return null;
    default:
      return assertUnreachable(userSettingsPage, `Unknown user settings page: ${userSettingsPage}`);
  }
};
