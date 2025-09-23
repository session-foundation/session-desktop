import { useDispatch } from 'react-redux';
import { tr } from '../../../../localization/localeTools';
import {
  userSettingsModal,
  type UserSettingsModalState,
  type UserSettingsPage,
} from '../../../../state/ducks/modalDialog';
import { assertUnreachable } from '../../../../types/sqlSharedTypes';

export function useUserSettingsTitle(page: UserSettingsModalState | undefined) {
  if (!page) {
    return tr('sessionSettings');
  }
  const { userSettingsPage } = page;
  switch (userSettingsPage) {
    case 'appearance':
      return tr('sessionAppearance');
    case 'notifications':
      return tr('sessionNotifications');
    case 'clear-data':
      return tr('sessionClearData');
    case 'blocked-contacts':
      return tr('conversationsBlockedContacts');
    case 'conversations':
      return tr('sessionConversations');
    case 'message-requests':
      return tr('sessionMessageRequests');
    case 'recovery-password':
      return tr('sessionRecoveryPassword');
    case 'privacy':
      return tr('sessionPrivacy');
    case 'help':
      return tr('sessionHelp');
    case 'preferences':
      return tr('preferences');
    case 'network':
      return tr('networkName');
    case 'password':
      return page.passwordAction === 'remove'
        ? tr('passwordRemove')
        : page.passwordAction === 'change'
          ? tr('passwordChange')
          : tr('passwordSet');
    case 'pro':
      return '';
    case 'default':
    case undefined:
      return tr('sessionSettings');
    default:
      assertUnreachable(userSettingsPage, "useTitleFromPage doesn't support this page");
      throw new Error('useTitleFromPage does not support this page');
  }
}

export function useUserSettingsCloseAction(props: UserSettingsModalState) {
  const dispatch = useDispatch();
  if (!props?.userSettingsPage) {
    return null;
  }

  const { userSettingsPage } = props;

  switch (userSettingsPage) {
    case 'default':
    case 'notifications':
    case 'appearance':
    case 'conversations':
    case 'privacy':
    case 'message-requests':
    case 'recovery-password':
    case 'help':
    case 'clear-data':
    case 'preferences':
    case 'blocked-contacts':
    case 'password':
    case 'network':
    case 'pro':
      return () => dispatch(userSettingsModal(null));

    default:
      assertUnreachable(userSettingsPage, 'useCloseActionFromPage: invalid userSettingsPage');
      throw new Error('useCloseActionFromPage: invalid userSettingsPage');
  }
}

export function useUserSettingsBackAction(modalState: UserSettingsModalState) {
  const dispatch = useDispatch();
  if (!modalState?.userSettingsPage || modalState?.userSettingsPage === 'default') {
    // no back button if we are on the default page
    return undefined;
  }

  let settingsPageToDisplayOnBack: UserSettingsPage = 'default';
  const { userSettingsPage } = modalState;

  switch (userSettingsPage) {
    case 'blocked-contacts':
      settingsPageToDisplayOnBack = 'conversations';
      break;
    case 'password':
      settingsPageToDisplayOnBack = 'privacy';
      break;
    case 'message-requests':
      // message requests is not a page of the user settings page, but a page in the left pane header currently.
      break;
    case 'recovery-password':
    case 'appearance':
    case 'clear-data':
    case 'conversations':
    case 'help':
    case 'notifications':
    case 'privacy':
    case 'preferences':
    case 'network':
    case 'pro':
      settingsPageToDisplayOnBack = 'default';
      break;
    default:
      assertUnreachable(userSettingsPage, 'useBackActionFromPage: invalid userSettingsPage');
      throw new Error('useBackActionFromPage: invalid userSettingsPage');
  }

  return () => {
    dispatch(
      userSettingsModal({
        userSettingsPage: settingsPageToDisplayOnBack,
      })
    );
  };
}
