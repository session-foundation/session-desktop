import { useConversationUsername, useIsPublic } from '../../hooks/useParamSelector';
import { showLeaveGroupByConvoId } from '../../interactions/conversationInteractions';

export function useShowLeaveCommunityCb(conversationId?: string) {
  const isPublic = useIsPublic(conversationId);
  const username = useConversationUsername(conversationId) || conversationId;

  if (!isPublic || !conversationId) {
    return null;
  }

  return () => {
    void showLeaveGroupByConvoId(conversationId, username);
  };
}
