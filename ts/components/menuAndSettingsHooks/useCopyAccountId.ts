import { useIsPrivate } from '../../hooks/useParamSelector';
import { PubKey } from '../../session/types';
import { ToastUtils } from '../../session/utils';
import { getFeatureFlag } from '../../state/ducks/types/releasedFeaturesReduxTypes';

function useShowCopyAccountId(conversationId?: string) {
  const isPrivate = useIsPrivate(conversationId);

  return (
    conversationId &&
    isPrivate &&
    (!PubKey.isBlinded(conversationId) ||
      (PubKey.isBlinded(conversationId) && getFeatureFlag('useDevCommunityActions')))
  );
}

export function useShowCopyAccountIdCb(conversationId?: string) {
  const canCopy = useShowCopyAccountId(conversationId);

  if (!canCopy || !conversationId) {
    return null;
  }

  return () => {
    window.clipboard.writeText(conversationId);
    ToastUtils.pushCopiedToClipBoard();
  };
}
