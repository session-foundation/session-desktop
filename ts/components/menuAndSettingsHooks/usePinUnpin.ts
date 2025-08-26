import {
  useIsKickedFromGroup,
  useIsLegacyGroup,
  useIsPinned,
  useIsPrivate,
  useIsPrivateAndFriend,
} from '../../hooks/useParamSelector';
import { useIsMessageRequestOverlayShown } from '../../state/selectors/section';

export function useShowPinUnpin(conversationId: string) {
  const isPrivateAndFriend = useIsPrivateAndFriend(conversationId);
  const isPrivate = useIsPrivate(conversationId);
  const isMessageRequest = useIsMessageRequestOverlayShown();
  const isLegacyGroup = useIsLegacyGroup(conversationId);
  const isPinned = useIsPinned(conversationId);
  const isKicked = useIsKickedFromGroup(conversationId);

  // legacy groups are read only. Pinning is not allowed
  if (isLegacyGroup && !isPinned) {
    return false;
  }

  if (isKicked) {
    // When we got kicked, we can only unpin
    return false;
  }

  return !isMessageRequest && (!isPrivate || (isPrivate && isPrivateAndFriend));
}
