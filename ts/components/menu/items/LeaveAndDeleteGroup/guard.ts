function sharedEnabled({
  isGroup,
  isPublic,
  isMessageRequestShown,
}: Pick<
  Parameters<typeof showLeaveGroupItem>[0],
  'isGroup' | 'isMessageRequestShown' | 'isPublic'
>) {
  return isGroup && !isMessageRequestShown && !isPublic;
}
/**
 * We can try leave a group if
 * - we are an admin of the group (that group would be marked as destroyed on delete)
 * and
 * - we are a **not kicked** member (if we are kicked without knowing about it and try to leave, we will silently remove the group)
 *
 * Note: Those actions are hidden if the group is a group request (as we have other buttons to accept/decline a group request).
 *
 * Note: If we fail to leave the group but that error is retryable, we will keep the group displaying the "leave" option.
 */
export function showLeaveGroupItem({
  isGroup,
  isPublic,
  isKickedFromGroup,
  isMessageRequestShown,
  isGroupDestroyed,
}: {
  isGroup: boolean;
  isPublic: boolean;
  isMessageRequestShown: boolean;
  isKickedFromGroup: boolean;
  isGroupDestroyed: boolean;
}) {
  return (
    sharedEnabled({ isGroup, isMessageRequestShown, isPublic }) &&
    !isKickedFromGroup &&
    !isGroupDestroyed
  );
}

/**
 * We can try to delete a group only if the `showLeaveGroupItem` returns false.
 * Note: those actions are hidden if the group is a group request (as we have other buttons to accept/decline a group request)
 */
export function showDeleteGroupItem(args: {
  isGroup: boolean;
  isPublic: boolean;
  isMessageRequestShown: boolean;
  isKickedFromGroup: boolean;
  isGroupDestroyed: boolean;
  is03GroupExpired: boolean;
}) {
  return (sharedEnabled(args) && !showLeaveGroupItem(args)) || args.is03GroupExpired;
}
