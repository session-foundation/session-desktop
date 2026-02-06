import { useSelector } from 'react-redux';

import { ModalState, type ModalId } from '../ducks/modalDialog';
import { StateType } from '../reducer';

const getModal = (state: StateType): ModalState => {
  return state.modals;
};

export function useAnyModalVisible() {
  return useSelector((state: StateType) => state.modals.modalStack.length > 0);
}

export function useConfirmModal() {
  return useSelector((state: StateType) => getModal(state).confirmModal);
}

export function useInviteContactModal() {
  return useSelector((state: StateType) => getModal(state).inviteContactModal);
}

export function useAddModeratorsModal() {
  return useSelector((state: StateType) => getModal(state).addModeratorsModal);
}

export function useRemoveModeratorsModal() {
  return useSelector((state: StateType) => getModal(state).removeModeratorsModal);
}

export function useBlockOrUnblockUserModal() {
  return useSelector((state: StateType) => getModal(state).blockOrUnblockModal);
}

export function useUpdateConversationDetailsModal() {
  return useSelector((state: StateType) => getModal(state).updateConversationDetailsModal);
}

export function useUpdateGroupMembersModal() {
  return useSelector((state: StateType) => getModal(state).groupMembersModal);
}

export function useUserProfileModal() {
  return useSelector((state: StateType) => getModal(state).userProfileModal);
}

export function useChangeNickNameDialog() {
  return useSelector((state: StateType) => getModal(state).nickNameModal);
}

export function useUserSettingsModal() {
  return useSelector((state: StateType) => getModal(state).userSettingsModal);
}

export function useOnionPathDialog() {
  return useSelector((state: StateType) => getModal(state).onionPathModal);
}

export function useEnterPasswordModal() {
  return useSelector((state: StateType) => getModal(state).enterPasswordModal);
}

export function useDeleteAccountModal() {
  return useSelector((state: StateType) => getModal(state).deleteAccountModal);
}

export function useReactListDialog() {
  return useSelector((state: StateType) => getModal(state).reactListModal);
}

export function useReactClearAllDialog() {
  return useSelector((state: StateType) => getModal(state).reactClearAllModal);
}

export function useEditProfilePictureModal() {
  return useSelector((state: StateType) => getModal(state).editProfilePictureModal);
}

export function useHideRecoveryPasswordModal() {
  return useSelector((state: StateType) => getModal(state).hideRecoveryPasswordModal);
}

export function useOpenUrlModal() {
  return useSelector((state: StateType) => getModal(state).openUrlModal);
}

export function useLocalizedPopupDialog() {
  return useSelector((state: StateType) => getModal(state).localizedPopupDialog);
}

export function useSessionProInfoModal() {
  return useSelector((state: StateType) => getModal(state).sessionProInfoModal);
}

export function useLightBoxOptions() {
  return useSelector((state: StateType) => getModal(state).lightBoxOptions);
}

export function useBanOrUnbanUserModal() {
  return useSelector((state: StateType) => getModal(state).banOrUnbanUserModal);
}

export function useDebugMenuModal() {
  return useSelector((state: StateType) => getModal(state).debugMenuModal);
}

export function useKeyboardShortcutsModal() {
  return useSelector((state: StateType) => getModal(state).keyboardShortcutsModal);
}

export function useConversationSettingsModal() {
  return useSelector((state: StateType) => getModal(state).conversationSettingsModal);
}

export function useConversationSettingsModalIsStandalone() {
  const convoSettingsModal = useConversationSettingsModal();

  return (
    (convoSettingsModal?.settingsModalPage !== 'default' && convoSettingsModal?.standalonePage) ||
    false
  );
}

export function useModalStack() {
  return useSelector((state: StateType) => state.modals?.modalStack ?? []); // that [] is needed for the password window
}

export function useIsTopModal(modalId: ModalId) {
  const modalStack = useModalStack();
  return !modalStack?.length || modalStack[modalStack.length - 1] === modalId;
}
