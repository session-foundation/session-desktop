import type { ConversationNotificationSettingType } from '../../models/conversationAttributes';
import { ConvoHub } from '../../session/conversations';

async function setNotificationForConvoId(
  conversationId: string,
  selected: ConversationNotificationSettingType
) {
  const conversation = ConvoHub.use().get(conversationId);

  const existingSettings = conversation.getNotificationsFor();
  if (existingSettings !== selected) {
    conversation.set({ triggerNotificationsFor: selected });
    await conversation.commit();
  }
}

export function useSetNotificationsFor(conversationId?: string) {
  return (selected: ConversationNotificationSettingType) => {
    if (!conversationId) {
      return;
    }
    void setNotificationForConvoId(conversationId, selected);
  };
}
