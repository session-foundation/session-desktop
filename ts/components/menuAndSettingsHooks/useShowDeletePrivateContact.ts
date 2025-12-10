import { getAppDispatch } from '../../state/dispatch';
import {
  useConversationUsernameWithFallback,
  useIsIncomingRequest,
  useIsMe,
  useIsPrivate,
} from '../../hooks/useParamSelector';
import { tr } from '../../localization/localeTools';
import { ConvoHub } from '../../session/conversations';
import { updateConfirmModal, updateConversationSettingsModal } from '../../state/ducks/modalDialog';
import { SessionButtonColor } from '../basic/SessionButton';

function useShowDeletePrivateContact({ conversationId }: { conversationId: string }) {
  const isPrivate = useIsPrivate(conversationId);
  const isRequest = useIsIncomingRequest(conversationId);
  const isMe = useIsMe(conversationId);

  return isPrivate && !isRequest && !isMe;
}

// NOTE: [react-compiler] this has to live here for the hook to be identified as static
function useConversationUsernameWithFallbackInternal(
  ...props: Parameters<typeof useConversationUsernameWithFallback>
) {
  return useConversationUsernameWithFallback(...props);
}

export function useShowDeletePrivateContactCb({ conversationId }: { conversationId: string }) {
  const showDeletePrivateContact = useShowDeletePrivateContact({ conversationId });
  const dispatch = getAppDispatch();
  const name = useConversationUsernameWithFallbackInternal(true, conversationId);

  if (!showDeletePrivateContact) {
    return null;
  }

  const menuItemText = tr('contactDelete');

  const onClickClose = () => {
    dispatch(updateConfirmModal(null));
  };

  const showConfirmationModal = () => {
    dispatch(
      updateConfirmModal({
        title: menuItemText,
        i18nMessage: { token: 'deleteContactDescription', name },
        onClickClose,
        okTheme: SessionButtonColor.Danger,
        onClickOk: async () => {
          await ConvoHub.use().delete1o1(conversationId, {
            fromSyncMessage: false,
            justHidePrivate: false,
            keepMessages: false,
          });
          dispatch(updateConversationSettingsModal(null));
        },
        okText: tr('delete'),
      })
    );
  };
  return showConfirmationModal;
}
