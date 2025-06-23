import { useDispatch } from 'react-redux';
import { useIsPublic, useWeAreAdmin } from '../../hooks/useParamSelector';
import { updateBanOrUnbanUserModal } from '../../state/ducks/modalDialog';

export function useUnbanUserCb(conversationId?: string, pubkey?: string) {
  const dispatch = useDispatch();
  const isPublic = useIsPublic(conversationId);
  const weAreAdmin = useWeAreAdmin(conversationId);

  if (!isPublic || !weAreAdmin || !conversationId) {
    return null;
  }

  return () => {
    dispatch(updateBanOrUnbanUserModal({ banType: 'unban', conversationId, pubkey }));
  };
}
