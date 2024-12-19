function sharedEnabled({
  isGroup,
  isMessageRequestShown,
}: Pick<Parameters<typeof showLeaveGroupItem>[0], 'isGroup' | 'isMessageRequestShown'>) {
  return isGroup && !isMessageRequestShown;
}

export function showLeaveGroupItem({
  isGroup,
  isKickedFromGroup,
  isMessageRequestShown,
  lastMessageIsLeaveError,
}: {
  isGroup: boolean;
  isMessageRequestShown: boolean;
  lastMessageIsLeaveError: boolean;
  isKickedFromGroup: boolean;
}) {
  // we can't try to leave the group if we were kicked from it, or if we've already tried to (lastMessageIsLeaveError is true)
  return (
    sharedEnabled({ isGroup, isMessageRequestShown }) &&
    !isKickedFromGroup &&
    !lastMessageIsLeaveError
  );
}

export function showDeleteGroupItem({
  isGroup,
  isKickedFromGroup,
  isMessageRequestShown,
  lastMessageIsLeaveError,
}: {
  isGroup: boolean;
  isMessageRequestShown: boolean;
  lastMessageIsLeaveError: boolean;
  isKickedFromGroup: boolean;
}) {
  return (
    sharedEnabled({ isGroup, isMessageRequestShown }) &&
    (isKickedFromGroup || lastMessageIsLeaveError)
  );
}
