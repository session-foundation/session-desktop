import { useDispatch } from 'react-redux';
import { updateServerBanOrUnbanUserModal } from '../../state/ducks/modalDialog';
import { useIsPublic, useWeAreAdmin } from '../../hooks/useParamSelector';

export function useServerBanUserCb(conversationId?: string, pubkey?: string) {
  const dispatch = useDispatch();
  const isPublic = useIsPublic(conversationId);
  const weAreAdmin = useWeAreAdmin(conversationId);

  if (!isPublic || !weAreAdmin || !conversationId) {
    return null;
  }

  return () => {
    dispatch(updateServerBanOrUnbanUserModal({ banType: 'ban', conversationId, pubkey }));
  };
}
