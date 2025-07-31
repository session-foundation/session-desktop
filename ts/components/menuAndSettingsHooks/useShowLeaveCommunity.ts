import { useDispatch } from 'react-redux';
import { useConversationUsernameWithFallback, useIsPublic } from '../../hooks/useParamSelector';
import { tr } from '../../localization/localeTools';
import { ConvoHub } from '../../session/conversations';
import { updateConfirmModal, updateConversationSettingsModal } from '../../state/ducks/modalDialog';
import { SessionButtonColor } from '../basic/SessionButton';
import { leaveGroupOrCommunityByConvoId } from '../../interactions/conversationInteractions';

export function useShowLeaveCommunityCb(conversationId?: string) {
  const isPublic = useIsPublic(conversationId);
  const username = useConversationUsernameWithFallback(true, conversationId) || conversationId;
  const dispatch = useDispatch();

  if (!isPublic || !conversationId) {
    return null;
  }

  return () => {
    const conversation = ConvoHub.use().get(conversationId);

    if (!conversation.isPublic()) {
      throw new Error('showLeaveCommunityByConvoId() called with a non public convo.');
    }

    const onClickClose = () => {
      dispatch(updateConfirmModal(null));
    };

    const onClickOk = async () => {
      await leaveGroupOrCommunityByConvoId({
        conversationId,
        isPublic: true,
        sendLeaveMessage: false,
        onClickClose,
      });
      // The conversation was just removed, we need to remove the settings modal about it
      // so the modal doesn't appear empty.
      dispatch(updateConversationSettingsModal(null));
    };

    dispatch(
      updateConfirmModal({
        title: tr('communityLeave'),
        i18nMessage: { token: 'groupLeaveDescription', args: { group_name: username ?? '' } },
        onClickOk,
        okText: tr('leave'),
        okTheme: SessionButtonColor.Danger,
        onClickClose,
        conversationId,
      })
    );
  };
}
