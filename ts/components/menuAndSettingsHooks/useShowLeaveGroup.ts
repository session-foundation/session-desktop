import {
  useIsClosedGroup,
  useIsKickedFromGroup,
  useIsGroupDestroyed,
  useConversationUsername,
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
  const username = useConversationUsername(conversationId) || conversationId;
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

export function useShowDeleteGroupCb(conversationId?: string) {
  // Note: useShowLeaveGroupCb and useShowDeleteGroupCb are dependent on each other
  // so I kept them in the same file
  const isClosedGroup = useIsClosedGroup(conversationId);
  const isMessageRequestShown = useIsMessageRequestOverlayShown();
  const username = useConversationUsername(conversationId) || conversationId;
  const showLeaveIsOn = useShowLeaveGroupCb(conversationId);

  if (!isClosedGroup || isMessageRequestShown || showLeaveIsOn || !conversationId) {
    return null;
  }

  return () => void showDeleteGroupByConvoId(conversationId, username);
}
