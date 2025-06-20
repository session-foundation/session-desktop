import { useIsGroupV2, useWeAreAdmin } from '../../hooks/useParamSelector';
import { showUpdateGroupNameByConvoId } from '../../interactions/conversationInteractions';
import { useGroupCommonNoShow } from './useGroupCommonNoShow';

export function useShowUpdateGroupNameDescriptionCb({
  conversationId,
}: {
  conversationId: string;
}) {
  const isGroupV2 = useIsGroupV2(conversationId);
  const weAreAdmin = useWeAreAdmin(conversationId);

  const commonNoShow = useGroupCommonNoShow(conversationId);
  const showUpdateGroupNameButton = isGroupV2 && weAreAdmin && !commonNoShow;

  if (!showUpdateGroupNameButton) {
    return null;
  }

  const cb = () => {
    void showUpdateGroupNameByConvoId(conversationId);
  };

  return cb;
}
