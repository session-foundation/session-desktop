import { useIsHidden, useIsMe } from '../../hooks/useParamSelector';
import { tr } from '../../localization/localeTools';
import { ConvoHub } from '../../session/conversations';
import { getAppDispatch } from '../../state/dispatch';
import { updateConfirmModal } from '../../state/ducks/modalDialog';
import { SessionButtonColor } from '../basic/SessionButton';

function useShowHideNoteToSelf({ conversationId }: { conversationId: string }) {
  const isMe = useIsMe(conversationId);
  const isHidden = useIsHidden(conversationId);

  return isMe && !isHidden;
}

export function useHideNoteToSelfCb({ conversationId }: { conversationId: string }) {
  const showHideNTS = useShowHideNoteToSelf({ conversationId });
  const dispatch = getAppDispatch();

  if (!showHideNTS) {
    return null;
  }

  const menuItemText = tr('noteToSelfHide');

  const onClickClose = () => {
    dispatch(updateConfirmModal(null));
  };

  const showConfirmationModal = () => {
    dispatch(
      updateConfirmModal({
        title: menuItemText,
        i18nMessage: { token: 'noteToSelfHideDescription' },
        onClickClose,
        okTheme: SessionButtonColor.Danger,
        onClickOk: async () => {
          await ConvoHub.use().delete1o1(conversationId, {
            fromSyncMessage: false,
            justHidePrivate: true,
            keepMessages: true, // Note: we want want to keep messages for the hide NTS action.
          });
          // Note: We don't want to close the modal for the hide NTS action.
        },
        okText: tr('hide'),
      })
    );
  };
  return showConfirmationModal;
}
