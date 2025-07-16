import { noop } from 'lodash';
import { useDispatch } from 'react-redux';
import { localize } from '../../../../localization/localeTools';
import {
  ConversationSettingsModalPage,
  ConversationSettingsModalState,
  updateConversationSettingsModal,
} from '../../../../state/ducks/modalDialog';
import { assertUnreachable } from '../../../../types/sqlSharedTypes';
import { useShowConversationSettingsFor } from '../../../menuAndSettingsHooks/useShowConversationSettingsFor';

export function useTitleFromPage(page: ConversationSettingsModalPage | undefined) {
  switch (page) {
    case 'disappearing_message':
      return localize('disappearingMessages').toString();
    case 'notifications':
      return localize('sessionNotifications').toString();
    case 'default':
    case undefined:
      return localize('sessionSettings').toString();
    default:
      assertUnreachable(page, "useTitleFromPage doesn't support this page");
      throw new Error('useTitleFromPage does not support this page');
  }
}

export function useCloseActionFromPage(props: ConversationSettingsModalState) {
  const dispatch = useDispatch();
  const showConvoSettingsCb = useShowConversationSettingsFor(props?.conversationId);
  if (!props?.conversationId || !showConvoSettingsCb) {
    return noop;
  }
  switch (props.settingsModalPage) {
    case 'disappearing_message':
    case 'notifications':
      return props.standalonePage
        ? () => dispatch(updateConversationSettingsModal(null))
        : () =>
            showConvoSettingsCb?.({
              settingsModalPage: 'default',
            });

    default:
      return () => dispatch(updateConversationSettingsModal(null));
  }
}

export function useBackActionForPage(modalState: ConversationSettingsModalState) {
  const showConvoSettingsCb = useShowConversationSettingsFor(modalState?.conversationId);

  if (
    !modalState?.settingsModalPage ||
    modalState?.settingsModalPage === 'default' ||
    modalState?.standalonePage ||
    !showConvoSettingsCb
  ) {
    // no back button if we are on the default page or if the page is standalone
    return undefined;
  }

  return () => {
    showConvoSettingsCb({
      settingsModalPage: 'default',
    });
  };
}
