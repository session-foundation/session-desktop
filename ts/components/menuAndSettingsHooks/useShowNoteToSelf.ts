import { useDispatch } from 'react-redux';
import { useIsHidden, useIsMe } from '../../hooks/useParamSelector';
import { ConvoHub } from '../../session/conversations';
import { updateConfirmModal } from '../../state/ducks/modalDialog';
import { SessionButtonColor } from '../basic/SessionButton';
import { tr } from '../../localization/localeTools';

function useShowNoteToSelf({ conversationId }: { conversationId: string }) {
  const isMe = useIsMe(conversationId);
  const isHidden = useIsHidden(conversationId);

  return isMe && isHidden;
}

function useDispatch2() {
  const dispatch = useDispatch();
  return { dispatch }
}

export function useShowNoteToSelfCb({ conversationId }: { conversationId: string }) {
  const showNTS = useShowNoteToSelf({ conversationId });
  const { dispatch } = useDispatch2();

  if (!showNTS) {
    return null;
  }

  const onClickClose = () => {
    dispatch(updateConfirmModal(null));
  };

  const showConfirmationModal = () => {
    dispatch(
      updateConfirmModal({
        title: tr('showNoteToSelf'),
        i18nMessage: { token: 'showNoteToSelfDescription' },
        onClickClose,
        closeTheme: SessionButtonColor.TextPrimary,
        onClickOk: async () => {
          const convo = ConvoHub.use().get(conversationId);
          await convo.unhideIfNeeded(true);
          // Note: We don't want to close the modal for the show NTS action.
        },
        okText: tr('show'),
      })
    );
  };
  return showConfirmationModal;
}
