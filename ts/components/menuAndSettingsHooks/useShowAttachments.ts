import { useDispatch } from 'react-redux';
import { updateConversationSettingsModal } from '../../state/ducks/modalDialog';
import { useIsKickedFromGroup } from '../../hooks/useParamSelector';
import { openRightPanel } from '../../state/ducks/conversations';

export function useShowAttachments({ conversationId }: { conversationId: string }) {
  const dispatch = useDispatch();

  const isKickedFromGroup = useIsKickedFromGroup(conversationId);

  if (isKickedFromGroup) {
    // we can't show attachments if we are kicked from the group (no messages should be left )
    return null;
  }

  const cb = () => {
    dispatch(openRightPanel());
    dispatch(updateConversationSettingsModal(null));
  };

  return cb;
}
