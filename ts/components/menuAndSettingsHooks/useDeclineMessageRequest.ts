import { declineConversationWithoutConfirm } from '../../interactions/conversationInteractions';
import { type TrArgs } from '../../localization';
import { updateConfirmModal } from '../../state/ducks/modalDialog';
import { SessionButtonColor } from '../basic/SessionButton';
import { getAppDispatch } from '../../state/dispatch';
import { useSelectedConversationKey } from '../../state/selectors/selectedConversation';
import { useConversationIdOrigin } from '../../state/selectors/conversations';
import {
  useConversationUsernameWithFallback,
  useIsGroupV2,
  useIsIncomingRequest,
  useIsPrivate,
  useIsPrivateAndFriend,
} from '../../hooks/useParamSelector';

export const useDeclineMessageRequest = ({
  conversationId,
  alsoBlock,
}: {
  conversationId: string | undefined;
  alsoBlock: boolean;
}) => {
  const dispatch = getAppDispatch();
  const isGroupV2 = useIsGroupV2(conversationId);
  const currentlySelectedConvo = useSelectedConversationKey();
  const conversationIdOrigin = useConversationIdOrigin(conversationId);
  // restoring from seed we might not have the sender of that invite, so we need to take care of not having one (and not block)
  const conversationOriginName = useConversationUsernameWithFallback(true, conversationIdOrigin);

  const convoName = useConversationUsernameWithFallback(true, conversationId);
  const isPrivateAndFriend = useIsPrivateAndFriend(conversationId);
  const isIncomingRequest = useIsIncomingRequest(conversationId);
  const isPrivate = useIsPrivate(conversationId);

  if (!conversationId || isPrivateAndFriend || !isIncomingRequest || (!isGroupV2 && !isPrivate)) {
    return null;
  }

  return () => {
    let i18nMessage: TrArgs;

    if (isGroupV2) {
      i18nMessage =
        alsoBlock && conversationOriginName
          ? { token: 'blockDescription', name: conversationOriginName } // groupv2, we want to block and we have the sender name
          : { token: 'groupInviteDelete' }; // groupv2, and no info about the sender, falling back to delete only
    } else {
      i18nMessage = alsoBlock
        ? { token: 'blockDescription', name: convoName }
        : { token: 'messageRequestsDelete' };
    }

    dispatch(
      updateConfirmModal({
        okText: alsoBlock ? { token: 'block' } : { token: 'delete' },
        cancelText: { token: 'cancel' },
        title: alsoBlock ? { token: 'block' } : { token: 'delete' },
        i18nMessage,
        okTheme: SessionButtonColor.Danger,
        onClickOk: async () => {
          await declineConversationWithoutConfirm({
            conversationId,
            currentlySelectedConvo,
            alsoBlock,
            conversationIdOrigin: conversationIdOrigin ?? null,
          });
        },
        onClickCancel: () => {
          dispatch(updateConfirmModal(null));
        },
        onClickClose: () => {
          dispatch(updateConfirmModal(null));
        },
      })
    );
  };
};
