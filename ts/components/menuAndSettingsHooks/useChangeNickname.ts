import { getAppDispatch } from '../../state/dispatch';
import { useIsMe, useIsPrivate, useIsPrivateAndFriend } from '../../hooks/useParamSelector';
import { changeNickNameModal } from '../../state/ducks/modalDialog';

export function useChangeNickname(conversationId?: string) {
  const dispatch = getAppDispatch();
  const isMe = useIsMe(conversationId);
  const isPrivate = useIsPrivate(conversationId);
  const isPrivateAndFriend = useIsPrivateAndFriend(conversationId);

  if (isMe || !isPrivate || !isPrivateAndFriend || !conversationId) {
    return null;
  }

  return () => {
    dispatch(changeNickNameModal({ conversationId }));
  };
}
