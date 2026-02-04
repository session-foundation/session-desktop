import type { Dispatch } from 'redux';
import {
  useIsClosedGroup,
  useIsKickedFromGroup,
  useIsGroupDestroyed,
  useConversationUsernameWithFallback,
  useWeAreAdmin,
  useWeAreLastAdmin,
  useIsGroupV2,
} from '../../hooks/useParamSelector';
import {
  clearConversationInteractionState,
  saveConversationInteractionErrorAsMessage,
  updateConversationInteractionState,
} from '../../interactions/conversationInteractions';
import {
  ConversationInteractionStatus,
  ConversationInteractionType,
} from '../../interactions/types';
import { tr, type TrArgs } from '../../localization';
import { ConvoHub } from '../../session/conversations';
import { PubKey } from '../../session/types';
import { getAppDispatch } from '../../state/dispatch';
import { updateConfirmModal, updateConversationSettingsModal } from '../../state/ducks/modalDialog';
import { useIsMessageRequestOverlayShown } from '../../state/selectors/section';
import { SessionButtonColor } from '../basic/SessionButton';

export function useDeleteDestroyedOrKickedGroupCb(conversationId?: string) {
  const dispatch = getAppDispatch();
  const isGroupV2 = useIsGroupV2(conversationId);
  const isKickedFromGroup = useIsKickedFromGroup(conversationId);
  const isGroupDestroyed = useIsGroupDestroyed(conversationId);
  const isMessageRequestShown = useIsMessageRequestOverlayShown();
  const groupName = useConversationUsernameWithFallback(true, conversationId) || tr('unknown');

  // If the group was destroyed or we've been kicked, delete is always an option (and we can't leave).
  // This is the only way to remove the conversation entry from the left pane.
  const tryDeleteWhileGroupDestroyedOrKicked =
    isGroupV2 && !isMessageRequestShown && (isGroupDestroyed || isKickedFromGroup);

  if (!tryDeleteWhileGroupDestroyedOrKicked) {
    return null;
  }

  return () => {
    dispatchDeleteOrLeave({
      deleteType: 'delete-local-only',
      dispatch,
      onClickOk: async () => {
        await ConvoHub.use().deleteGroup(conversationId, {
          fromSyncMessage: false,
          sendLeaveMessage: false,
          deleteAllMessagesOnSwarm: false,
          forceDestroyForAllMembers: false,
          clearFetchedHashes: true,
          deletionType: 'doNotKeep',
        });
      },
      conversationId,
      onClickClose: () => {
        dispatch(updateConfirmModal(null));
      },
      groupName,
    });
  };
}

export function useShowLeaveOrDeleteGroupCb(
  deleteType: 'delete' | 'leave',
  conversationId?: string
) {
  const dispatch = getAppDispatch();
  const isClosedGroup = useIsClosedGroup(conversationId);
  const isKickedFromGroup = useIsKickedFromGroup(conversationId);
  const isGroupDestroyed = useIsGroupDestroyed(conversationId);
  const isMessageRequestShown = useIsMessageRequestOverlayShown();
  const groupName = useConversationUsernameWithFallback(true, conversationId) || tr('unknown');
  const weAreAdmin = useWeAreAdmin(conversationId);
  const weAreLastAdmin = useWeAreLastAdmin(conversationId);

  const tryDeleteWhileNotAdmin = deleteType === 'delete' && !weAreAdmin; // if we are not an admin we can only leave the group
  const tryLeaveWhileLastAdmin = weAreAdmin && weAreLastAdmin && deleteType === 'leave'; // if we are the last admin we can only delete the group

  if (
    !isClosedGroup ||
    isMessageRequestShown ||
    isGroupDestroyed ||
    isKickedFromGroup ||
    !conversationId ||
    tryDeleteWhileNotAdmin ||
    tryLeaveWhileLastAdmin
  ) {
    return null;
  }

  return () => {
    const onClickClose = () => {
      dispatch(updateConfirmModal(null));
    };

    const onClickOk = async () => {
      try {
        if (onClickClose) {
          onClickClose();
        }

        // for groups, we have a "leaving..." state that we don't need for communities.
        // that's because communities can be left always, whereas for groups we need to send a leave message (and so have some encryption keypairs)
        await updateConversationInteractionState({
          conversationId,
          type: ConversationInteractionType.Leave,
          status: ConversationInteractionStatus.Start,
        });

        if (PubKey.is05Pubkey(conversationId)) {
          throw new Error('useShowLeaveOrDeleteGroupCb expects a 03-group');
        } else if (PubKey.is03Pubkey(conversationId)) {
          await ConvoHub.use().deleteGroup(conversationId, {
            fromSyncMessage: false,
            sendLeaveMessage: deleteType === 'leave',
            deleteAllMessagesOnSwarm: false,
            deletionType: 'doNotKeep',
            forceDestroyForAllMembers: deleteType === 'delete',
            clearFetchedHashes: true,
          });
        } else {
          throw new Error('useShowLeaveOrDeleteGroupCb: invalid group convo provided');
        }
        await clearConversationInteractionState({ conversationId });
      } catch (err) {
        window.log.warn(`useShowLeaveOrDeleteGroupCb error: ${err}`);
        await saveConversationInteractionErrorAsMessage({
          conversationId,
          interactionType: ConversationInteractionType.Leave,
        });
      }
      dispatch(updateConversationSettingsModal(null));
    };

    dispatchDeleteOrLeave({
      deleteType,
      dispatch,
      onClickOk,
      conversationId,
      onClickClose,
      groupName,
    });
  };
}

function dispatchDeleteOrLeave({
  deleteType,
  dispatch,
  onClickOk,
  conversationId,
  onClickClose,
  groupName,
}: {
  /**
   * - delete: delete the group for everyone
   * - leave: leave the group but keep it alive (it needs another admin)
   * - delete-local-only: delete the group for the local user only, no network calls are made
   */
  deleteType: 'delete' | 'leave' | 'delete-local-only';
  onClickOk: () => Promise<void>;
  conversationId?: string;
  dispatch: Dispatch<any>;
  onClickClose: () => void;
  groupName: string;
}) {
  const title =
    deleteType === 'delete' || deleteType === 'delete-local-only'
      ? tr('groupDelete')
      : tr('groupLeave');
  const i18nMessage: TrArgs = {
    token:
      deleteType === 'delete'
        ? 'groupDeleteDescription'
        : deleteType === 'delete-local-only'
          ? 'groupDeleteDescriptionMember'
          : 'groupLeaveDescription',
    group_name: groupName,
  };

  dispatch(
    updateConfirmModal({
      title,
      i18nMessage,
      onClickOk,
      okText: title,
      okTheme: SessionButtonColor.Danger,
      onClickClose,
      conversationId,
    })
  );
}
