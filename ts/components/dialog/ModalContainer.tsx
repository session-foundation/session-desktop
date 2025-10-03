import {
  useServerBanOrUnbanUserModalState,
  useUpdateGroupPermissionsModalState,
  useConfirmModal,
  useInviteContactModal,
  useAddModeratorsModal,
  useRemoveModeratorsModal,
  useUpdateGroupMembersModal,
  useUpdateConversationDetailsModal,
  useUserProfileModal,
  useChangeNickNameDialog,
  useUserSettingsModal,
  useOnionPathDialog,
  useEnterPasswordModal,
  useDeleteAccountModal,
  useBanOrUnbanUserModal,
  useBlockOrUnblockUserModal,
  useReactListDialog,
  useReactClearAllDialog,
  useEditProfilePictureModal,
  useHideRecoveryPasswordModal,
  useOpenUrlModal,
  useLocalizedPopupDialog,
  useSessionProInfoModal,
  useLightBoxOptions,
  useDebugMenuModal,
  useConversationSettingsModal,
} from '../../state/selectors/modal';
import { LightboxGallery } from '../lightbox/LightboxGallery';
import { BanOrUnBanUserDialog, ServerBanOrUnBanUserDialog } from './BanOrUnbanUserDialog';
import { DeleteAccountModal } from './DeleteAccountModal';
import { EditProfilePictureModal } from './EditProfilePictureModal';
import { EnterPasswordModal } from './EnterPasswordModal';
import { HideRecoveryPasswordDialog } from './HideRecoveryPasswordDialog';
import { InviteContactsDialog } from './InviteContactsDialog';
import { AddModeratorsDialog } from './ModeratorsAddDialog';
import { RemoveModeratorsDialog } from './ModeratorsRemoveDialog';
import { OnionPathModal } from './OnionStatusPathDialog';
import { ReactClearAllModal } from './ReactClearAllModal';
import { ReactListModal } from './ReactListModal';
import { SessionNicknameDialog } from './SessionNicknameDialog';
import { UpdateGroupMembersDialog } from './UpdateGroupMembersDialog';
import { UpdateConversationDetailsDialog } from './UpdateConversationDetailsDialog';
import { UserProfileModal } from './UserProfileModal';
import { OpenUrlModal } from './OpenUrlModal';
import { BlockOrUnblockDialog } from './blockOrUnblock/BlockOrUnblockDialog';
import { UpdateGroupPermissionsDialog } from './UpdateGroupPermissionsDialog';
import { DebugMenuModal } from './debug/DebugMenuModal';
import { ConversationSettingsDialog } from './conversationSettings/conversationSettingsDialog';
import { SessionConfirm } from './SessionConfirm';
import { SessionProInfoModal } from './SessionProInfoModal';
import { LocalizedPopupDialog } from './LocalizedPopupDialog';
import { UserSettingsDialog } from './user-settings/UserSettingsDialog';

export const ModalContainer = () => {
  const confirmModalState = useConfirmModal();
  const inviteModalState = useInviteContactModal();
  const addModeratorsModalState = useAddModeratorsModal();
  const removeModeratorsModalState = useRemoveModeratorsModal();
  const updateGroupMembersModalState = useUpdateGroupMembersModal();
  const updateGroupPermissionsModalState = useUpdateGroupPermissionsModalState();
  const updateConversationDetailsModalState = useUpdateConversationDetailsModal();
  const userProfileModalState = useUserProfileModal();
  const changeNicknameModal = useChangeNickNameDialog();
  const userSettingsModalState = useUserSettingsModal();
  const onionPathModalState = useOnionPathDialog();
  const enterPasswordModalState = useEnterPasswordModal();
  const deleteAccountModalState = useDeleteAccountModal();
  const banOrUnbanUserModalState = useBanOrUnbanUserModal();
  const serverBanOrUnbanUserModalState = useServerBanOrUnbanUserModalState();
  const blockOrUnblockModalState = useBlockOrUnblockUserModal();
  const reactListModalState = useReactListDialog();
  const reactClearAllModalState = useReactClearAllDialog();
  const editProfilePictureModalState = useEditProfilePictureModal();
  const hideRecoveryPasswordModalState = useHideRecoveryPasswordModal();
  const openUrlModalState = useOpenUrlModal();
  const localizedPopupDialogState = useLocalizedPopupDialog();
  const sessionProInfoState = useSessionProInfoModal();
  const lightBoxOptions = useLightBoxOptions();
  const debugMenuModalState = useDebugMenuModal();
  const conversationSettingsModalState = useConversationSettingsModal();

  // NOTE the order of the modals is important for the z-index
  return (
    <>
      {/* Screens */}
      {userSettingsModalState && <UserSettingsDialog {...userSettingsModalState} />}
      {conversationSettingsModalState && (
        <ConversationSettingsDialog {...conversationSettingsModalState} />
      )}
      {onionPathModalState && <OnionPathModal {...onionPathModalState} />}
      {reactListModalState && <ReactListModal {...reactListModalState} />}
      {debugMenuModalState && <DebugMenuModal {...debugMenuModalState} />}
      {/* Actions */}
      {banOrUnbanUserModalState && <BanOrUnBanUserDialog {...banOrUnbanUserModalState} />}
      {serverBanOrUnbanUserModalState && (
        <ServerBanOrUnBanUserDialog {...serverBanOrUnbanUserModalState} />
      )}
      {blockOrUnblockModalState && <BlockOrUnblockDialog {...blockOrUnblockModalState} />}
      {inviteModalState && <InviteContactsDialog {...inviteModalState} />}
      {addModeratorsModalState && <AddModeratorsDialog {...addModeratorsModalState} />}
      {removeModeratorsModalState && <RemoveModeratorsDialog {...removeModeratorsModalState} />}
      {updateGroupMembersModalState && (
        <UpdateGroupMembersDialog {...updateGroupMembersModalState} />
      )}
      {updateGroupPermissionsModalState && (
        <UpdateGroupPermissionsDialog {...updateGroupPermissionsModalState} />
      )}
      {updateConversationDetailsModalState && (
        <UpdateConversationDetailsDialog {...updateConversationDetailsModalState} />
      )}
      {userProfileModalState && <UserProfileModal {...userProfileModalState} />}
      {changeNicknameModal && <SessionNicknameDialog {...changeNicknameModal} />}
      {enterPasswordModalState && <EnterPasswordModal {...enterPasswordModalState} />}
      {deleteAccountModalState && <DeleteAccountModal {...deleteAccountModalState} />}
      {reactClearAllModalState && <ReactClearAllModal {...reactClearAllModalState} />}
      {editProfilePictureModalState && (
        <EditProfilePictureModal {...editProfilePictureModalState} />
      )}
      {hideRecoveryPasswordModalState && (
        <HideRecoveryPasswordDialog {...hideRecoveryPasswordModalState} />
      )}
      {localizedPopupDialogState && <LocalizedPopupDialog {...localizedPopupDialogState} />}
      {lightBoxOptions && <LightboxGallery {...lightBoxOptions} />}
      {openUrlModalState && <OpenUrlModal {...openUrlModalState} />}
      {sessionProInfoState && <SessionProInfoModal {...sessionProInfoState} />}
      {/* Should be on top of all other modals */}
      {confirmModalState && <SessionConfirm {...confirmModalState} />}
    </>
  );
};
