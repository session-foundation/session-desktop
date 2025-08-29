import { createSelector } from '@reduxjs/toolkit';
import { useSelector } from 'react-redux';

import { ModalState, type LightBoxOptions } from '../ducks/modalDialog';
import { StateType } from '../reducer';

export const getModal = (state: StateType): ModalState => {
  return state.modals;
};

export const getIsModalVisible = createSelector(getModal, (state: ModalState): boolean => {
  const modalValues = Object.values(state);
  for (let i = 0; i < modalValues.length; i++) {
    if (modalValues[i] !== null) {
      return true;
    }
  }

  return false;
});

export const getConfirmModal = (state: StateType) => getModal(state).confirmModal;

export const getInviteContactModal = (state: StateType) => getModal(state).inviteContactModal;

export const getAddModeratorsModal = (state: StateType) => getModal(state).addModeratorsModal;

export const getRemoveModeratorsModal = (state: StateType) => getModal(state).removeModeratorsModal;

export const getBanOrUnbanUserModalState = (state: StateType) =>
  getModal(state).banOrUnbanUserModal;

export const getBlockOrUnblockUserModalState = (state: StateType) =>
  getModal(state).blockOrUnblockModal;

export const getUpdateConversationDetailsModal = (state: StateType) =>
  getModal(state).updateConversationDetailsModal;

export const getUpdateGroupMembersModal = (state: StateType) => getModal(state).groupMembersModal;

export const getUserProfileModal = (state: StateType) => getModal(state).userProfileModal;

export const getChangeNickNameDialog = (state: StateType) => getModal(state).nickNameModal;

export const getUserSettingsModal = (state: StateType) => getModal(state).userSettingsModal;

export const getOnionPathDialog = (state: StateType) => getModal(state).onionPathModal;

export const getEnterPasswordModalState = (state: StateType) => getModal(state).enterPasswordModal;

export const getDeleteAccountModalState = (state: StateType) => getModal(state).deleteAccountModal;

export const getReactListDialog = (state: StateType) => getModal(state).reactListModalState;

export const getReactClearAllDialog = (state: StateType) => getModal(state).reactClearAllModalState;

export const getEditProfilePictureModalState = (state: StateType) =>
  getModal(state).editProfilePictureModalState;

export const getHideRecoveryPasswordModalState = (state: StateType) =>
  getModal(state).hideRecoveryPasswordModalState;

export const getOpenUrlModalState = (state: StateType) => getModal(state).openUrlModal;

export const getLocalizedPopupDialogState = (state: StateType) =>
  getModal(state).localizedPopupDialog;

export const getSessionProInfoModalState = (state: StateType) =>
  getModal(state).sessionProInfoModal;

export const getLightBoxOptions = createSelector(
  getModal,
  (state: ModalState): LightBoxOptions => state.lightBoxOptions
);

export const getDebugMenuModalState = (state: StateType) => getModal(state).debugMenuModal;

export const getConversationSettingsModalState = (state: StateType) =>
  getModal(state).conversationSettingsModal;

const getConversationSettingsModalIsStandalone = (state: StateType) => {
  const convoSettingsModal = getConversationSettingsModalState(state);

  return (
    (convoSettingsModal?.settingsModalPage !== 'default' && convoSettingsModal?.standalonePage) ||
    false
  );
};

export const useConversationSettingsModalIsStandalone = () => {
  return useSelector(getConversationSettingsModalIsStandalone);
};
