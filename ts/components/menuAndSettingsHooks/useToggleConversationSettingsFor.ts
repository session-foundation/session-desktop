import { getAppDispatch } from '../../state/dispatch';
import { updateConversationSettingsModal } from '../../state/ducks/modalDialog';
import { useShowConversationSettingsFor } from './useShowConversationSettingsFor';
import { useConversationSettingsModal } from '../../state/selectors/modal';

export function useToggleConversationSettingsFor(conversationId?: string) {
  const dispatch = getAppDispatch();
  const convoSettings = useConversationSettingsModal();
  const showConvoSettingsCb = useShowConversationSettingsFor(conversationId);

  return showConvoSettingsCb
    ? () =>
        convoSettings
          ? dispatch(updateConversationSettingsModal(null))
          : showConvoSettingsCb({ settingsModalPage: 'default' })
    : undefined;
}
