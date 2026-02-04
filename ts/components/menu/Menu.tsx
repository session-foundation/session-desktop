import { Submenu } from 'react-contexify';
import type { JSX } from 'react';
import { useConvoIdFromContext } from '../../contexts/ConvoIdContext';
import {
  useIsIncomingRequest,
  useIsPrivate,
  useIsPrivateAndFriend,
  useNotificationSetting,
} from '../../hooks/useParamSelector';
import {
  handleAcceptConversationRequestWithoutConfirm,
  markAllReadByConvoId,
} from '../../interactions/conversationInteractions';
import { ConvoHub } from '../../session/conversations';
import { PubKey } from '../../session/types';
import { useIsMessageRequestOverlayShown } from '../../state/selectors/section';
import { ItemWithDataTestId } from './items/MenuItemWithDataTestId';
import { NetworkTime } from '../../util/NetworkTime';
import { useShowNotificationFor } from '../menuAndSettingsHooks/useShowNotificationFor';
import { useLocalisedNotificationOptions } from '../menuAndSettingsHooks/useLocalisedNotificationFor';
import { tr } from '../../localization/localeTools';
import { useShowBlockUnblock } from '../menuAndSettingsHooks/useShowBlockUnblock';
import { useShowDeletePrivateContactCb } from '../menuAndSettingsHooks/useShowDeletePrivateContact';
import { useClearAllMessagesCb } from '../menuAndSettingsHooks/useClearAllMessages';
import { useHideNoteToSelfCb } from '../menuAndSettingsHooks/useHideNoteToSelf';
import { useShowDeletePrivateConversationCb } from '../menuAndSettingsHooks/useShowDeletePrivateConversation';
import { useShowInviteContactToCommunity } from '../menuAndSettingsHooks/useShowInviteContactToCommunity';
import { useAddModeratorsCb } from '../menuAndSettingsHooks/useAddModerators';
import { useRemoveModeratorsCb } from '../menuAndSettingsHooks/useRemoveModerators';
import { useUnbanUserCb } from '../menuAndSettingsHooks/useUnbanUser';
import { useBanUserCb } from '../menuAndSettingsHooks/useBanUser';
import { useSetNotificationsFor } from '../menuAndSettingsHooks/useSetNotificationsFor';
import { Localizer } from '../basic/Localizer';
import { useChangeNickname } from '../menuAndSettingsHooks/useChangeNickname';
import { useShowNoteToSelfCb } from '../menuAndSettingsHooks/useShowNoteToSelf';
import { useShowUserDetailsCbFromConversation } from '../menuAndSettingsHooks/useShowUserDetailsCb';
import { useDeclineMessageRequest } from '../menuAndSettingsHooks/useDeclineMessageRequest';

/** Menu items standardized */

export const InviteContactMenuItem = (): JSX.Element | null => {
  const convoId = useConvoIdFromContext();
  const showInviteContactCb = useShowInviteContactToCommunity(convoId);

  if (showInviteContactCb) {
    return (
      <ItemWithDataTestId onClick={showInviteContactCb}>{tr('membersInvite')}</ItemWithDataTestId>
    );
  }
  return null;
};

export const MarkConversationUnreadMenuItem = (): JSX.Element | null => {
  const conversationId = useConvoIdFromContext();
  const isPrivate = useIsPrivate(conversationId);
  const isPrivateAndFriend = useIsPrivateAndFriend(conversationId);
  const isMessageRequestShown = useIsMessageRequestOverlayShown();

  if (!isMessageRequestShown && (!isPrivate || (isPrivate && isPrivateAndFriend))) {
    const conversation = ConvoHub.use().get(conversationId);

    const markUnread = () => {
      void conversation?.markAsUnread(true);
    };

    return <ItemWithDataTestId onClick={markUnread}>{tr('messageMarkUnread')}</ItemWithDataTestId>;
  }
  return null;
};

/**
 * This menu item can be used to completely remove a contact and reset the flags of that conversation.
 * i.e. after confirmation is made, this contact will be removed from the ContactWrapper, and its blocked and approved state reset.
 * Note: We keep the entry in the database as the user profile might still be needed for communities/groups where this user.
 */
export const DeletePrivateContactMenuItem = () => {
  const convoId = useConvoIdFromContext();

  const showDeletePrivateContactCb = useShowDeletePrivateContactCb({ conversationId: convoId });

  if (!showDeletePrivateContactCb) {
    return null;
  }

  return (
    <ItemWithDataTestId onClick={showDeletePrivateContactCb}>
      {tr('contactDelete')}
    </ItemWithDataTestId>
  );
};

export const ShowUserProfileMenuItem = () => {
  const convoId = useConvoIdFromContext();

  const showUserDetailsCb = useShowUserDetailsCbFromConversation(convoId, true);

  if (showUserDetailsCb) {
    return (
      <ItemWithDataTestId onClick={showUserDetailsCb}>
        {tr('contactUserDetails')}
      </ItemWithDataTestId>
    );
  }

  return null;
};

export const RemoveModeratorsMenuItem = (): JSX.Element | null => {
  const convoId = useConvoIdFromContext();
  const showRemoveModeratorsCb = useRemoveModeratorsCb(convoId);

  if (!showRemoveModeratorsCb) {
    return null;
  }
  return (
    <ItemWithDataTestId onClick={showRemoveModeratorsCb}>{tr('adminRemove')}</ItemWithDataTestId>
  );
};

export const AddModeratorsMenuItem = (): JSX.Element | null => {
  const convoId = useConvoIdFromContext();
  const addRemoveModeratorsCb = useAddModeratorsCb(convoId);

  if (!addRemoveModeratorsCb) {
    return null;
  }
  return (
    <ItemWithDataTestId onClick={addRemoveModeratorsCb}>{tr('adminPromote')}</ItemWithDataTestId>
  );
};

export const UnbanMenuItem = (): JSX.Element | null => {
  const convoId = useConvoIdFromContext();
  const showUnbanUserCb = useUnbanUserCb(convoId);

  if (!showUnbanUserCb) {
    return null;
  }
  return <ItemWithDataTestId onClick={showUnbanUserCb}>{tr('banUnbanUser')}</ItemWithDataTestId>;
};

export const BanMenuItem = (): JSX.Element | null => {
  const convoId = useConvoIdFromContext();

  const showBanUserCb = useBanUserCb(convoId);

  if (!showBanUserCb) {
    return null;
  }
  return <ItemWithDataTestId onClick={showBanUserCb}>{tr('banUser')}</ItemWithDataTestId>;
};

export const MarkAllReadMenuItem = (): JSX.Element | null => {
  const convoId = useConvoIdFromContext();
  const isIncomingRequest = useIsIncomingRequest(convoId);
  if (!isIncomingRequest && !PubKey.isBlinded(convoId)) {
    return (
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      <ItemWithDataTestId onClick={async () => markAllReadByConvoId(convoId)}>
        {tr('messageMarkRead')}
      </ItemWithDataTestId>
    );
  }
  return null;
};

export const BlockMenuItem = (): JSX.Element | null => {
  const convoId = useConvoIdFromContext();
  const showBlockUnblock = useShowBlockUnblock(convoId);

  if (!showBlockUnblock) {
    return null;
  }

  return (
    <ItemWithDataTestId onClick={showBlockUnblock.cb}>
      {tr(showBlockUnblock.token)}
    </ItemWithDataTestId>
  );
};

export const ChangeNicknameMenuItem = () => {
  const convoId = useConvoIdFromContext();

  const changeNicknameCb = useChangeNickname(convoId);

  if (!changeNicknameCb) {
    return null;
  }
  return (
    <ItemWithDataTestId onClick={changeNicknameCb}>
      <Localizer token="nicknameSet" />
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
  const clearAllMessagesCb = useClearAllMessagesCb({ conversationId: convoId });

  if (!convoId || !clearAllMessagesCb) {
    return null;
  }
  return (
    <ItemWithDataTestId onClick={clearAllMessagesCb}>
      {/* just more than 1 to have the string Delete Messages */}
      {tr('clearMessages')}
    </ItemWithDataTestId>
  );
};

/**
 * This menu item can be used to delete a private conversation after confirmation.
 * It does not reset the flags of that conversation, but just removes the messages locally and hide it from the left pane list.
 * Note: A dialog is opened to ask for confirmation before processing.
 */
export const DeletePrivateConversationMenuItem = () => {
  const conversationId = useConvoIdFromContext();

  const showDeleteConversationContactCb = useShowDeletePrivateConversationCb({ conversationId });

  if (!conversationId || !showDeleteConversationContactCb) {
    return null;
  }

  return (
    <ItemWithDataTestId
      onClick={() => {
        showDeleteConversationContactCb();
      }}
    >
      {tr('conversationsDelete')}
    </ItemWithDataTestId>
  );
};

export const HideNoteToSelfMenuItem = () => {
  const convoId = useConvoIdFromContext();

  const showHideNoteToSelfCb = useHideNoteToSelfCb({ conversationId: convoId });

  if (!convoId || !showHideNoteToSelfCb) {
    return null;
  }

  return (
    <ItemWithDataTestId
      onClick={() => {
        showHideNoteToSelfCb();
      }}
    >
      {tr('noteToSelfHide')}
    </ItemWithDataTestId>
  );
};

export const ShowNoteToSelfMenuItem = () => {
  const convoId = useConvoIdFromContext();

  const showShowNoteToSelfCb = useShowNoteToSelfCb({ conversationId: convoId });

  if (!convoId || !showShowNoteToSelfCb) {
    return null;
  }

  return (
    <ItemWithDataTestId
      onClick={() => {
        showShowNoteToSelfCb();
      }}
    >
      {tr('showNoteToSelf')}
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
        onClick={() => {
          void handleAcceptConversationRequestWithoutConfirm({
            convoId,
            approvalMessageTimestamp: NetworkTime.now(),
          });
        }}
        dataTestId="accept-menu-item"
      >
        {tr('accept')}
      </ItemWithDataTestId>
    );
  }
  return null;
};

export const DeclineMsgRequestMenuItem = () => {
  const convoId = useConvoIdFromContext();
  const declineCb = useDeclineMessageRequest({ conversationId: convoId, alsoBlock: false });

  if (!declineCb) {
    return null;
  }

  return (
    <ItemWithDataTestId onClick={declineCb} dataTestId="delete-menu-item">
      {tr('delete')}
    </ItemWithDataTestId>
  );
};

export const DeclineAndBlockMsgRequestMenuItem = () => {
  const convoId = useConvoIdFromContext();

  const declineAndBlockCb = useDeclineMessageRequest({ conversationId: convoId, alsoBlock: true });

  if (!declineAndBlockCb) {
    return null;
  }
  return (
    <ItemWithDataTestId onClick={declineAndBlockCb} dataTestId="block-menu-item">
      {tr('block')}
    </ItemWithDataTestId>
  );
};

export const NotificationForConvoMenuItem = (): JSX.Element | null => {
  // Note: this item is used in the header and in the list item, so we need to grab the details
  // from the convoId from the context itself, not the redux selected state
  const convoId = useConvoIdFromContext();
  const currentNotificationSetting = useNotificationSetting(convoId);
  const showNotificationFor = useShowNotificationFor(convoId);
  const notificationForConvoOptions = useLocalisedNotificationOptions('action');

  const setNotificationFor = useSetNotificationsFor(convoId);

  if (!showNotificationFor) {
    return null;
  }
  // const isrtlMode = isRtlBody();

  return (
    // Remove the && false to make context menu work with RTL support
    <Submenu
      label={tr('sessionNotifications')}
      // rtl={isRtlMode && false}
    >
      {(notificationForConvoOptions || []).map(item => {
        const disabled = item.value === currentNotificationSetting;

        return (
          <ItemWithDataTestId
            key={item.value}
            onClick={() => {
              setNotificationFor(item.value);
            }}
            disabled={disabled}
          >
            {tr(item.token)}
          </ItemWithDataTestId>
        );
      })}
    </Submenu>
  );

  return null;
};
