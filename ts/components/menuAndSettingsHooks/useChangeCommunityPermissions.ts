import { useDispatch } from 'react-redux';
import { useIsPublic, useWeAreAdmin } from '../../hooks/useParamSelector';
import { updateCommunityPermissionsModal } from '../../state/ducks/modalDialog';
import { getFeatureFlag } from '../../state/ducks/types/releasedFeaturesReduxTypes';

export function useChangeCommunityPermissionsCb(conversationId?: string) {
  const dispatch = useDispatch();
  const isPublic = useIsPublic(conversationId);
  const weAreAdmin = useWeAreAdmin(conversationId);
  const hasDevCommunityActions = getFeatureFlag('useDevCommunityActions');

  if (!isPublic || !weAreAdmin || !conversationId || !hasDevCommunityActions) {
    return null;
  }

  return () => {
    dispatch(updateCommunityPermissionsModal({ conversationId }));
  };
}
