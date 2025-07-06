import { useDispatch } from 'react-redux';
import { useIsPublic, useWeAreAdmin } from '../../hooks/useParamSelector';
import { updateGroupPermissionsModal } from '../../state/ducks/modalDialog';

export function useChangeCommunityPermissionsCb(conversationId?: string) {
  const dispatch = useDispatch();
  const isPublic = useIsPublic(conversationId);
  const weAreAdmin = useWeAreAdmin(conversationId);

  if (!isPublic || !weAreAdmin || !conversationId) {
    return null;
  }

  return () => {
    dispatch(updateGroupPermissionsModal({ conversationId }));
  };
}
