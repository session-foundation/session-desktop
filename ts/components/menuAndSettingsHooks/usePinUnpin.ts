import {
  useIsLegacyGroup,
  useIsPinned,
  useIsPrivate,
  useIsPrivateAndFriend,
} from '../../hooks/useParamSelector';
import {
  useIsMessageRequestOverlayShown,
  useIsMessageSection,
} from '../../state/selectors/section';

export function useShowPinUnpin(conversationId: string) {
  const isMessagesSection = useIsMessageSection();
  const isPrivateAndFriend = useIsPrivateAndFriend(conversationId);
  const isPrivate = useIsPrivate(conversationId);
  const isMessageRequest = useIsMessageRequestOverlayShown();
  const isLegacyGroup = useIsLegacyGroup(conversationId);
  const isPinned = useIsPinned(conversationId);

  // legacy groups are read only. Pinning is not allowed
  if (isLegacyGroup && !isPinned) {
    return false;
  }

  return (
    isMessagesSection && !isMessageRequest && (!isPrivate || (isPrivate && isPrivateAndFriend))
  );
}
