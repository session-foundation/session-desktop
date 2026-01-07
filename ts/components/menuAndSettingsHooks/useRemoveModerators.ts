import { getAppDispatch } from '../../state/dispatch';
import { useIsPublic, useWeAreAdmin } from '../../hooks/useParamSelector';
import { updateRemoveModeratorsModal } from '../../state/ducks/modalDialog';

export function useRemoveModeratorsCb(conversationId: string) {
  const dispatch = getAppDispatch();
  const isPublic = useIsPublic(conversationId);
  const weAreAdmin = useWeAreAdmin(conversationId);
  // only an admin can remove moderators from a community. Another moderator cannot.

  if (!isPublic || !weAreAdmin) {
    return null;
  }

  return () => {
    dispatch(updateRemoveModeratorsModal({ conversationId }));
  };
}
