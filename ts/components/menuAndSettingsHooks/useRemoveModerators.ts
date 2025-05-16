import { useDispatch } from 'react-redux';
import { useIsPublic, useWeAreAdmin } from '../../hooks/useParamSelector';
import { updateRemoveModeratorsModal } from '../../state/ducks/modalDialog';

export function useRemoveModeratorsCb(conversationId: string) {
  const dispatch = useDispatch();
  const isPublic = useIsPublic(conversationId);
  const weAreAdmin = useWeAreAdmin(conversationId);

  if (!isPublic || !weAreAdmin) {
    return null;
  }

  return () => {
    dispatch(updateRemoveModeratorsModal({ conversationId }));
  };
}
