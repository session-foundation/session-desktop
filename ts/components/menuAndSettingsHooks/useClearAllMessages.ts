import { useDispatch } from 'react-redux';
import { deleteAllMessagesByConvoIdNoConfirmation } from '../../interactions/conversationInteractions';
import { updateConfirmModal } from '../../state/ducks/modalDialog';
import { SessionButtonColor } from '../basic/SessionButton';
import { localize } from '../../localization/localeTools';

export function useClearAllMessagesCb({ conversationId }: { conversationId: string }) {
  const dispatch = useDispatch();

  const onClickClose = () => {
    dispatch(updateConfirmModal(null));
  };

  const onClickOk = async () => {
    await deleteAllMessagesByConvoIdNoConfirmation(conversationId);
    onClickClose();
  };

  const cb = () =>
    dispatch(
      updateConfirmModal({
        title: localize('deleteMessage').withArgs({ count: 2 }).toString(), // count of 2 to get the plural "Messages Deleted"
        i18nMessage: { token: 'deleteAfterGroupPR3DeleteMessagesConfirmation' },
        onClickOk,
        okTheme: SessionButtonColor.Danger,
        onClickClose,
        okText: localize('clearAll').toString(),
      })
    );

  return cb;
}
