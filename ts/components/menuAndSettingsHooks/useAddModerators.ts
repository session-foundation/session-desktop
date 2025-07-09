import { useDispatch } from 'react-redux';
import { useIsPublic, useWeAreAdmin } from '../../hooks/useParamSelector';
import { updateAddModeratorsModal } from '../../state/ducks/modalDialog';

export function useAddModeratorsCb(conversationId: string) {
  const dispatch = useDispatch();
  const isPublic = useIsPublic(conversationId);
  const weAreAdmin = useWeAreAdmin(conversationId);
  // only an admin can add moderators from a community. Another moderator cannot.

  if (!isPublic || !weAreAdmin) {
    return null;
  }

  return () => {
    dispatch(updateAddModeratorsModal({ conversationId }));
  };
}
