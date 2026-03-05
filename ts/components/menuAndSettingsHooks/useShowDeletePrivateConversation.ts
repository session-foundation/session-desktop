import { getAppDispatch } from '../../state/dispatch';
import {
  useIsPrivate,
  useIsIncomingRequest,
  useIsMe,
  useConversationUsernameWithFallback,
} from '../../hooks/useParamSelector';
import { ConvoHub } from '../../session/conversations';
import { updateConfirmModal, updateConversationSettingsModal } from '../../state/ducks/modalDialog';
import { SessionButtonColor } from '../basic/SessionButton';

function useShowDeletePrivateConversation({ conversationId }: { conversationId: string }) {
  const isPrivate = useIsPrivate(conversationId);
  const isRequest = useIsIncomingRequest(conversationId);
  const isMe = useIsMe(conversationId);

  return isPrivate && !isRequest && !isMe;
}

// NOTE: [react-compiler] this convinces the compiler the hook is static
const useConversationUsernameWithFallbackInternal = useConversationUsernameWithFallback;

export function useShowDeletePrivateConversationCb({ conversationId }: { conversationId: string }) {
  const showDeletePrivateConversation = useShowDeletePrivateConversation({ conversationId });
  const dispatch = getAppDispatch();
  const name = useConversationUsernameWithFallbackInternal(true, conversationId);

  if (!showDeletePrivateConversation) {
    return null;
  }

  const onClickClose = () => {
    dispatch(updateConfirmModal(null));
  };

  const showConfirmationModal = () => {
    dispatch(
      updateConfirmModal({
        title: { token: 'conversationsDelete' },
        i18nMessage: { token: 'deleteConversationDescription', name },
        onClickClose,
        okTheme: SessionButtonColor.Danger,
        onClickOk: async () => {
          await ConvoHub.use().delete1o1(conversationId, {
            fromSyncMessage: false,
            justHidePrivate: true,
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
