import { useDispatch } from 'react-redux';
import { useIsHidden, useIsMe } from '../../hooks/useParamSelector';
import { localize } from '../../localization/localeTools';
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
  const dispatch = useDispatch();

  if (!showNTS) {
    return null;
  }

  const onClickClose = () => {
    dispatch(updateConfirmModal(null));
  };

  const showConfirmationModal = () => {
    dispatch(
      updateConfirmModal({
        title: localize('showNoteToSelf').toString(),
        i18nMessage: { token: 'showNoteToSelfDescription' },
        onClickClose,
        closeTheme: SessionButtonColor.White,
        onClickOk: async () => {
          const convo = ConvoHub.use().get(conversationId);
          await convo.unhideIfNeeded(true);
          // Note: We don't want to close the modal for the show NTS action.
        },
        okText: localize('show').toString(),
      })
    );
  };
  return showConfirmationModal;
}
