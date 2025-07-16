import { useDispatch } from 'react-redux';
import {
  useIsIncomingRequest,
  useIsMe,
  useIsPrivate,
  useNicknameOrProfileNameOrShortenedPubkey,
} from '../../hooks/useParamSelector';
import { localize } from '../../localization/localeTools';
import { ConvoHub } from '../../session/conversations';
import { updateConfirmModal, updateConversationSettingsModal } from '../../state/ducks/modalDialog';
import { SessionButtonColor } from '../basic/SessionButton';

function useShowDeletePrivateContact({ conversationId }: { conversationId: string }) {
  const isPrivate = useIsPrivate(conversationId);
  const isRequest = useIsIncomingRequest(conversationId);
  const isMe = useIsMe(conversationId);

  return isPrivate && !isRequest && !isMe;
}

export function useShowDeletePrivateContactCb({ conversationId }: { conversationId: string }) {
  const showDeletePrivateContact = useShowDeletePrivateContact({ conversationId });
  const dispatch = useDispatch();
  const name = useNicknameOrProfileNameOrShortenedPubkey(conversationId);

  if (!showDeletePrivateContact) {
    return null;
  }

  const menuItemText = localize('contactDelete').toString();

  const onClickClose = () => {
    dispatch(updateConfirmModal(null));
  };

  const showConfirmationModal = () => {
    dispatch(
      updateConfirmModal({
        title: menuItemText,
        i18nMessage: { token: 'deleteContactDescription', args: { name } },
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
        okText: localize('delete').toString(),
      })
    );
  };
  return showConfirmationModal;
}
