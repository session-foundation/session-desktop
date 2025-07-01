import {
  useIsBlocked,
  useIsActive,
  useIsKickedFromGroup,
  useIsPrivateAndFriend,
  useIsPrivate,
  useIsMe,
} from '../../hooks/useParamSelector';
import { useIsMessageRequestOverlayShown } from '../../state/selectors/section';
import { useLibGroupDestroyed } from '../../state/selectors/userGroups';

/**
 * Return true if we should display the options to update the notifications for this convo.
 */
export const useShowNotificationFor = (convoId: string) => {
  const isBlocked = useIsBlocked(convoId);
  const isActive = useIsActive(convoId);
  const isKickedFromGroup = useIsKickedFromGroup(convoId);
  const isGroupDestroyed = useLibGroupDestroyed(convoId);

  const isFriend = useIsPrivateAndFriend(convoId);
  const isPrivate = useIsPrivate(convoId);
  const isMessageRequestShown = useIsMessageRequestOverlayShown();
  const isMe = useIsMe(convoId);

  if (
    isMe ||
    !convoId ||
    isMessageRequestShown ||
    isKickedFromGroup ||
    isGroupDestroyed ||
    isBlocked ||
    !isActive ||
    (isPrivate && !isFriend)
  ) {
    return false;
  }
  return true;
};
