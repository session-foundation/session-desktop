import { type UserSettingsModalState } from '../../../state/ducks/modalDialog';
import { DefaultSettingPage } from './pages/DefaultSettingsPage';
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
    default:
      return <DefaultSettingPage />;
  }
};
