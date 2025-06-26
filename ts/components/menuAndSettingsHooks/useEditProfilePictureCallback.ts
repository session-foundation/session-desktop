import { useDispatch } from 'react-redux';
import { useIsGroupV2, useIsMe, useIsPublic, useWeAreAdmin } from '../../hooks/useParamSelector';
import { updateEditProfilePictureModal } from '../../state/ducks/modalDialog';
import { hasClosedGroupV2QAButtons } from '../../shared/env_vars';

/**
 * We can edit
 * - our own avatar
 * - communities avatar when we are an admin
 * - groups avatars when are an admin (not kicked, not left, and not legacy groups)
 */
function useEditProfilePicture({ conversationId }: { conversationId: string }) {
  const isMe = useIsMe(conversationId);
  const isPublic = useIsPublic(conversationId);
  const isGroup = useIsGroupV2(conversationId);

  const weAreAdmin = useWeAreAdmin(conversationId);

  const hasQAButtonsOn = hasClosedGroupV2QAButtons();

  return isMe || ((isPublic || (isGroup && hasQAButtonsOn)) && weAreAdmin);
}

export function useEditProfilePictureCallback({ conversationId }: { conversationId: string }) {
  const canEdit = useEditProfilePicture({ conversationId });
  const dispatch = useDispatch();

  if (!canEdit) {
    return undefined;
  }

  return () => {
    dispatch(updateEditProfilePictureModal({ conversationId }));
  };
}
