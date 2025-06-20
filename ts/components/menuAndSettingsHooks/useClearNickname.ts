import {
  useIsMe,
  useHasNickname,
  useIsPrivate,
  useIsPrivateAndFriend,
} from '../../hooks/useParamSelector';
import { ConvoHub } from '../../session/conversations';

export function useClearNickname(conversationId?: string) {
  const isMe = useIsMe(conversationId);
  const hasNickname = useHasNickname(conversationId);
  const isPrivate = useIsPrivate(conversationId);
  const isPrivateAndFriend = useIsPrivateAndFriend(conversationId);

  if (isMe || !hasNickname || !isPrivate || !isPrivateAndFriend || !conversationId) {
    return null;
  }

  return () => {
    const conversation = ConvoHub.use().get(conversationId);
    void conversation.setNickname(null, true);
  };
}
