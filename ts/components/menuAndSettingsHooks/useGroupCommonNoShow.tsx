import { useIsActive, useIsBlocked, useIsKickedFromGroup } from '../../hooks/useParamSelector';

export function useGroupCommonNoShow(convoId: string) {
  const isKickedFromGroup = useIsKickedFromGroup(convoId);
  const isBlocked = useIsBlocked(convoId);
  const isActive = useIsActive(convoId);

  return isKickedFromGroup || isBlocked || !isActive;
}
