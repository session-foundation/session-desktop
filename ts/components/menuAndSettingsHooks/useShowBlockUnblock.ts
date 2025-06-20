import { useDispatch } from 'react-redux';
import {
  useIsMe,
  useIsBlocked,
  useIsPrivate,
  useIsIncomingRequest,
} from '../../hooks/useParamSelector';
import { PubKey } from '../../session/types';
import { updateBlockOrUnblockModal } from '../../state/ducks/modalDialog';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';

export function useShowBlockUnblock(convoId?: string) {
  const isMe = useIsMe(convoId);
  const isBlocked = useIsBlocked(convoId);
  const isPrivate = useIsPrivate(convoId);
  const isIncomingRequest = useIsIncomingRequest(convoId);
  const dispatch = useDispatch();

  const showBlockUnblock =
    convoId && !isMe && isPrivate && !isIncomingRequest && !PubKey.isBlinded(convoId);

  if (!showBlockUnblock) {
    return null;
  }

  if (isBlocked) {
    return {
      action: 'can_be_unblocked',
      cb: () =>
        dispatch(
          updateBlockOrUnblockModal({
            action: 'unblock',
            pubkeys: [convoId],
          })
        ),
      token: 'blockUnblock' as const,
      icon: LUCIDE_ICONS_UNICODE.USER_ROUND_CHECK,
    };
  }
  return {
    action: 'can_be_blocked',
    cb: () =>
      dispatch(
        updateBlockOrUnblockModal({
          action: 'block',
          pubkeys: [convoId],
        })
      ),
    token: 'block' as const,
    icon: LUCIDE_ICONS_UNICODE.USER_ROUND_X,
  };
}
