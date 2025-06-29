import {
  useDisappearingMessageSettingText,
  useIsClosedGroup,
  useIsGroupV2,
  useIsPinned,
  useIsPublic,
  useNotificationSetting,
  useWeAreAdmin,
} from '../../../hooks/useParamSelector';
import { showUpdateGroupMembersByConvoId } from '../../../interactions/conversationInteractions';
import { localize } from '../../../localization/localeTools';
import type { ConversationNotificationSettingType } from '../../../models/conversationAttributes';
import { PanelIconButton } from '../../buttons';
import { PanelIconLucideIcon, PanelIconSessionLegacyIcon } from '../../buttons/PanelIconButton';
import { LUCIDE_ICONS_UNICODE } from '../../icon/lucide';
import { useShowNotificationFor } from '../../menuAndSettingsHooks/useShowNotificationFor';
import type { WithConvoId } from '../../../session/types/with';
import { ConvoHub } from '../../../session/conversations';
import { useShowPinUnpin } from '../../menuAndSettingsHooks/usePinUnpin';
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
import { useUnbanUserCb } from '../../menuAndSettingsHooks/useUnbanUser';
import { useAddModeratorsCb } from '../../menuAndSettingsHooks/useAddModerators';
import { useRemoveModeratorsCb } from '../../menuAndSettingsHooks/useRemoveModerators';
import { useShowLeaveCommunityCb } from '../../menuAndSettingsHooks/useShowLeaveCommunity';
import {
  useShowDeleteGroupCb,
  useShowLeaveGroupCb,
} from '../../menuAndSettingsHooks/useShowLeaveGroup';
import { useShowAttachments } from '../../menuAndSettingsHooks/useShowAttachments';
import { useGroupCommonNoShow } from '../../menuAndSettingsHooks/useGroupCommonNoShow';
import { useShowConversationSettingsFor } from '../../menuAndSettingsHooks/useShowConversationSettingsFor';
import { useShowNoteToSelfCb } from '../../menuAndSettingsHooks/useShowNoteToSelf';

type WithAsAdmin = { asAdmin: boolean };

export const LeaveCommunityPanelButton = ({ conversationId }: WithConvoId) => {
  const cb = useShowLeaveCommunityCb(conversationId);

  if (!cb) {
    return null;
  }

  return (
    <PanelIconButton
      text={localize('communityLeave').toString()}
      dataTestId="leave-community-menu-option"
      onClick={cb}
      color={'var(--danger-color)'}
      iconElement={<PanelIconLucideIcon unicode={LUCIDE_ICONS_UNICODE.LOG_OUT} />}
    />
  );
};

export const DeleteGroupPanelButton = ({ conversationId }: WithConvoId) => {
  const cb = useShowDeleteGroupCb(conversationId);

  if (!cb || !conversationId) {
    return null;
  }

  return (
    <PanelIconButton
      text={localize('groupDelete').toString()}
      dataTestId="leave-group-button"
      onClick={cb}
      color={'var(--danger-color)'}
      iconElement={<PanelIconLucideIcon unicode={LUCIDE_ICONS_UNICODE.TRASH2} />}
    />
  );
};

export const LeaveGroupPanelButton = ({ conversationId }: WithConvoId) => {
  const cb = useShowLeaveGroupCb(conversationId);

  if (!conversationId || !cb) {
    return null;
  }

  return (
    <PanelIconButton
      text={localize('groupLeave').toString()}
      dataTestId="leave-group-button"
      onClick={cb}
      color={'var(--danger-color)'}
      iconElement={<PanelIconLucideIcon unicode={LUCIDE_ICONS_UNICODE.LOG_OUT} />}
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
  const showNotificationFor = useShowNotificationFor(convoId);

  const notification = useNotificationSetting(convoId);

  const subText = useLocalisedNotificationOf(notification, 'state');
  const showConvoSettingsCb = useShowConversationSettingsFor(convoId);

  if (!showNotificationFor || !showConvoSettingsCb) {
    return null;
  }

  return (
    <PanelIconButton
      iconElement={<PanelIconLucideIcon unicode={NotificationPanelIconButton(notification)} />}
      text={localize('sessionNotifications').toString()}
      onClick={() => {
        showConvoSettingsCb({
          settingsModalPage: 'notifications',
          standalonePage: false,
        });
      }}
      subText={subText}
      subTextDataTestId="notifications-details-menu-option"
      dataTestId="notifications-menu-option"
    />
  );
};

export const AttachmentsButton = (_props: WithConvoId) => {
  const showAttachmentsCb = useShowAttachments({ conversationId: _props.conversationId });

  if (!showAttachmentsCb) {
    return null;
  }
  return (
    <PanelIconButton
      iconElement={<PanelIconLucideIcon unicode={LUCIDE_ICONS_UNICODE.FILE} />}
      text={localize('attachments').toString()}
      onClick={showAttachmentsCb}
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
      iconElement={<PanelIconLucideIcon unicode={LUCIDE_ICONS_UNICODE.COPY} />}
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
          unicode={isPinned ? LUCIDE_ICONS_UNICODE.PIN_OFF : LUCIDE_ICONS_UNICODE.PIN}
        />
      }
      text={localize(isPinned ? 'pinUnpinConversation' : 'pinConversation').toString()}
      onClick={() => {
        void ConvoHub.use().get(conversationId)?.togglePinned();
      }}
      dataTestId="pin-conversation-menu-option"
    />
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
      iconElement={<PanelIconLucideIcon unicode={LUCIDE_ICONS_UNICODE.USER_ROUND} />}
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

  const isGroupV2 = useIsGroupV2(conversationId);
  const weAreAdmin = useWeAreAdmin(conversationId);
  const showConvoSettingsCb = useShowConversationSettingsFor(conversationId);

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
      iconElement={<PanelIconLucideIcon unicode={LUCIDE_ICONS_UNICODE.TIMER} />}
      text={localize('disappearingMessages').toString()}
      subText={disappearingMessagesSubtitle.label}
      dataTestId="disappearing-messages-menu-option"
      onClick={() => {
        showConvoSettingsCb?.({ settingsModalPage: 'disappearing_message', standalonePage: false });
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
      iconElement={<PanelIconLucideIcon unicode={LUCIDE_ICONS_UNICODE.USER_ROUND_X} />}
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
      iconElement={<PanelIconLucideIcon unicode={LUCIDE_ICONS_UNICODE.USER_ROUND_CHECK} />}
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
      iconElement={<PanelIconLucideIcon unicode={LUCIDE_ICONS_UNICODE.USER_ROUND_PLUS} />}
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
      iconElement={<PanelIconLucideIcon unicode={LUCIDE_ICONS_UNICODE.COPY} />}
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
      iconElement={<PanelIconLucideIcon unicode={LUCIDE_ICONS_UNICODE.USER_ROUND_PLUS} />}
      text={localize('membersInvite').toString()}
      onClick={showInviteContactToGroupCb}
      dataTestId="invite-contacts-menu-option"
    />
  );
}

export function ClearAllMessagesButton({ conversationId }: WithConvoId) {
  const clearAllMessagesCb = useClearAllMessagesCb({ conversationId });

  if (!clearAllMessagesCb) {
    return null;
  }
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
      iconElement={<PanelIconLucideIcon unicode={LUCIDE_ICONS_UNICODE.TRASH2} />}
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
      iconElement={<PanelIconLucideIcon unicode={LUCIDE_ICONS_UNICODE.EYE_OFF} />}
      text={localize('noteToSelfHide').toString()}
      onClick={showHideNoteToSelfCb}
      dataTestId="hide-nts-menu-option"
      color="var(--danger-color)"
    />
  );
}

export function ShowNoteToSelfButton({ conversationId }: WithConvoId) {
  const showShowNoteToSelfCb = useShowNoteToSelfCb({ conversationId });

  if (!showShowNoteToSelfCb) {
    return null;
  }

  return (
    <PanelIconButton
      iconElement={<PanelIconLucideIcon unicode={LUCIDE_ICONS_UNICODE.EYE} />}
      text={localize('showNoteToSelf').toString()}
      onClick={showShowNoteToSelfCb}
      dataTestId="show-nts-menu-option"
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
      dataTestId="delete-contact-menu-option"
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
      iconElement={<PanelIconLucideIcon unicode={showBlockUnblock.icon} />}
      text={localize(showBlockUnblock.token).toString()}
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      onClick={showBlockUnblock.cb}
      dataTestId="block-user-menu-option"
      color="var(--danger-color)"
    />
  );
}
