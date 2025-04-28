import {
  useIsMe,
  useIsBlocked,
  useIsPrivate,
  useIsIncomingRequest,
} from '../../hooks/useParamSelector';
import { PubKey } from '../../session/types';

export function useShowBlockUnblock(convoId: string) {
  const isMe = useIsMe(convoId);
  const isBlocked = useIsBlocked(convoId);
  const isPrivate = useIsPrivate(convoId);
  const isIncomingRequest = useIsIncomingRequest(convoId);

  const showBlockUnblock = isMe && isPrivate && !isIncomingRequest && !PubKey.isBlinded(convoId);

  if (!showBlockUnblock) {
    return null;
  }

  if (isBlocked) {
    return 'can_be_unblocked';
  }
  return 'can_be_blocked';
}
