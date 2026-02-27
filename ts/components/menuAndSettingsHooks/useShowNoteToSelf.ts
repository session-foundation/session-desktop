import { getAppDispatch } from '../../state/dispatch';
import { useIsHidden, useIsMe } from '../../hooks/useParamSelector';
import { ConvoHub } from '../../session/conversations';
import { updateConfirmModal } from '../../state/ducks/modalDialog';
import { SessionButtonColor } from '../basic/SessionButton';

function useShowNoteToSelf({ conversationId }: { conversationId: string }) {
  const isMe = useIsMe(conversationId);
  const isHidden = useIsHidden(conversationId);

  return isMe && isHidden;
}

export function useShowNoteToSelfCb({ conversationId }: { conversationId: string }) {
  const showNTS = useShowNoteToSelf({ conversationId });
  const dispatch = getAppDispatch();

  const onClickClose = () => {
    dispatch(updateConfirmModal(null));
  };

  const showConfirmationModal = () => {
    dispatch(
      updateConfirmModal({
        title: { token: 'showNoteToSelf' },
        i18nMessage: { token: 'showNoteToSelfDescription' },
        onClickClose,
        closeTheme: SessionButtonColor.TextPrimary,
        onClickOk: async () => {
          const convo = ConvoHub.use().get(conversationId);
          await convo.unhideIfNeeded(true);
          // Note: We don't want to close the modal for the show NTS action.
        },
        okText: { token: 'show' },
      })
    );
  };

  if (!showNTS) {
    return null;
  }

  return showConfirmationModal;
}
