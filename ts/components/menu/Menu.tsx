import type { JSX } from 'react';
import { contextMenu } from 'react-contexify';
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
import { MenuItem, SubMenuItem } from './items/MenuItem';
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
import { useUnbanUserCb } from '../menuAndSettingsHooks/useUnbanUser';
import { useBanUserCb } from '../menuAndSettingsHooks/useBanUser';
import { useSetNotificationsFor } from '../menuAndSettingsHooks/useSetNotificationsFor';
import { Localizer } from '../basic/Localizer';
import { useChangeNickname } from '../menuAndSettingsHooks/useChangeNickname';
import { useShowNoteToSelfCb } from '../menuAndSettingsHooks/useShowNoteToSelf';
import { useShowUserDetailsCbFromConversation } from '../menuAndSettingsHooks/useShowUserDetailsCb';
import { useDeclineMessageRequest } from '../menuAndSettingsHooks/useDeclineMessageRequest';
import { LUCIDE_ICONS_UNICODE } from '../icon/lucide';
import { MailWithUnreadIcon } from '../icon/MailWithUnreadIcon';

/** Menu items standardized */

export const InviteContactMenuItem = (): JSX.Element | null => {
  const convoId = useConvoIdFromContext();
  const showInviteContactCb = useShowInviteContactToCommunity(convoId);

  if (showInviteContactCb) {
    return (
      <MenuItem
        onClick={showInviteContactCb}
        iconType={LUCIDE_ICONS_UNICODE.USER_ROUND_PLUS}
        isDangerAction={false}
      >
        {tr('membersInvite')}
      </MenuItem>
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

    return (
      <MenuItem
        onClick={markUnread}
        iconType={<MailWithUnreadIcon iconSize="medium" />}
        isDangerAction={false}
      >
        {tr('messageMarkUnread')}
      </MenuItem>
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
  const convoId = useConvoIdFromContext();

  const showDeletePrivateContactCb = useShowDeletePrivateContactCb({ conversationId: convoId });

  if (!showDeletePrivateContactCb) {
    return null;
  }

  return (
    <MenuItem onClick={showDeletePrivateContactCb} iconType="removeUser" isDangerAction={true}>
      {tr('contactDelete')}
    </MenuItem>
  );
};

export const ShowUserProfileMenuItem = () => {
  const convoId = useConvoIdFromContext();

  const showUserDetailsCb = useShowUserDetailsCbFromConversation(convoId, true);

  if (showUserDetailsCb) {
    return (
      <MenuItem
        onClick={showUserDetailsCb}
        iconType={LUCIDE_ICONS_UNICODE.INFO}
        isDangerAction={false}
      >
        {tr('contactUserDetails')}
      </MenuItem>
    );
  }

  return null;
};

export const UnbanMenuItem = (): JSX.Element | null => {
  const convoId = useConvoIdFromContext();
  const showUnbanUserCb = useUnbanUserCb(convoId);

  if (!showUnbanUserCb) {
    return null;
  }
  return (
    <MenuItem
      onClick={showUnbanUserCb}
      iconType={LUCIDE_ICONS_UNICODE.USER_ROUND_CHECK}
      isDangerAction={true}
    >
      {tr('banUnbanUser')}
    </MenuItem>
  );
};

export const BanMenuItem = (): JSX.Element | null => {
  const convoId = useConvoIdFromContext();

  const showBanUserCb = useBanUserCb(convoId);

  if (!showBanUserCb) {
    return null;
  }
  return (
    <MenuItem
      onClick={showBanUserCb}
      iconType={LUCIDE_ICONS_UNICODE.USER_ROUND_X}
      isDangerAction={true}
    >
      {tr('banUser')}
    </MenuItem>
  );
};

export const MarkAllReadMenuItem = (): JSX.Element | null => {
  const convoId = useConvoIdFromContext();
  const isIncomingRequest = useIsIncomingRequest(convoId);
  if (!isIncomingRequest && !PubKey.isBlinded(convoId)) {
    return (
      <MenuItem
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        onClick={async () => markAllReadByConvoId(convoId)}
        iconType={LUCIDE_ICONS_UNICODE.MAIL_OPEN}
        isDangerAction={false}
      >
        {tr('messageMarkRead')}
      </MenuItem>
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
    <MenuItem
      onClick={showBlockUnblock.cb}
      iconType={showBlockUnblock.icon}
      isDangerAction={showBlockUnblock.token === 'block'}
    >
      {tr(showBlockUnblock.token)}
    </MenuItem>
  );
};

export const ChangeNicknameMenuItem = () => {
  const convoId = useConvoIdFromContext();

  const changeNicknameCb = useChangeNickname(convoId);

  if (!changeNicknameCb) {
    return null;
  }
  return (
    <MenuItem
      onClick={changeNicknameCb}
      iconType={LUCIDE_ICONS_UNICODE.USER_ROUND_PEN}
      isDangerAction={false}
    >
      <Localizer token="nicknameSet" />
    </MenuItem>
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
    <MenuItem onClick={clearAllMessagesCb} iconType="messageTrash" isDangerAction={true}>
      {/* just more than 1 to have the string Delete Messages */}
      {tr('clearMessages')}
    </MenuItem>
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
    <MenuItem
      onClick={() => {
        showDeleteConversationContactCb();
      }}
      iconType={LUCIDE_ICONS_UNICODE.TRASH2}
      isDangerAction={true}
    >
      {tr('conversationsDelete')}
    </MenuItem>
  );
};

export const HideNoteToSelfMenuItem = () => {
  const convoId = useConvoIdFromContext();

  const showHideNoteToSelfCb = useHideNoteToSelfCb({ conversationId: convoId });

  if (!convoId || !showHideNoteToSelfCb) {
    return null;
  }

  return (
    <MenuItem
      onClick={() => {
        showHideNoteToSelfCb();
      }}
      iconType={LUCIDE_ICONS_UNICODE.EYE_OFF}
      isDangerAction={false}
    >
      {tr('noteToSelfHide')}
    </MenuItem>
  );
};

export const ShowNoteToSelfMenuItem = () => {
  const convoId = useConvoIdFromContext();

  const showShowNoteToSelfCb = useShowNoteToSelfCb({ conversationId: convoId });

  if (!convoId || !showShowNoteToSelfCb) {
    return null;
  }

  return (
    <MenuItem
      onClick={() => {
        showShowNoteToSelfCb();
      }}
      iconType={LUCIDE_ICONS_UNICODE.EYE}
      isDangerAction={false}
    >
      {tr('showNoteToSelf')}
    </MenuItem>
  );
};

export const AcceptMsgRequestMenuItem = () => {
  const convoId = useConvoIdFromContext();
  const isRequest = useIsIncomingRequest(convoId);
  const isPrivate = useIsPrivate(convoId);

  if (isRequest && (isPrivate || PubKey.is03Pubkey(convoId))) {
    return (
      <MenuItem
        onClick={() => {
          void handleAcceptConversationRequestWithoutConfirm({
            convoId,
            approvalMessageTimestamp: NetworkTime.now(),
          });
        }}
        dataTestId="accept-menu-item"
        iconType={LUCIDE_ICONS_UNICODE.USER_ROUND_CHECK}
        isDangerAction={false}
      >
        {tr('accept')}
      </MenuItem>
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
    <MenuItem
      onClick={declineCb}
      dataTestId="delete-menu-item"
      iconType={LUCIDE_ICONS_UNICODE.TRASH2}
      isDangerAction={true}
    >
      {tr('delete')}
    </MenuItem>
  );
};

export const DeclineAndBlockMsgRequestMenuItem = () => {
  const convoId = useConvoIdFromContext();

  const declineAndBlockCb = useDeclineMessageRequest({ conversationId: convoId, alsoBlock: true });

  if (!declineAndBlockCb) {
    return null;
  }
  return (
    <MenuItem
      onClick={declineAndBlockCb}
      dataTestId="block-menu-item"
      iconType={LUCIDE_ICONS_UNICODE.USER_ROUND_X}
      isDangerAction={true}
    >
      {tr('block')}
    </MenuItem>
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

  return (
    <SubMenuItem label={tr('sessionNotifications')} iconType={LUCIDE_ICONS_UNICODE.VOLUME_2}>
      {(notificationForConvoOptions || []).map(item => {
        const disabled = item.value === currentNotificationSetting;

        return (
          <MenuItem
            key={item.value}
            onClick={() => {
              setNotificationFor(item.value);
              contextMenu.hideAll();
            }}
            disabled={disabled}
            iconType={
              item.value === 'all'
                ? LUCIDE_ICONS_UNICODE.VOLUME_2
                : item.value === 'disabled'
                  ? LUCIDE_ICONS_UNICODE.VOLUME_OFF
                  : 'bell'
            }
            isDangerAction={false}
          >
            {tr(item.token)}
          </MenuItem>
        );
      })}
    </SubMenuItem>
  );

  return null;
};
