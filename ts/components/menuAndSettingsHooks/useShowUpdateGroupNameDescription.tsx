import { useIsGroupV2, useIsPublic, useWeAreAdmin } from '../../hooks/useParamSelector';
import { showUpdateGroupOrCommunityDetailsByConvoId } from '../../interactions/conversationInteractions';
import { useGroupCommonNoShow } from './useGroupCommonNoShow';

export function useShowUpdateGroupOrCommunityDetailsCb({
  conversationId,
}: {
  conversationId: string;
}) {
  const isGroupV2 = useIsGroupV2(conversationId);
  const weAreAdmin = useWeAreAdmin(conversationId);
  const isPublic = useIsPublic(conversationId);

  const commonNoShow = useGroupCommonNoShow(conversationId);
  const showIt = (isGroupV2 && weAreAdmin && !commonNoShow) || (isPublic && weAreAdmin);

  if (!showIt) {
    return null;
  }

  return () => {
    void showUpdateGroupOrCommunityDetailsByConvoId(conversationId);
  };
}
