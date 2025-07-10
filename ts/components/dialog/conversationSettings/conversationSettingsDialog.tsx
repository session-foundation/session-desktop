import { type ConversationSettingsModalState } from '../../../state/ducks/modalDialog';
import { DisappearingMessagesForConversationModal } from './pages/disappearing-messages/DisappearingMessagesPage';
import { DefaultConversationSettingsModal } from './pages/default/defaultPage';
import { NotificationForConversationModal } from './pages/notifications/NotificationPage';

export function ConversationSettingsDialog(props: ConversationSettingsModalState) {
  if (!props?.conversationId) {
    return null;
  }

  const modalPage = props.settingsModalPage;

  if (!props || modalPage === 'default') {
    return <DefaultConversationSettingsModal {...props} />;
  }

  if (modalPage === 'notifications') {
    return <NotificationForConversationModal {...props} />;
  }

  if (modalPage === 'disappearing_message') {
    return <DisappearingMessagesForConversationModal {...props} />;
  }

  throw new Error('Invalid modalPage');
}
