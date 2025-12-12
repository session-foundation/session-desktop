import {
  useIsClosedGroup,
  useIsKickedFromGroup,
  useIsGroupDestroyed,
  useConversationUsernameWithFallback,
  useWeAreAdmin,
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

  // Note: if we are the only admin, leaving it will warn that it will actually delete it for everyone.

  if (
    !isClosedGroup ||
    isMessageRequestShown ||
    isGroupDestroyed ||
    isKickedFromGroup ||
    !conversationId ||
    weAreAdmin
  ) {
    return null;
  }

  return () => {
    void showLeaveGroupByConvoId(conversationId, username);
  };
}

// NOTE: [react-compiler] if we memoise this ourselves the compiler gets angry, but it will memoise it for us
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
