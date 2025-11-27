import {
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
import { BanOrUnBanUserDialog } from './BanOrUnbanUserDialog';
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
import { DebugMenuModal } from './debug/DebugMenuModal';
import { ConversationSettingsDialog } from './conversationSettings/conversationSettingsDialog';
import { SessionConfirm } from './SessionConfirm';
import { SessionCTA } from './SessionCTA';
import { LocalizedPopupDialog } from './LocalizedPopupDialog';
import { UserSettingsDialog } from './user-settings/UserSettingsDialog';

export const ModalContainer = () => {
  const confirmModalState = useConfirmModal();
  const inviteModalState = useInviteContactModal();
  const addModeratorsModalState = useAddModeratorsModal();
  const removeModeratorsModalState = useRemoveModeratorsModal();
  const updateGroupMembersModalState = useUpdateGroupMembersModal();
  const updateConversationDetailsModalState = useUpdateConversationDetailsModal();
  const userProfileModalState = useUserProfileModal();
  const changeNicknameModal = useChangeNickNameDialog();
  const userSettingsModalState = useUserSettingsModal();
  const onionPathModalState = useOnionPathDialog();
  const enterPasswordModalState = useEnterPasswordModal();
  const deleteAccountModalState = useDeleteAccountModal();
  const banOrUnbanUserModalState = useBanOrUnbanUserModal();
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
      {/* UserProfileModal and ConversationSettingsDialog need to be behind the settings dialog because they can open the settings dialog */}
      {userProfileModalState && <UserProfileModal {...userProfileModalState} />}
      {conversationSettingsModalState && (
        <ConversationSettingsDialog {...conversationSettingsModalState} />
      )}
      {userSettingsModalState && <UserSettingsDialog {...userSettingsModalState} />}
      {onionPathModalState && <OnionPathModal {...onionPathModalState} />}
      {reactListModalState && <ReactListModal {...reactListModalState} />}
      {debugMenuModalState && <DebugMenuModal {...debugMenuModalState} />}
      {/* Actions */}
      {banOrUnbanUserModalState && <BanOrUnBanUserDialog {...banOrUnbanUserModalState} />}
      {blockOrUnblockModalState && <BlockOrUnblockDialog {...blockOrUnblockModalState} />}
      {inviteModalState && <InviteContactsDialog {...inviteModalState} />}
      {addModeratorsModalState && <AddModeratorsDialog {...addModeratorsModalState} />}
      {removeModeratorsModalState && <RemoveModeratorsDialog {...removeModeratorsModalState} />}
      {updateGroupMembersModalState && (
        <UpdateGroupMembersDialog {...updateGroupMembersModalState} />
      )}
      {updateConversationDetailsModalState && (
        <UpdateConversationDetailsDialog {...updateConversationDetailsModalState} />
      )}
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
      {sessionProInfoState && <SessionCTA {...sessionProInfoState} />}
      {/* Should be on top of all other modals */}
      {confirmModalState && <SessionConfirm {...confirmModalState} />}
    </>
  );
};
