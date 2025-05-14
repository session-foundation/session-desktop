import { useDispatch } from 'react-redux';
import {
  useIsGroupV2,
  useIsMe,
  useIsPublic,
  useOurAvatarPath,
  useOurConversationUsername,
  useWeAreAdmin,
} from '../../hooks/useParamSelector';
import { updateEditProfilePictureModal, updateGroupNameModal } from '../../state/ducks/modalDialog';

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

  return isMe || ((isPublic || isGroup) && weAreAdmin);
}

export function useEditProfilePictureCallback({ conversationId }: { conversationId: string }) {
  const canEdit = useEditProfilePicture({ conversationId });
  const dispatch = useDispatch();

  const isMe = useIsMe(conversationId);
  const avatarPath = useOurAvatarPath() || '';
  const profileName = useOurConversationUsername() || '';

  if (!canEdit) {
    return undefined;
  }

  if (isMe) {
    return () => {
      dispatch(updateEditProfilePictureModal({ ourId: conversationId, avatarPath, profileName }));
    };
  }
  return () => {
    dispatch(updateGroupNameModal({ conversationId }));
  };
}
