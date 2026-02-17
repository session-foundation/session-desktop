import { getAppDispatch } from '../../state/dispatch';
import { useIsPublic } from '../../hooks/useParamSelector';
import {
  isServerBanUnban,
  updateBanOrUnbanUserModal,
  type BanType,
} from '../../state/ducks/modalDialog';
import { useWeAreCommunityAdminOrModerator } from '../../state/selectors/conversations';
import { getFeatureFlag } from '../../state/ducks/types/releasedFeaturesReduxTypes';

export function useBanUserCb({
  conversationId,
  banType,
  pubkey,
}: {
  banType: BanType;
  conversationId?: string;
  pubkey?: string;
}) {
  const dispatch = getAppDispatch();
  const isPublic = useIsPublic(conversationId);
  const weAreAdminOrMod = useWeAreCommunityAdminOrModerator(conversationId);
  const hasDevCommunityActions = getFeatureFlag('useDevCommunityActions');

  if (
    !isPublic ||
    !weAreAdminOrMod ||
    !conversationId ||
    (isServerBanUnban(banType) && !hasDevCommunityActions)
  ) {
    return null;
  }

  return () => {
    dispatch(updateBanOrUnbanUserModal({ banType, conversationId, pubkey }));
  };
}
