import { getAppDispatch } from '../../state/dispatch';
import { updateInviteContactModal } from '../../state/ducks/modalDialog';
import { useIsPublic } from '../../hooks/useParamSelector';

export function useShowInviteContactToCommunity(conversationId: string) {
  const dispatch = getAppDispatch();
  const isPublic = useIsPublic(conversationId);
  const cb = () => dispatch(updateInviteContactModal({ conversationId }));

  if (!isPublic) {
    return null;
  }

  return cb;
}
