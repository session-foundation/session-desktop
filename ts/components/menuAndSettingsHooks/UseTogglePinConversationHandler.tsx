import { useSelector } from 'react-redux';
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
import { useCurrentUserHasPro, useCurrentUserHasProAccess } from '../../hooks/useHasPro';
import { CTAVariant } from '../dialog/cta/types';
import { getPinnedConversationsCount } from '../../state/selectors/conversations';

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

// NOTE: [react-compiler] this has to live here for the hook to be identified as static
function usePinnedConversationCount() {
  return useSelector(getPinnedConversationsCount);
}

// ACCESS gates the pin: pinning past the standard limit is a capability, and someone holding no usable
// proof genuinely must not do it whatever their plan says. DISPLAY decides only whether we then offer to
// sell them something — see the split at the end of the hook.
// NOTE: [react-compiler] this convinces the compiler the hook is static
const useHasProInternal = useCurrentUserHasProAccess;
const usePlanReadsActiveInternal = useCurrentUserHasPro;
const useIsPinnedInternal = useIsPinned;
const useCTACallbackInternal = useShowSessionCTACbWithVariant;

export function useTogglePinConversationHandler(id: string) {
  const conversation = ConvoHub.use().get(id);
  const isPinned = useIsPinnedInternal(id);
  const pinnedConversationsCount = usePinnedConversationCount();
  const hasPro = useHasProInternal();
  const planReadsActive = usePlanReadsActiveInternal();
  const handleShowProDialog = useCTACallbackInternal();

  const showPinUnpin = useShowPinUnpin(id);

  if (!showPinUnpin) {
    return null;
  }

  if (
    isPinned ||
    hasPro ||
    pinnedConversationsCount < Constants.CONVERSATION.MAX_PINNED_CONVERSATIONS_STANDARD
  ) {
    return () => conversation?.togglePinned();
  }

  // Refused either way — the gate above is ACCESS and has already decided. What differs is whether we
  // explain the refusal by offering Pro, and that is DISPLAY: a plan reading active must not be sold a
  // subscription it is already paying for.
  //
  // Blocked on copy, and an accepted trade rather than an oversight. In the active-plan-with-no-usable-
  // proof state this refuses the pin and says nothing at all, because the only copy that exists here is
  // upsell copy and there is no string for "your plan is active but we cannot verify it yet". Accepted
  // deliberately rather than missed, so that the two-value split was not held up by a translation round
  // for an edge case. When that string lands, show it here — do NOT resolve this by putting the upsell
  // back.
  if (planReadsActive) {
    return () => {
      window.log.debug(
        '[pro] pin refused: no usable Pro proof, and the plan reads active so no upsell is shown'
      );
    };
  }

  return () =>
    handleShowProDialog(
      pinnedConversationsCount > Constants.CONVERSATION.MAX_PINNED_CONVERSATIONS_STANDARD
        ? CTAVariant.PRO_PINNED_CONVERSATION_LIMIT_GRANDFATHERED
        : CTAVariant.PRO_PINNED_CONVERSATION_LIMIT
    );
}
