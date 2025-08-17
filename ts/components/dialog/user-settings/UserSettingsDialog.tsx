import { type UserSettingsModalState } from '../../../state/ducks/modalDialog';
import { ConversationSettingsPage } from './pages/ConversationSettingsPage';
import { DefaultSettingPage } from './pages/DefaultSettingsPage';
import { HelpSettingsPage } from './pages/HelpSettingsPage';
import { NotificationsSettingsPage } from './pages/NotificationsSettingsPage';
import { PrivacySettingsPage } from './pages/PrivacySettingsPage';

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
    default:
      return <DefaultSettingPage />;
  }
};
