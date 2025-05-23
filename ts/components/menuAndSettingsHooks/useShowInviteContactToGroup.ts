import { useDispatch } from 'react-redux';
import {
  useIsBlocked,
  useIsGroupDestroyed,
  useIsGroupV2,
  useIsKickedFromGroup,
  useWeAreAdmin,
} from '../../hooks/useParamSelector';
import { updateInviteContactModal } from '../../state/ducks/modalDialog';

export function useShowInviteContactToGroupCb(conversationId: string) {
  const dispatch = useDispatch();
  const isGroupV2 = useIsGroupV2(conversationId);
  const isBlocked = useIsBlocked(conversationId);
  const isKickedFromGroup = useIsKickedFromGroup(conversationId);
  const isGroupDestroyed = useIsGroupDestroyed(conversationId);
  const weAreAdmin = useWeAreAdmin(conversationId);
  const showInviteGroupV2 =
    isGroupV2 && !isKickedFromGroup && !isBlocked && weAreAdmin && !isGroupDestroyed;
  const cb = () => dispatch(updateInviteContactModal({ conversationId }));

  if (!showInviteGroupV2) {
    return null;
  }

  return cb;
}
