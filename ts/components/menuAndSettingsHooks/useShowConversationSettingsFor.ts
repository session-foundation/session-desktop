import { useDispatch } from 'react-redux';
import {
  useIsPrivate,
  useIsPrivateAndFriend,
  useIsLegacyGroup,
} from '../../hooks/useParamSelector';
import {
  updateConversationSettingsModal,
  type ConversationSettingsPage,
} from '../../state/ducks/modalDialog';

export function useShowConversationSettingsFor(conversationId?: string) {
  const dispatch = useDispatch();
  const isPrivate = useIsPrivate(conversationId);
  const isPrivateAndFriend = useIsPrivateAndFriend(conversationId);
  const isLegacyGroup = useIsLegacyGroup(conversationId);

  if (isLegacyGroup || (isPrivate && !isPrivateAndFriend) || !conversationId) {
    return null;
  }

  return (modalPage: ConversationSettingsPage) => {
    dispatch(
      updateConversationSettingsModal({
        conversationId,
        ...modalPage,
      })
    );
  };
}
