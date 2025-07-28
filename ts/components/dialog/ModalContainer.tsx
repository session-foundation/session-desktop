import { useSelector } from 'react-redux';
import {
  getAddModeratorsModal,
  getBanOrUnbanUserModalState,
  getBlockOrUnblockUserModalState,
  getChangeNickNameDialog,
  getConfirmModal,
  getConversationSettingsModalState,
  getDebugMenuModalState,
  getDeleteAccountModalState,
  getEditProfileDialog,
  getEditProfilePictureModalState,
  getEnterPasswordModalState,
  getHideRecoveryPasswordModalState,
  getInviteContactModal,
  getLightBoxOptions,
  getSessionProInfoModalState,
  getOnionPathDialog,
  getOpenUrlModalState,
  getReactClearAllDialog,
  getReactListDialog,
  getRemoveModeratorsModal,
  getSessionNetworkModalState,
  getSessionPasswordDialog,
  getUpdateGroupMembersModal,
  getUpdateGroupNameModal,
  getUserProfileModal,
  getLocalizedPopupDialogState,
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
import { SessionSetPasswordDialog } from './SessionSetPasswordDialog';
import { UpdateGroupMembersDialog } from './UpdateGroupMembersDialog';
import { UpdateGroupNameDialog } from './UpdateGroupNameDialog';
import { UserProfileModal } from './UserProfileModal';
import { EditProfileDialog } from './edit-profile/EditProfileDialog';
import { OpenUrlModal } from './OpenUrlModal';
import { BlockOrUnblockDialog } from './blockOrUnblock/BlockOrUnblockDialog';
import { DebugMenuModal } from './debug/DebugMenuModal';
import { ConversationSettingsDialog } from './conversationSettings/conversationSettingsDialog';
import { SessionNetworkModal } from './network/SessionNetworkModal';
import { SessionConfirm } from './SessionConfirm';
import { SessionProInfoModal } from './SessionProInfoModal';
import { LocalizedPopupDialog } from './LocalizedPopupDialog';

export const ModalContainer = () => {
  const confirmModalState = useSelector(getConfirmModal);
  const inviteModalState = useSelector(getInviteContactModal);
  const addModeratorsModalState = useSelector(getAddModeratorsModal);
  const removeModeratorsModalState = useSelector(getRemoveModeratorsModal);
  const updateGroupMembersModalState = useSelector(getUpdateGroupMembersModal);
  const updateGroupNameModalState = useSelector(getUpdateGroupNameModal);
  const userProfileModalState = useSelector(getUserProfileModal);
  const changeNicknameModal = useSelector(getChangeNickNameDialog);
  const editProfileModalState = useSelector(getEditProfileDialog);
  const onionPathModalState = useSelector(getOnionPathDialog);
  const enterPasswordModalState = useSelector(getEnterPasswordModalState);
  const sessionPasswordModalState = useSelector(getSessionPasswordDialog);
  const deleteAccountModalState = useSelector(getDeleteAccountModalState);
  const banOrUnbanUserModalState = useSelector(getBanOrUnbanUserModalState);
  const blockOrUnblockModalState = useSelector(getBlockOrUnblockUserModalState);
  const reactListModalState = useSelector(getReactListDialog);
  const reactClearAllModalState = useSelector(getReactClearAllDialog);
  const editProfilePictureModalState = useSelector(getEditProfilePictureModalState);
  const hideRecoveryPasswordModalState = useSelector(getHideRecoveryPasswordModalState);
  const openUrlModalState = useSelector(getOpenUrlModalState);
  const localizedPopupDialogState = useSelector(getLocalizedPopupDialogState);
  const sessionProInfoState = useSelector(getSessionProInfoModalState);
  const lightBoxOptions = useSelector(getLightBoxOptions);
  const debugMenuModalState = useSelector(getDebugMenuModalState);
  const conversationSettingsModalState = useSelector(getConversationSettingsModalState);
  const sessionNetworkModalState = useSelector(getSessionNetworkModalState);

  // NOTE the order of the modals is important for the z-index
  return (
    <>
      {/* Screens */}
      {conversationSettingsModalState && (
        <ConversationSettingsDialog {...conversationSettingsModalState} />
      )}
      {sessionPasswordModalState && <SessionSetPasswordDialog {...sessionPasswordModalState} />}
      {sessionNetworkModalState && <SessionNetworkModal {...sessionNetworkModalState} />}
      {editProfileModalState && <EditProfileDialog {...editProfileModalState} />}
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
      {updateGroupNameModalState && <UpdateGroupNameDialog {...updateGroupNameModalState} />}
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
