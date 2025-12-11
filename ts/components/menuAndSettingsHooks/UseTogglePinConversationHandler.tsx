import { useIsProAvailable } from '../../hooks/useIsProAvailable';
import { ConvoHub } from '../../session/conversations';
import {
  useIsKickedFromGroup,
  useIsLegacyGroup,
  useIsPinned,
  useIsPrivate,
  useIsPrivateAndFriend,
} from '../../hooks/useParamSelector';
import { useShowSessionCTACbWithVariant } from '../dialog/SessionCTA';
import { Constants } from '../../session';
import { useIsMessageRequestOverlayShown } from '../../state/selectors/section';
import { useCurrentUserHasPro } from '../../hooks/useHasPro';
import { CTAVariant } from '../dialog/cta/types';
import { usePinnedConversationsCount } from '../../state/selectors/conversations';

function useShowPinUnpin(conversationId: string) {
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

export function useTogglePinConversationHandler(id: string) {
  const conversation = ConvoHub.use().get(id);
  const isPinned = useIsPinned(id);

  const pinnedConversationsCount = usePinnedConversationsCount();
  const isProAvailable = useIsProAvailable();
  const hasPro = useCurrentUserHasPro();

  const handleShowProDialog = useShowSessionCTACbWithVariant();

  const showPinUnpin = useShowPinUnpin(id);

  if (!showPinUnpin) {
    return null;
  }

  if (
    isPinned ||
    !isProAvailable ||
    hasPro ||
    pinnedConversationsCount < Constants.CONVERSATION.MAX_PINNED_CONVERSATIONS_STANDARD
  ) {
    return () => conversation?.togglePinned();
  }

  return () =>
    handleShowProDialog(
      pinnedConversationsCount > Constants.CONVERSATION.MAX_PINNED_CONVERSATIONS_STANDARD
        ? CTAVariant.PRO_PINNED_CONVERSATION_LIMIT_GRANDFATHERED
        : CTAVariant.PRO_PINNED_CONVERSATION_LIMIT
    );
}
