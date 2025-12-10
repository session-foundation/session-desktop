import { getAppDispatch } from '../../state/dispatch';
import { useIsPublic } from '../../hooks/useParamSelector';
import { updateBanOrUnbanUserModal } from '../../state/ducks/modalDialog';
import { useWeAreCommunityAdminOrModerator } from '../../state/selectors/conversations';

export function useUnbanUserCb(conversationId?: string, pubkey?: string) {
  const dispatch = getAppDispatch();
  const isPublic = useIsPublic(conversationId);
  const weAreCommunityAdminOrModerator = useWeAreCommunityAdminOrModerator(conversationId);

  if (!isPublic || !weAreCommunityAdminOrModerator || !conversationId) {
    return null;
  }

  return () => {
    dispatch(updateBanOrUnbanUserModal({ banType: 'unban', conversationId, pubkey }));
  };
}
