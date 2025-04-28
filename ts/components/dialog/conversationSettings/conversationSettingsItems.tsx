import type { SessionDataTestId } from 'react';
import { useDispatch } from 'react-redux';

import {
  useConversationUsername,
  useDisappearingMessageSettingText,
  useIsActive,
  useIsBlocked,
  useIsClosedGroup,
  useIsGroupDestroyed,
  useIsGroupV2,
  useIsKickedFromGroup,
  useIsPinned,
  useIsPublic,
  useNotificationSetting,
  useWeAreAdmin,
} from '../../../hooks/useParamSelector';
import {
  showDeleteGroupByConvoId,
  showLeaveGroupByConvoId,
  showUpdateGroupMembersByConvoId,
  showUpdateGroupNameByConvoId,
} from '../../../interactions/conversationInteractions';
import { localize } from '../../../localization/localeTools';
import type { ConversationNotificationSettingType } from '../../../models/conversationAttributes';
import { PubKey } from '../../../session/types';
import { hasClosedGroupV2QAButtons } from '../../../shared/env_vars';
import { groupInfoActions } from '../../../state/ducks/metaGroups';
import { useIsMessageRequestOverlayShown } from '../../../state/selectors/section';
import { useConversationIsExpired03Group } from '../../../state/selectors/selectedConversation';
import { PanelIconButton } from '../../buttons';
import { PanelIconLucideIcon, PanelIconSessionLegacyIcon } from '../../buttons/PanelIconButton';
import { LUCIDE_ICONS_UNICODE } from '../../icon/lucide';
import {
  showDeleteGroupItem,
  showLeaveGroupItem,
} from '../../menu/items/LeaveAndDeleteGroup/guard';
import { showLeaveCommunityItem } from '../../menu/items/LeaveCommunity/guard';
import { useShowNotificationFor } from '../../menuAndSettingsHooks/useShowNotificationFor';
import type { WithConvoId } from '../../../session/types/with';
import { ConvoHub } from '../../../session/conversations';
import { useShowPinUnpin } from '../../menuAndSettingsHooks/usePinUnpin';
import { openRightPanel } from '../../../state/ducks/conversations';
import { updateConversationSettingsModal } from '../../../state/ducks/modalDialog';
import { useLocalisedNotificationOf } from '../../menuAndSettingsHooks/useLocalisedNotificationFor';
import { useShowBlockUnblock } from '../../menuAndSettingsHooks/useShowBlockUnblock';
import { useShowDeletePrivateContactCb } from '../../menuAndSettingsHooks/useShowDeletePrivateContact';
import { useClearAllMessagesCb } from '../../menuAndSettingsHooks/useClearAllMessages';
import { useHideNoteToSelfCb } from '../../menuAndSettingsHooks/useHideNoteToSelf';
import { useShowDeletePrivateConversationCb } from '../../menuAndSettingsHooks/useShowDeletePrivateConversation';
import { useShowInviteContactToCommunity } from '../../menuAndSettingsHooks/useShowInviteContactToCommunity';
import { useShowInviteContactToGroupCb } from '../../menuAndSettingsHooks/useShowInviteContactToGroup';
import { useShowCopyAccountIdCb } from '../../menuAndSettingsHooks/useCopyAccountId';
import { useShowCopyCommunityUrlCb } from '../../menuAndSettingsHooks/useCopyCommunityUrl';
import { useBanUserCb } from '../../menuAndSettingsHooks/useBanUser';
import { useUnbanUserCb } from '../../menuAndSettingsHooks/useUnbanUnser';
import { useAddModeratorsCb } from '../../menuAndSettingsHooks/useAddModerators';
import { useRemoveModeratorsCb } from '../../menuAndSettingsHooks/useRemoveModerators';

type WithAsAdmin = { asAdmin: boolean };

function useGroupCommonNoShow(convoId: string) {
  const isKickedFromGroup = useIsKickedFromGroup(convoId) || false;
  const isBlocked = useIsBlocked(convoId);
  const isActive = useIsActive(convoId);

  return isKickedFromGroup || isBlocked || !isActive;
}

export const LeaveCommunityPanelButton = ({ conversationId }: WithConvoId) => {
  const displayName = useConversationUsername(conversationId) || conversationId;
  const isPublic = useIsPublic(conversationId);

  const showItem = showLeaveCommunityItem({ isPublic });

  if (!conversationId || !showItem) {
    return null;
  }

  return (
    <PanelIconButton
      text={localize('communityLeave').toString()}
      dataTestId="leave-community-menu-option"
      onClick={() => void showLeaveGroupByConvoId(conversationId, displayName)}
      color={'var(--danger-color)'}
      iconElement={<PanelIconLucideIcon iconUnicode={LUCIDE_ICONS_UNICODE.LOG_OUT} />}
    />
  );
};

export const DeleteGroupPanelButton = ({ conversationId }: WithConvoId) => {
  const isGroup = useIsClosedGroup(conversationId);
  const isMessageRequestShown = useIsMessageRequestOverlayShown();
  const isKickedFromGroup = useIsKickedFromGroup(conversationId) || false;
  const displayName = useConversationUsername(conversationId) || conversationId;
  const isPublic = useIsPublic(conversationId);
  const isGroupDestroyed = useIsGroupDestroyed(conversationId);
  const is03GroupExpired = useConversationIsExpired03Group(conversationId);

  const showItem = showDeleteGroupItem({
    isGroup,
    isKickedFromGroup,
    isMessageRequestShown,
    isPublic,
    isGroupDestroyed,
    is03GroupExpired,
  });

  if (!showItem || !conversationId) {
    return null;
  }

  const token = PubKey.is03Pubkey(conversationId) ? 'groupDelete' : 'conversationsDelete';

  return (
    <PanelIconButton
      text={localize(token).toString()}
      dataTestId="leave-group-button"
      onClick={() => void showDeleteGroupByConvoId(conversationId, displayName)}
      color={'var(--danger-color)'}
      iconElement={<PanelIconLucideIcon iconUnicode={LUCIDE_ICONS_UNICODE.TRASH2} />}
    />
  );
};

export const LeaveGroupPanelButton = ({ conversationId }: WithConvoId) => {
  const isGroup = useIsClosedGroup(conversationId);
  const username = useConversationUsername(conversationId) || conversationId;
  const isMessageRequestShown = useIsMessageRequestOverlayShown();
  const isKickedFromGroup = useIsKickedFromGroup(conversationId) || false;
  const isPublic = useIsPublic(conversationId);
  const isGroupDestroyed = useIsGroupDestroyed(conversationId);

  const showItem = showLeaveGroupItem({
    isGroup,
    isKickedFromGroup,
    isMessageRequestShown,
    isPublic,
    isGroupDestroyed,
  });

  if (!conversationId || !showItem) {
    return null;
  }

  return (
    <PanelIconButton
      text={localize('groupLeave').toString()}
      dataTestId="leave-group-button"
      onClick={() => void showLeaveGroupByConvoId(conversationId, username)}
      color={'var(--danger-color)'}
      iconElement={<PanelIconLucideIcon iconUnicode={LUCIDE_ICONS_UNICODE.LOG_OUT} />}
    />
  );
};

export const NotificationPanelIconButton = (notification: ConversationNotificationSettingType) => {
  switch (notification) {
    case 'mentions_only':
      return LUCIDE_ICONS_UNICODE.AT_SIGN;
    case 'disabled':
      return LUCIDE_ICONS_UNICODE.VOLUME_OFF;
    case 'all':
    default:
      return LUCIDE_ICONS_UNICODE.VOLUME_2;
  }
};

export const NotificationPanelButton = ({ convoId }: { convoId: string }) => {
  const dispatch = useDispatch();
  const showNotificationFor = useShowNotificationFor(convoId);

  const notification = useNotificationSetting(convoId);

  const subText = useLocalisedNotificationOf(notification, 'state');

  if (!showNotificationFor) {
    return null;
  }

  return (
    <PanelIconButton
      iconElement={<PanelIconLucideIcon iconUnicode={NotificationPanelIconButton(notification)} />}
      text={localize('sessionNotifications').toString()}
      onClick={() => {
        dispatch(
          updateConversationSettingsModal({
            conversationId: convoId,
            settingsModalPage: 'notifications',
            standalonePage: false,
          })
        );
      }}
      subText={subText}
      subTextDataTestId="notifications-details-menu-option"
      dataTestId="notifications-menu-option"
    />
  );
};

export const UpdateGroupNameButton = ({ conversationId }: WithConvoId) => {
  const isGroupV2 = useIsGroupV2(conversationId);
  const weAreAdmin = useWeAreAdmin(conversationId);

  const commonNoShow = useGroupCommonNoShow(conversationId);
  const showUpdateGroupNameButton = isGroupV2 && weAreAdmin && !commonNoShow;

  if (!showUpdateGroupNameButton) {
    return null;
  }
  return (
    <PanelIconButton
      iconElement={<PanelIconLucideIcon iconUnicode={LUCIDE_ICONS_UNICODE.USER_ROUND_PEN} />}
      text={localize('groupEdit').toString()}
      onClick={() => {
        void showUpdateGroupNameByConvoId(conversationId);
      }}
      dataTestId="edit-group-name"
    />
  );
};

export const AttachmentsButton = (_props: WithConvoId) => {
  const dispatch = useDispatch();
  return (
    <PanelIconButton
      iconElement={<PanelIconLucideIcon iconUnicode={LUCIDE_ICONS_UNICODE.FILE} />}
      text={localize('attachments').toString()}
      onClick={() => {
        dispatch(openRightPanel());
        dispatch(updateConversationSettingsModal(null));
      }}
      dataTestId="attachments-menu-option"
    />
  );
};

export const CopyAccountIdButton = ({ conversationId }: WithConvoId) => {
  const showCopyAccountId = useShowCopyAccountIdCb(conversationId);

  if (!showCopyAccountId) {
    return null;
  }

  return (
    <PanelIconButton
      iconElement={<PanelIconLucideIcon iconUnicode={LUCIDE_ICONS_UNICODE.COPY} />}
      text={localize('accountIDCopy').toString()}
      onClick={showCopyAccountId}
      dataTestId="copy-account-id-menu-option"
    />
  );
};

export const PinUnpinButton = ({ conversationId }: WithConvoId) => {
  const showPinUnpin = useShowPinUnpin(conversationId);
  const isPinned = useIsPinned(conversationId);

  if (!showPinUnpin) {
    return null;
  }

  return (
    <PanelIconButton
      iconElement={
        <PanelIconLucideIcon
          iconUnicode={isPinned ? LUCIDE_ICONS_UNICODE.PIN_OFF : LUCIDE_ICONS_UNICODE.PIN}
        />
      }
      text={localize(isPinned ? 'pinUnpinConversation' : 'pinConversation').toString()}
      onClick={() => {
        void ConvoHub.use().get(conversationId)?.togglePinned();
      }}
      dataTestId="attachments-menu-option"
    />
  );
};

export const ConversationSettingsQAButtons = ({ conversationId }: WithConvoId) => {
  const isGroupV2 = useIsGroupV2(conversationId);
  const dispatch = useDispatch();

  if (!hasClosedGroupV2QAButtons() || !isGroupV2) {
    return null;
  }

  return (
    <>
      <PanelIconButton
        iconElement={<PanelIconLucideIcon iconUnicode={LUCIDE_ICONS_UNICODE.BUG} />}
        text={'trigger avatar message'}
        onClick={() => {
          if (!PubKey.is03Pubkey(conversationId)) {
            throw new Error('triggerFakeAvatarUpdate needs a 03 pubkey');
          }
          dispatch(groupInfoActions.triggerFakeAvatarUpdate({ groupPk: conversationId }) as any);
        }}
        dataTestId={'' as SessionDataTestId}
      />
      <PanelIconButton
        iconElement={<PanelIconLucideIcon iconUnicode={LUCIDE_ICONS_UNICODE.BUG} />}
        text={'trigger delete message before now'}
        onClick={() => {
          if (!PubKey.is03Pubkey(conversationId)) {
            throw new Error('We need a 03 pubkey');
          }
          window.inboxStore?.dispatch(
            groupInfoActions.triggerFakeDeleteMsgBeforeNow({
              groupPk: conversationId,
              messagesWithAttachmentsOnly: false,
            }) as any
          );
        }}
        dataTestId={'' as SessionDataTestId}
      />
      <PanelIconButton
        iconElement={<PanelIconLucideIcon iconUnicode={LUCIDE_ICONS_UNICODE.BUG} />}
        text={'delete message with attachments before now'}
        onClick={() => {
          if (!PubKey.is03Pubkey(conversationId)) {
            throw new Error('We need a 03 pubkey');
          }
          window.inboxStore?.dispatch(
            groupInfoActions.triggerFakeDeleteMsgBeforeNow({
              groupPk: conversationId,
              messagesWithAttachmentsOnly: true,
            }) as any
          );
        }}
        dataTestId={'' as SessionDataTestId}
      />
    </>
  );
};

export function UpdateGroupMembersButton({
  conversationId,
  asAdmin,
}: WithConvoId & { asAdmin: boolean }) {
  const isGroup = useIsClosedGroup(conversationId);

  const commonNoShow = useGroupCommonNoShow(conversationId);
  const showUpdateGroupMembersButton = isGroup && !commonNoShow;

  const weAreAdmin = useWeAreAdmin(conversationId);

  if (!showUpdateGroupMembersButton) {
    return null;
  }

  if (weAreAdmin && !asAdmin) {
    return null;
  }
  if (!weAreAdmin && asAdmin) {
    return null;
  }
  return (
    <PanelIconButton
      iconElement={<PanelIconLucideIcon iconUnicode={LUCIDE_ICONS_UNICODE.USER_ROUND} />}
      text={asAdmin ? localize('manageMembers').toString() : localize('groupMembers').toString()}
      onClick={() => {
        void showUpdateGroupMembersByConvoId(conversationId);
      }}
      dataTestId={asAdmin ? 'manage-members-menu-option' : 'group-members-menu-option'}
    />
  );
}

export function UpdateDisappearingMessagesButton({
  conversationId,
  asAdmin,
}: WithConvoId & WithAsAdmin) {
  const commonNoShow = useGroupCommonNoShow(conversationId);
  const isPublic = useIsPublic(conversationId);
  const hasDisappearingMessages = !isPublic && !commonNoShow;
  const disappearingMessagesSubtitle = useDisappearingMessageSettingText({
    convoId: conversationId,
  });
  const dispatch = useDispatch();

  const isGroupV2 = useIsGroupV2(conversationId);
  const weAreAdmin = useWeAreAdmin(conversationId);

  if (!hasDisappearingMessages) {
    return null;
  }

  /**
   * UpdateDisappearingMessagesButton is rendered twice, once for the group admins and once for the group members.
   * `asAdmin` is used to know which one we are rendering.
   */

  if (!isGroupV2 && asAdmin) {
    // when this is not a groupv2, we only render the button as part of the "non admins" actions
    return null;
  }
  if (isGroupV2 && asAdmin && !weAreAdmin) {
    return null;
  }
  if (isGroupV2 && !asAdmin && weAreAdmin) {
    return null;
  }

  return (
    <PanelIconButton
      iconElement={<PanelIconLucideIcon iconUnicode={LUCIDE_ICONS_UNICODE.TIMER} />}
      text={localize('disappearingMessages').toString()}
      subText={disappearingMessagesSubtitle}
      dataTestId="disappearing-messages-menu-option"
      onClick={() => {
        dispatch(
          updateConversationSettingsModal({
            conversationId,
            settingsModalPage: 'disappearing_message',
            standalonePage: false,
          })
        );
      }}
    />
  );
}

export function AddAdminCommunityButton({ conversationId }: WithConvoId) {
  const cb = useAddModeratorsCb(conversationId);

  if (!cb) {
    return null;
  }
  return (
    <PanelIconButton
      iconElement={
        <PanelIconSessionLegacyIcon
          iconType={'addModerator'}
          iconColor="var(--text-primary-color"
        />
      }
      text={localize('addAdmins').toString()}
      onClick={cb}
      dataTestId="add-admins-menu-option"
    />
  );
}
export function RemoveAdminCommunityButton({ conversationId }: WithConvoId) {
  const cb = useRemoveModeratorsCb(conversationId);

  if (!cb) {
    return null;
  }
  return (
    <PanelIconButton
      iconElement={
        <PanelIconSessionLegacyIcon
          iconType={'deleteModerator'}
          iconColor="var(--text-primary-color"
        />
      }
      text={localize('adminRemove').toString()}
      onClick={cb}
      dataTestId="remove-admins-menu-option"
    />
  );
}

export function BanFromCommunityButton({ conversationId }: WithConvoId) {
  const showBanUserCb = useBanUserCb(conversationId);

  if (!showBanUserCb) {
    return null;
  }
  return (
    <PanelIconButton
      iconElement={<PanelIconLucideIcon iconUnicode={LUCIDE_ICONS_UNICODE.USER_ROUND_X} />}
      text={localize('banUser').toString()}
      onClick={showBanUserCb}
      dataTestId="ban-user-menu-option"
    />
  );
}

export function UnbanFromCommunityButton({ conversationId }: WithConvoId) {
  const showUnbanUserCb = useUnbanUserCb(conversationId);

  if (!showUnbanUserCb) {
    return null;
  }
  return (
    <PanelIconButton
      iconElement={<PanelIconLucideIcon iconUnicode={LUCIDE_ICONS_UNICODE.USER_ROUND_CHECK} />}
      text={localize('banUnbanUser').toString()}
      onClick={showUnbanUserCb}
      dataTestId="unban-user-menu-option"
    />
  );
}

export function InviteContactsToCommunityButton({ conversationId }: WithConvoId) {
  const showInviteContactCb = useShowInviteContactToCommunity(conversationId);

  if (!showInviteContactCb) {
    return null;
  }
  return (
    <PanelIconButton
      iconElement={<PanelIconLucideIcon iconUnicode={LUCIDE_ICONS_UNICODE.USER_ROUND_PLUS} />}
      text={localize('membersInvite').toString()}
      onClick={showInviteContactCb}
      dataTestId="invite-contacts-menu-option"
    />
  );
}

export function CopyCommunityUrlButton({ conversationId }: WithConvoId) {
  const copyCommunityUrlCb = useShowCopyCommunityUrlCb(conversationId);

  if (!copyCommunityUrlCb) {
    return null;
  }
  return (
    <PanelIconButton
      iconElement={<PanelIconLucideIcon iconUnicode={LUCIDE_ICONS_UNICODE.COPY} />}
      text={localize('communityUrlCopy').toString()}
      onClick={copyCommunityUrlCb}
      dataTestId="copy-community-url-menu-option"
    />
  );
}

export function InviteContactsToGroupV2Button({ conversationId }: WithConvoId) {
  const showInviteContactToGroupCb = useShowInviteContactToGroupCb(conversationId);

  if (!showInviteContactToGroupCb) {
    return null;
  }
  return (
    <PanelIconButton
      iconElement={<PanelIconLucideIcon iconUnicode={LUCIDE_ICONS_UNICODE.USER_ROUND_PLUS} />}
      text={localize('membersInvite').toString()}
      onClick={showInviteContactToGroupCb}
      dataTestId="invite-contacts-menu-option"
    />
  );
}

export function ClearAllMessagesButton({ conversationId }: WithConvoId) {
  const clearAllMessagesCb = useClearAllMessagesCb({ conversationId });
  return (
    <PanelIconButton
      iconElement={
        <PanelIconSessionLegacyIcon iconType={'messageTrash'} iconColor="var(--danger-color)" />
      }
      text={localize('clearMessages').toString()}
      onClick={clearAllMessagesCb}
      dataTestId="clear-all-messages-menu-option"
      color="var(--danger-color)"
    />
  );
}

export function DeletePrivateConversationButton({ conversationId }: WithConvoId) {
  const showDeleteConversationContactCb = useShowDeletePrivateConversationCb({ conversationId });

  if (!showDeleteConversationContactCb) {
    return null;
  }

  return (
    <PanelIconButton
      iconElement={<PanelIconLucideIcon iconUnicode={LUCIDE_ICONS_UNICODE.TRASH2} />}
      text={localize('conversationsDelete').toString()}
      onClick={showDeleteConversationContactCb}
      dataTestId="delete-conversation-menu-option"
      color="var(--danger-color)"
    />
  );
}

export function HideNoteToSelfButton({ conversationId }: WithConvoId) {
  const showHideNoteToSelfCb = useHideNoteToSelfCb({ conversationId });

  if (!showHideNoteToSelfCb) {
    return null;
  }

  return (
    <PanelIconButton
      iconElement={<PanelIconLucideIcon iconUnicode={LUCIDE_ICONS_UNICODE.EYE_OFF} />}
      text={localize('noteToSelfHide').toString()}
      onClick={showHideNoteToSelfCb}
      dataTestId="hide-nts-menu-option"
      color="var(--danger-color)"
    />
  );
}

export function DeletePrivateContactButton({ conversationId }: WithConvoId) {
  const showDeletePrivateContactCb = useShowDeletePrivateContactCb({ conversationId });

  if (!showDeletePrivateContactCb) {
    return null;
  }

  return (
    <PanelIconButton
      iconElement={
        <PanelIconSessionLegacyIcon iconType={'removeUser'} iconColor="var(--danger-color)" />
      }
      text={localize('contactDelete').toString()}
      onClick={showDeletePrivateContactCb}
      dataTestId="delete-conversation-menu-option"
      color="var(--danger-color)"
    />
  );
}

export function BlockUnblockButton({ conversationId }: WithConvoId) {
  const showBlockUnblock = useShowBlockUnblock(conversationId);

  if (!showBlockUnblock) {
    return null;
  }

  return (
    <PanelIconButton
      iconElement={<PanelIconLucideIcon iconUnicode={LUCIDE_ICONS_UNICODE.BAN} />}
      text={localize(showBlockUnblock.token).toString()}
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      onClick={showBlockUnblock.cb}
      dataTestId="block-user-menu-option"
      color="var(--danger-color)"
    />
  );
}
