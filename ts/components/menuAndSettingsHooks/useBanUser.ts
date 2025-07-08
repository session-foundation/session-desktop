import { useDispatch } from 'react-redux';
import { useIsPublic } from '../../hooks/useParamSelector';
import { updateBanOrUnbanUserModal } from '../../state/ducks/modalDialog';
import { useWeAreCommunityAdminOrModerator } from '../../state/selectors/conversations';

export function useBanUserCb(conversationId?: string, pubkey?: string) {
  const dispatch = useDispatch();
  const isPublic = useIsPublic(conversationId);
  const weAreCommunityAdminOrModerator = useWeAreCommunityAdminOrModerator(conversationId);

  if (!isPublic || !weAreCommunityAdminOrModerator || !conversationId) {
    return null;
  }

  return () => {
    dispatch(updateBanOrUnbanUserModal({ banType: 'ban', conversationId, pubkey }));
  };
}
