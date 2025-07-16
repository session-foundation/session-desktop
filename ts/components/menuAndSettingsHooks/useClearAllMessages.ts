import { useDispatch } from 'react-redux';
import { deleteAllMessagesByConvoIdNoConfirmation } from '../../interactions/conversationInteractions';
import { updateConfirmModal } from '../../state/ducks/modalDialog';
import { SessionButtonColor } from '../basic/SessionButton';
import { localize } from '../../localization/localeTools';
import {
  useConversationUsername,
  useIsGroupV2,
  useIsKickedFromGroup,
  useIsLegacyGroup,
  useIsMe,
  useIsPrivate,
  useIsPublic,
  useWeAreAdmin,
} from '../../hooks/useParamSelector';
import { ToastUtils } from '../../session/utils';
import type { LocalizerProps } from '../basic/Localizer';
import { groupInfoActions } from '../../state/ducks/metaGroups';

export function useClearAllMessagesCb({ conversationId }: { conversationId: string }) {
  const dispatch = useDispatch();

  const isKickedFromGroup = useIsKickedFromGroup(conversationId);
  const isMe = useIsMe(conversationId);
  const isPublic = useIsPublic(conversationId);

  const isGroupV2 = useIsGroupV2(conversationId);
  const weAreAdmin = useWeAreAdmin(conversationId);
  const isLegacyGroup = useIsLegacyGroup(conversationId);
  const conversationTitle =
    useConversationUsername(conversationId) || localize('unknown').toString();
  const isPrivate = useIsPrivate(conversationId);

  if (isKickedFromGroup) {
    // we can't clear all if we are kicked from the group
    return null;
  }

  const onClickClose = () => {
    dispatch(updateConfirmModal(null));
  };

  const clearMessagesForEveryone = 'clearMessagesForEveryone';

  const onClickOk = async (...args: Array<any>) => {
    if (isGroupV2AndAdmin && args[0] === clearMessagesForEveryone) {
      // wrapping this in a Promise so the spinner is shown while the thunk is in progress
      await new Promise<void>((resolve, reject) => {
        dispatch(
          groupInfoActions.triggerDeleteMsgBeforeNow({
            groupPk: conversationId,
            messagesWithAttachmentsOnly: false,
            onDeleted: () => {
              ToastUtils.pushDeleted(2);
              onClickClose();
              resolve();
            },
            onDeletionFailed: (error: string) => {
              ToastUtils.pushToastError('clearMessagesForEveryone', error);
              onClickClose();
              reject();
            },
          }) as any
        );
      });
    } else {
      await deleteAllMessagesByConvoIdNoConfirmation(conversationId);
      ToastUtils.pushDeleted(2);
      onClickClose();
    }
  };

  const isGroupV2AndAdmin = isGroupV2 && weAreAdmin;

  const i18nMessage: LocalizerProps | null = isMe
    ? { token: 'clearMessagesNoteToSelfDescriptionUpdated' }
    : isPublic
      ? { token: 'clearMessagesCommunityUpdated', args: { community_name: conversationTitle } }
      : isPrivate
        ? { token: 'clearMessagesChatDescriptionUpdated', args: { name: conversationTitle } }
        : isLegacyGroup || (isGroupV2 && !weAreAdmin)
          ? {
              token: 'clearMessagesGroupDescriptionUpdated',
              args: { group_name: conversationTitle },
            }
          : isGroupV2AndAdmin
            ? {
                token: 'clearMessagesChatDescriptionUpdated',
                args: { name: conversationTitle },
              }
            : null;

  if (!i18nMessage) {
    throw new Error('useClearAllMessagesCb: invalid case');
  }

  const cb = () =>
    dispatch(
      updateConfirmModal({
        title: localize('clearMessages').toString(),
        i18nMessage,
        onClickOk,
        okTheme: SessionButtonColor.Danger,
        onClickClose,
        okText: localize('clear').toString(),
        radioOptions: isGroupV2AndAdmin
          ? [
              {
                value: 'clearOnThisDevice',
                label: localize('clearOnThisDevice').toString(),
                inputDataTestId: 'clear-device-radio-option',
                labelDataTestId: 'clear-device-radio-option-label',
              },
              {
                value: clearMessagesForEveryone,
                label: localize(clearMessagesForEveryone).toString(),
                inputDataTestId: 'clear-everyone-radio-option',
                labelDataTestId: 'clear-everyone-radio-option-label',
              },
            ]
          : undefined,
      })
    );

  return cb;
}
