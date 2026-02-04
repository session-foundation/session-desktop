import { getAppDispatch } from '../../state/dispatch';
import { useConversationUsernameWithFallback, useIsPublic } from '../../hooks/useParamSelector';
import { tr } from '../../localization/localeTools';
import { ConvoHub } from '../../session/conversations';
import { updateConfirmModal, updateConversationSettingsModal } from '../../state/ducks/modalDialog';
import { SessionButtonColor } from '../basic/SessionButton';

export function useShowLeaveCommunityCb(conversationId?: string) {
  const isPublic = useIsPublic(conversationId);
  const username = useConversationUsernameWithFallback(true, conversationId) || conversationId;
  const dispatch = getAppDispatch();

  if (!isPublic || !conversationId) {
    return null;
  }

  return () => {
    const onClickClose = () => {
      dispatch(updateConfirmModal(null));
    };

    const onClickOk = async () => {
      await ConvoHub.use().deleteCommunity(conversationId);
      // The conversation was just removed, we need to remove the settings modal about it
      // so the modal doesn't appear empty.
      dispatch(updateConversationSettingsModal(null));
    };

    dispatch(
      updateConfirmModal({
        title: tr('communityLeave'),
        i18nMessage: { token: 'groupLeaveDescription', group_name: username ?? '' },
        onClickOk,
        okText: tr('leave'),
        okTheme: SessionButtonColor.Danger,
        onClickClose,
        conversationId,
      })
    );
  };
}
