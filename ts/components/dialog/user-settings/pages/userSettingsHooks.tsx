import { useDispatch } from 'react-redux';
import { tr } from '../../../../localization/localeTools';
import {
  userSettingsModal,
  type UserSettingsModalState,
} from '../../../../state/ducks/modalDialog';
import { assertUnreachable } from '../../../../types/sqlSharedTypes';

export function useUserSettingsTitle(page: UserSettingsModalState | undefined) {
  if (!page) {
    return tr('sessionSettings');
  }
  switch (page.userSettingsPage) {
    case 'appearance':
      return tr('sessionAppearance');
    case 'notifications':
      return tr('sessionNotifications');
    case 'clear-data':
      return tr('sessionClearData');
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
    case 'default':
    case undefined:
      return tr('sessionSettings');
    default:
      assertUnreachable(page.userSettingsPage, "useTitleFromPage doesn't support this page");
      throw new Error('useTitleFromPage does not support this page');
  }
}

export function useUserSettingsCloseAction(props: UserSettingsModalState) {
  const dispatch = useDispatch();
  if (!props?.userSettingsPage) {
    return null;
  }

  switch (props.userSettingsPage) {
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
      return () => dispatch(userSettingsModal(null));

    default:
      assertUnreachable(props.userSettingsPage, 'useCloseActionFromPage: invalid userSettingsPage');
      throw new Error('useCloseActionFromPage: invalid userSettingsPage');
  }
}

export function useUserSettingsBackAction(modalState: UserSettingsModalState) {
  const dispatch = useDispatch();
  if (!modalState?.userSettingsPage || modalState?.userSettingsPage === 'default') {
    // no back button if we are on the default page
    return undefined;
  }

  return () => {
    dispatch(
      userSettingsModal({
        userSettingsPage: 'default',
      })
    );
  };
}
