import { type UserSettingsModalState } from '../../../state/ducks/modalDialog';
import { assertUnreachable } from '../../../types/sqlSharedTypes';
import { AppearanceSettingsPage } from './pages/AppearanceSettingsPage';
import { BlockedContactsSettingsPage } from './pages/BlockedContactsSettingsPage';
import { ConversationSettingsPage } from './pages/ConversationSettingsPage';
import { DefaultSettingPage } from './pages/DefaultSettingsPage';
import { HelpSettingsPage } from './pages/HelpSettingsPage';
import { NotificationsSettingsPage } from './pages/NotificationsSettingsPage';
import { PreferencesSettingsPage } from './pages/PreferencesSettingsPage';
import { PrivacySettingsPage } from './pages/PrivacySettingsPage';
import { RecoveryPasswordSettingsPage } from './pages/RecoveryPasswordSettingsPage';

export const UserSettingsDialog = (modalState: UserSettingsModalState) => {
  if (!modalState?.userSettingsPage) {
    return null;
  }

  switch (modalState.userSettingsPage) {
    case 'default':
      return <DefaultSettingPage />;
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
    case 'message-requests':
      // the `message-request` is not a page of the user settings page, but a page in the left pane header currently.
      return null;
    default:
      return assertUnreachable(
        modalState.userSettingsPage,
        `Unknown user settings page: ${modalState.userSettingsPage}`
      );
  }
};
