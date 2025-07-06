import { useIsPublic } from '../../hooks/useParamSelector';
import { OpenGroupUtils } from '../../session/apis/open_group_api/utils';
import { ToastUtils } from '../../session/utils';
import { UserGroupsWrapperActions } from '../../webworker/workers/browser/libsession_worker_interface';

function useShowCopyCommunityUrl({ conversationId }: { conversationId: string }) {
  const isPublic = useIsPublic(conversationId);

  return isPublic;
}

async function copyItAsync(conversationId: string) {
  if (!OpenGroupUtils.isOpenGroupV2(conversationId)) {
    throw new Error('copyCommunityUrl() called with a non community convo.');
  }
  const fromWrapper = await UserGroupsWrapperActions.getCommunityByFullUrl(conversationId);

  if (!fromWrapper) {
    window.log.warn('opengroup to copy was not found in the UserGroupsWrapper');
    return;
  }

  if (fromWrapper.fullUrlWithPubkey) {
    window.clipboard.writeText(fromWrapper.fullUrlWithPubkey);
    ToastUtils.pushCopiedToClipBoard();
  }
}

export function useShowCopyCommunityUrlCb(conversationId: string) {
  const canCopy = useShowCopyCommunityUrl({ conversationId });

  if (!canCopy) {
    return null;
  }

  return () => {
    void copyItAsync(conversationId);
  };
}
