import {
  useIsClosedGroup,
  useIsKickedFromGroup,
  useIsGroupDestroyed,
  useConversationUsernameWithFallback,
  useWeAreAdmin,
  useWeAreLastAdmin,
} from '../../hooks/useParamSelector';
import {
  showDeleteGroupByConvoId,
  showLeaveGroupByConvoId,
} from '../../interactions/conversationInteractions';
import { useIsMessageRequestOverlayShown } from '../../state/selectors/section';

export function useShowLeaveGroupCb(conversationId?: string) {
  const isClosedGroup = useIsClosedGroup(conversationId);
  const isKickedFromGroup = useIsKickedFromGroup(conversationId);
  const isGroupDestroyed = useIsGroupDestroyed(conversationId);
  const isMessageRequestShown = useIsMessageRequestOverlayShown();
  const username = useConversationUsernameWithFallback(true, conversationId);
  const weAreAdmin = useWeAreAdmin(conversationId);
  const weAreLastAdmin = useWeAreLastAdmin(conversationId);

  // Note: if we are the only admin, leaving it will warn that it will actually delete it for everyone.

  if (
    !isClosedGroup ||
    isMessageRequestShown ||
    isGroupDestroyed ||
    isKickedFromGroup ||
    !conversationId ||
    // if we are admin and we are the last admin, we can't leave the group (we have to delete it for everyone)
    (weAreAdmin && weAreLastAdmin)
  ) {
    return null;
  }

  return () => {
    void showLeaveGroupByConvoId(conversationId, username);
  };
}

// NOTE: [react-compiler] this convinces the compiler the hook is static
function useShowDeleteGroupInternal(conversationId?: string) {
  const isClosedGroup = useIsClosedGroup(conversationId);
  const isMessageRequestShown = useIsMessageRequestOverlayShown();
  const username = useConversationUsernameWithFallback(true, conversationId);
  return {
    isClosedGroup,
    isMessageRequestShown,
    username,
  };
}

export function useShowDeleteGroupCb(conversationId?: string) {
  // Note: useShowLeaveGroupCb and useShowDeleteGroupCb are dependent on each other
  // so I kept them in the same file
  const { isClosedGroup, isMessageRequestShown, username } =
    useShowDeleteGroupInternal(conversationId);
  const showLeaveIsOn = useShowLeaveGroupCb(conversationId);

  if (!isClosedGroup || isMessageRequestShown || showLeaveIsOn || !conversationId) {
    return null;
  }

  return () => void showDeleteGroupByConvoId(conversationId, username);
}
