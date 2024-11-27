import { Submenu } from 'react-contexify';
import { useDispatch, useSelector } from 'react-redux';
import { useConvoIdFromContext } from '../../contexts/ConvoIdContext';
import {
  useAvatarPath,
  useConversationUsername,
  useHasNickname,
  useIsActive,
  useIsBlinded,
  useIsBlocked,
  useIsGroupV2,
  useIsIncomingRequest,
  useIsKickedFromGroup,
  useIsMe,
  useIsPrivate,
  useIsPrivateAndFriend,
  useIsPublic,
  useLastMessage,
  useNicknameOrProfileNameOrShortenedPubkey,
  useNotificationSetting,
  useWeAreAdmin,
} from '../../hooks/useParamSelector';
import {
  blockConvoById,
  clearNickNameByConvoId,
  declineConversationWithConfirm,
  deleteAllMessagesByConvoIdWithConfirmation,
  handleAcceptConversationRequest,
  markAllReadByConvoId,
  setNotificationForConvoId,
  showAddModeratorsByConvoId,
  showBanUserByConvoId,
  showInviteContactByConvoId,
  showLeaveGroupByConvoId,
  showLeavePrivateConversationByConvoId,
  showRemoveModeratorsByConvoId,
  showUnbanUserByConvoId,
  showUpdateGroupNameByConvoId,
  unblockConvoById,
} from '../../interactions/conversationInteractions';
import {
  ConversationNotificationSetting,
  ConversationNotificationSettingType,
} from '../../models/conversationAttributes';
import { ConvoHub } from '../../session/conversations';
import { PubKey } from '../../session/types';
import {
  changeNickNameModal,
  updateConfirmModal,
  updateUserDetailsModal,
} from '../../state/ducks/modalDialog';
import { useConversationIdOrigin } from '../../state/selectors/conversations';
import {
  getIsMessageRequestOverlayShown,
  getIsMessageSection,
} from '../../state/selectors/section';
import { useSelectedConversationKey } from '../../state/selectors/selectedConversation';
import type { LocalizerToken } from '../../types/localizer';
import { SessionButtonColor } from '../basic/SessionButton';
import { ItemWithDataTestId } from './items/MenuItemWithDataTestId';
import {
  ConversationInteractionStatus,
  ConversationInteractionType,
} from '../../interactions/types';
import { useLibGroupDestroyed } from '../../state/selectors/userGroups';
import { NetworkTime } from '../../util/NetworkTime';

/** Menu items standardized */

export const InviteContactMenuItem = (): JSX.Element | null => {
  const convoId = useConvoIdFromContext();
  const isPublic = useIsPublic(convoId);

  if (isPublic) {
    return (
      <ItemWithDataTestId
        onClick={() => {
          showInviteContactByConvoId(convoId);
        }}
      >
        {window.i18n('membersInvite')}
      </ItemWithDataTestId>
    );
  }
  return null;
};

export const MarkConversationUnreadMenuItem = (): JSX.Element | null => {
  const conversationId = useConvoIdFromContext();
  const isMessagesSection = useSelector(getIsMessageSection);
  const isPrivate = useIsPrivate(conversationId);
  const isPrivateAndFriend = useIsPrivateAndFriend(conversationId);
  const isMessageRequestShown = useSelector(getIsMessageRequestOverlayShown);

  if (
    isMessagesSection &&
    !isMessageRequestShown &&
    (!isPrivate || (isPrivate && isPrivateAndFriend))
  ) {
    const conversation = ConvoHub.use().get(conversationId);

    const markUnread = () => {
      void conversation?.markAsUnread(true);
    };

    return (
      <ItemWithDataTestId onClick={markUnread}>
        {window.i18n('messageMarkUnread')}
      </ItemWithDataTestId>
    );
  }
  return null;
};

/**
 * This menu item can be used to completely remove a contact and reset the flags of that conversation.
 * i.e. after confirmation is made, this contact will be removed from the ContactWrapper, and its blocked and approved state reset.
 * Note: We keep the entry in the database as the user profile might still be needed for communities/groups where this user.
 */
export const DeletePrivateContactMenuItem = () => {
  const dispatch = useDispatch();
  const convoId = useConvoIdFromContext();
  const isPrivate = useIsPrivate(convoId);
  const isRequest = useIsIncomingRequest(convoId);

  const name = useNicknameOrProfileNameOrShortenedPubkey(convoId);

  if (isPrivate && !isRequest) {
    const menuItemText = window.i18n('contactDelete');

    const onClickClose = () => {
      dispatch(updateConfirmModal(null));
    };

    const showConfirmationModal = () => {
      dispatch(
        updateConfirmModal({
          title: menuItemText,
          i18nMessage: { token: 'contactDeleteDescription', args: { name } },
          onClickClose,
          okTheme: SessionButtonColor.Danger,
          onClickOk: async () => {
            await ConvoHub.use().delete1o1(convoId, {
              fromSyncMessage: false,
              justHidePrivate: false,
              keepMessages: false,
            });
          },
        })
      );
    };

    return <ItemWithDataTestId onClick={showConfirmationModal}>{menuItemText}</ItemWithDataTestId>;
  }
  return null;
};

export const LeaveGroupOrCommunityMenuItem = () => {
  const convoId = useConvoIdFromContext();
  const username = useConversationUsername(convoId) || convoId;
  const isPrivate = useIsPrivate(convoId);
  const isPublic = useIsPublic(convoId);
  const lastMessage = useLastMessage(convoId);
  const isMessageRequestShown = useSelector(getIsMessageRequestOverlayShown);

  if (!isPrivate && !isMessageRequestShown) {
    return (
      <ItemWithDataTestId
        onClick={() => {
          void showLeaveGroupByConvoId(convoId, username);
        }}
      >
        {isPublic
          ? window.i18n('communityLeave')
          : lastMessage?.interactionType === ConversationInteractionType.Leave &&
              lastMessage?.interactionStatus === ConversationInteractionStatus.Error
            ? window.i18n('conversationsDelete')
            : window.i18n('groupLeave')}
      </ItemWithDataTestId>
    );
  }

  return null;
};

export const ShowUserDetailsMenuItem = () => {
  const dispatch = useDispatch();
  const convoId = useConvoIdFromContext();
  const isPrivate = useIsPrivate(convoId);
  const avatarPath = useAvatarPath(convoId);
  const userName = useConversationUsername(convoId) || convoId;
  const isBlinded = useIsBlinded(convoId);

  if (isPrivate && !isBlinded) {
    return (
      <ItemWithDataTestId
        onClick={() => {
          dispatch(
            updateUserDetailsModal({
              conversationId: convoId,
              userName,
              authorAvatarPath: avatarPath,
            })
          );
        }}
      >
        {window.i18n('contactUserDetails')}
      </ItemWithDataTestId>
    );
  }

  return null;
};

export const UpdateGroupNameMenuItem = () => {
  const convoId = useConvoIdFromContext();
  const isKickedFromGroup = useIsKickedFromGroup(convoId);
  const isDestroyed = useLibGroupDestroyed(convoId);
  const weAreAdmin = useWeAreAdmin(convoId);

  if (!isKickedFromGroup && weAreAdmin && !isDestroyed) {
    return (
      <ItemWithDataTestId
        onClick={() => {
          void showUpdateGroupNameByConvoId(convoId);
        }}
      >
        {window.i18n('groupEdit')}
      </ItemWithDataTestId>
    );
  }
  return null;
};

export const RemoveModeratorsMenuItem = (): JSX.Element | null => {
  const convoId = useConvoIdFromContext();
  const isPublic = useIsPublic(convoId);

  const isKickedFromGroup = useIsKickedFromGroup(convoId);
  const weAreAdmin = useWeAreAdmin(convoId);

  if (!isKickedFromGroup && weAreAdmin && isPublic) {
    return (
      <ItemWithDataTestId
        onClick={() => {
          showRemoveModeratorsByConvoId(convoId);
        }}
      >
        {window.i18n('adminRemove')}
      </ItemWithDataTestId>
    );
  }
  return null;
};

export const AddModeratorsMenuItem = (): JSX.Element | null => {
  const convoId = useConvoIdFromContext();
  const isPublic = useIsPublic(convoId);
  const isKickedFromGroup = useIsKickedFromGroup(convoId);
  const weAreAdmin = useWeAreAdmin(convoId);

  if (!isKickedFromGroup && weAreAdmin && isPublic) {
    return (
      <ItemWithDataTestId
        onClick={() => {
          showAddModeratorsByConvoId(convoId);
        }}
      >
        {window.i18n('adminPromote')}
      </ItemWithDataTestId>
    );
  }
  return null;
};

export const UnbanMenuItem = (): JSX.Element | null => {
  const convoId = useConvoIdFromContext();
  const isPublic = useIsPublic(convoId);
  const isKickedFromGroup = useIsKickedFromGroup(convoId);
  const weAreAdmin = useWeAreAdmin(convoId);

  if (isPublic && !isKickedFromGroup && weAreAdmin) {
    return (
      <ItemWithDataTestId
        onClick={() => {
          showUnbanUserByConvoId(convoId);
        }}
      >
        {window.i18n('banUnbanUser')}
      </ItemWithDataTestId>
    );
  }
  return null;
};

export const BanMenuItem = (): JSX.Element | null => {
  const convoId = useConvoIdFromContext();
  const isPublic = useIsPublic(convoId);
  const isKickedFromGroup = useIsKickedFromGroup(convoId);
  const weAreAdmin = useWeAreAdmin(convoId);

  if (isPublic && !isKickedFromGroup && weAreAdmin) {
    return (
      <ItemWithDataTestId
        onClick={() => {
          showBanUserByConvoId(convoId);
        }}
      >
        {window.i18n('banUser')}
      </ItemWithDataTestId>
    );
  }
  return null;
};

export const MarkAllReadMenuItem = (): JSX.Element | null => {
  const convoId = useConvoIdFromContext();
  const isIncomingRequest = useIsIncomingRequest(convoId);
  if (!isIncomingRequest && !PubKey.isBlinded(convoId)) {
    return (
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      <ItemWithDataTestId onClick={async () => markAllReadByConvoId(convoId)}>
        {window.i18n('messageMarkRead')}
      </ItemWithDataTestId>
    );
  }
  return null;
};

export const BlockMenuItem = (): JSX.Element | null => {
  const convoId = useConvoIdFromContext();
  const isMe = useIsMe(convoId);
  const isBlocked = useIsBlocked(convoId);
  const isPrivate = useIsPrivate(convoId);
  const isIncomingRequest = useIsIncomingRequest(convoId);

  if (!isMe && isPrivate && !isIncomingRequest && !PubKey.isBlinded(convoId)) {
    const blockTitle = isBlocked ? window.i18n('blockUnblock') : window.i18n('block');
    const blockHandler = isBlocked
      ? async () => unblockConvoById(convoId)
      : async () => blockConvoById(convoId);
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    return <ItemWithDataTestId onClick={blockHandler}>{blockTitle}</ItemWithDataTestId>;
  }
  return null;
};

export const ClearNicknameMenuItem = (): JSX.Element | null => {
  const convoId = useConvoIdFromContext();
  const isMe = useIsMe(convoId);
  const hasNickname = useHasNickname(convoId);
  const isPrivate = useIsPrivate(convoId);
  const isPrivateAndFriend = useIsPrivateAndFriend(convoId);

  if (isMe || !hasNickname || !isPrivate || !isPrivateAndFriend) {
    return null;
  }

  return (
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    <ItemWithDataTestId onClick={async () => clearNickNameByConvoId(convoId)}>
      {window.i18n('nicknameRemove')}
    </ItemWithDataTestId>
  );
};

export const ChangeNicknameMenuItem = () => {
  const convoId = useConvoIdFromContext();
  const isMe = useIsMe(convoId);
  const isPrivate = useIsPrivate(convoId);
  const isPrivateAndFriend = useIsPrivateAndFriend(convoId);
  const dispatch = useDispatch();

  if (isMe || !isPrivate || !isPrivateAndFriend) {
    return null;
  }
  return (
    <ItemWithDataTestId
      onClick={() => {
        dispatch(changeNickNameModal({ conversationId: convoId }));
      }}
    >
      {window.i18n('nicknameSet')}
    </ItemWithDataTestId>
  );
};

/**
 * This menu is always available and can be used to clear the messages in the local database only.
 * No messages are sent, no update are made in the wrappers.
 * Note: Will ask for confirmation before processing.
 */
export const DeleteMessagesMenuItem = () => {
  const convoId = useConvoIdFromContext();
  const isMessageRequestShown = useSelector(getIsMessageRequestOverlayShown);

  if (!convoId || isMessageRequestShown) {
    return null;
  }
  return (
    <ItemWithDataTestId
      onClick={() => {
        deleteAllMessagesByConvoIdWithConfirmation(convoId);
      }}
    >
      {/* just more than 1 to have the string Delete Messages */}
      {window.i18n('deleteMessage', { count: 2 })}
    </ItemWithDataTestId>
  );
};

/**
 * This menu item can be used to delete a private conversation after confirmation.
 * It does not reset the flags of that conversation, but just removes the messages locally and hide it from the left pane list.
 * Note: A dialog is opened to ask for confirmation before processing.
 */
export const DeletePrivateConversationMenuItem = () => {
  const convoId = useConvoIdFromContext();
  const isRequest = useIsIncomingRequest(convoId);
  const isPrivate = useIsPrivate(convoId);
  const isMe = useIsMe(convoId);

  if (!convoId || !isPrivate || isRequest) {
    return null;
  }

  return (
    <ItemWithDataTestId
      onClick={() => {
        showLeavePrivateConversationByConvoId(convoId);
      }}
    >
      {isMe ? window.i18n('noteToSelfHide') : window.i18n('conversationsDelete')}
    </ItemWithDataTestId>
  );
};

export const AcceptMsgRequestMenuItem = () => {
  const convoId = useConvoIdFromContext();
  const isRequest = useIsIncomingRequest(convoId);
  const isPrivate = useIsPrivate(convoId);

  if (isRequest && (isPrivate || PubKey.is03Pubkey(convoId))) {
    return (
      <ItemWithDataTestId
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        onClick={async () => {
          await handleAcceptConversationRequest({
            convoId,
            approvalMessageTimestamp: NetworkTime.now(),
          });
        }}
        dataTestId="accept-menu-item"
      >
        {window.i18n('accept')}
      </ItemWithDataTestId>
    );
  }
  return null;
};

export const DeclineMsgRequestMenuItem = () => {
  const convoId = useConvoIdFromContext();
  const isRequest = useIsIncomingRequest(convoId);
  const isPrivate = useIsPrivate(convoId);
  const selected = useSelectedConversationKey();
  const isGroupV2 = useIsGroupV2(convoId);
  if ((isPrivate || isGroupV2) && isRequest) {
    return (
      <ItemWithDataTestId
        onClick={() => {
          declineConversationWithConfirm({
            conversationId: convoId,
            syncToDevices: true,
            alsoBlock: false,
            currentlySelectedConvo: selected || undefined,
            conversationIdOrigin: null,
          });
        }}
        dataTestId="delete-menu-item"
      >
        {window.i18n('delete')}
      </ItemWithDataTestId>
    );
  }
  return null;
};

export const DeclineAndBlockMsgRequestMenuItem = () => {
  const convoId = useConvoIdFromContext();
  const isRequest = useIsIncomingRequest(convoId);
  const selected = useSelectedConversationKey();
  const isPrivate = useIsPrivate(convoId);
  const isGroupV2 = useIsGroupV2(convoId);
  const convoOrigin = useConversationIdOrigin(convoId);

  if (isRequest && (isPrivate || (isGroupV2 && convoOrigin))) {
    // to block the author of a groupv2 invite we need the convoOrigin set
    return (
      <ItemWithDataTestId
        onClick={() => {
          declineConversationWithConfirm({
            conversationId: convoId,
            syncToDevices: true,
            alsoBlock: true,
            currentlySelectedConvo: selected || undefined,
            conversationIdOrigin: convoOrigin ?? null,
          });
        }}
        dataTestId="block-menu-item"
      >
        {window.i18n('block')}
      </ItemWithDataTestId>
    );
  }
  return null;
};

export const NotificationForConvoMenuItem = (): JSX.Element | null => {
  // Note: this item is used in the header and in the list item, so we need to grab the details
  // from the convoId from the context itself, not the redux selected state
  const convoId = useConvoIdFromContext();

  const currentNotificationSetting = useNotificationSetting(convoId);
  const isBlocked = useIsBlocked(convoId);
  const isActive = useIsActive(convoId);
  const isKickedFromGroup = useIsKickedFromGroup(convoId);
  const isGroupDestroyed = useLibGroupDestroyed(convoId);

  const isFriend = useIsPrivateAndFriend(convoId);
  const isPrivate = useIsPrivate(convoId);
  const isMessageRequestShown = useSelector(getIsMessageRequestOverlayShown);

  if (
    !convoId ||
    isMessageRequestShown ||
    isKickedFromGroup ||
    isGroupDestroyed ||
    isBlocked ||
    !isActive ||
    (isPrivate && !isFriend)
  ) {
    return null;
  }

  // const isRtlMode = isRtlBody();

  // exclude mentions_only settings for private chats as this does not make much sense
  const notificationForConvoOptions = ConversationNotificationSetting.filter(n =>
    isPrivate ? n !== 'mentions_only' : true
  ).map((n: ConversationNotificationSettingType) => {
    // do this separately so typescript's compiler likes it
    const keyToUse: LocalizerToken =
      n === 'all' || !n
        ? 'notificationsAllMessages'
        : n === 'disabled'
          ? 'notificationsMute'
          : 'notificationsMentionsOnly';
    return { value: n, name: window.i18n(keyToUse) };
  });

  return (
    // Remove the && false to make context menu work with RTL support
    <Submenu
      label={window.i18n('sessionNotifications') as any}
      // rtl={isRtlMode && false}
    >
      {(notificationForConvoOptions || []).map(item => {
        const disabled = item.value === currentNotificationSetting;

        return (
          <ItemWithDataTestId
            key={item.value}
            onClick={() => {
              void setNotificationForConvoId(convoId, item.value);
            }}
            disabled={disabled}
          >
            {item.name}
          </ItemWithDataTestId>
        );
      })}
    </Submenu>
  );

  return null;
};
