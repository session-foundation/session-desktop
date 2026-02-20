import { getAppDispatch } from '../../state/dispatch';
import {
  useConversationUsernameWithFallback,
  useIsIncomingRequest,
  useIsMe,
  useIsPrivate,
} from '../../hooks/useParamSelector';
import { ConvoHub } from '../../session/conversations';
import { updateConfirmModal, updateConversationSettingsModal } from '../../state/ducks/modalDialog';
import { SessionButtonColor } from '../basic/SessionButton';

function useShowDeletePrivateContact({ conversationId }: { conversationId: string }) {
  const isPrivate = useIsPrivate(conversationId);
  const isRequest = useIsIncomingRequest(conversationId);
  const isMe = useIsMe(conversationId);

  return isPrivate && !isRequest && !isMe;
}

// NOTE: [react-compiler] this convinces the compiler the hook is static
const useConversationUsernameWithFallbackInternal = useConversationUsernameWithFallback;

export function useShowDeletePrivateContactCb({ conversationId }: { conversationId: string }) {
  const showDeletePrivateContact = useShowDeletePrivateContact({ conversationId });
  const dispatch = getAppDispatch();
  const name = useConversationUsernameWithFallbackInternal(true, conversationId);

  if (!showDeletePrivateContact) {
    return null;
  }

  const onClickClose = () => {
    dispatch(updateConfirmModal(null));
  };

  const showConfirmationModal = () => {
    dispatch(
      updateConfirmModal({
        title: { token: 'contactDelete' },
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
        okText: { token: 'delete' },
      })
    );
  };
  return showConfirmationModal;
}
