import { useConversationUsername, useIsPublic } from '../../hooks/useParamSelector';
import { showLeaveCommunityByConvoId } from '../../interactions/conversationInteractions';

export function useShowLeaveCommunityCb(conversationId?: string) {
  const isPublic = useIsPublic(conversationId);
  const username = useConversationUsername(conversationId) || conversationId;

  if (!isPublic || !conversationId) {
    return null;
  }

  return () => {
    void showLeaveCommunityByConvoId(conversationId, username);
  };
}
