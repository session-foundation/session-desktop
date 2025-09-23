import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { BlockOrUnblockModalState } from '../../components/dialog/blockOrUnblock/BlockOrUnblockModalState';
import { EnterPasswordModalProps } from '../../components/dialog/EnterPasswordModal';
import { HideRecoveryPasswordDialogProps } from '../../components/dialog/HideRecoveryPasswordDialog';
import { SessionConfirmDialogProps } from '../../components/dialog/SessionConfirm';
import { MediaItemType } from '../../components/lightbox/LightboxGallery';
import { AttachmentTypeWithPath } from '../../types/Attachment';
import type { EditProfilePictureModalProps, PasswordAction } from '../../types/ReduxTypes';
import { WithConvoId } from '../../session/types/with';
import type { SessionProInfoVariant } from '../../components/dialog/SessionProInfoModal';
import type { TrArgs } from '../../localization/localeTools';

export type BanType = 'ban' | 'unban';

export type UserSettingsPage =
  | 'default'
  | 'privacy'
  | 'notifications'
  | 'conversations'
  | 'message-requests'
  | 'appearance'
  | 'recovery-password'
  | 'help'
  | 'blocked-contacts'
  | 'clear-data'
  | 'password'
  | 'preferences'
  | 'network'
  | 'pro';

export type WithUserSettingsPage =
  | { userSettingsPage: Exclude<UserSettingsPage, 'password'> }
  | {
      userSettingsPage: 'password';
      passwordAction: PasswordAction;
    };

export type ConfirmModalState = SessionConfirmDialogProps | null;

export type InviteContactModalState = WithConvoId | null;
export type BanOrUnbanUserModalState =
  | (WithConvoId & {
      banType: BanType;
      pubkey?: string;
    })
  | null;
export type AddModeratorsModalState = InviteContactModalState;
export type RemoveModeratorsModalState = InviteContactModalState;
export type UpdateGroupMembersModalState = InviteContactModalState;
type UpdateConversationDetailsModalState = WithConvoId | null;
export type ChangeNickNameModalState = InviteContactModalState;
export type UserSettingsModalState = WithUserSettingsPage | null;
export type OnionPathModalState = object | null;
export type EnterPasswordModalState = EnterPasswordModalProps | null;
export type DeleteAccountModalState = object | null;
export type OpenUrlModalState = { urlToOpen: string } | null;
export type LocalizedPopupDialogState = {
  title: TrArgs;
  description: TrArgs;
} | null;
export type SessionProInfoState = { variant: SessionProInfoVariant } | null;

export type UserProfileModalState = {
  /** this can be blinded or not */
  conversationId: string;
  /** if conversationId is blinded, and we know the real corresponding sessionID, this is it. */
  realSessionId: string | null;
} | null;

export type ReactModalsState = {
  reaction: string;
  messageId: string;
} | null;

export type EditProfilePictureModalState = EditProfilePictureModalProps | null;

export type HideRecoveryPasswordModalState = HideRecoveryPasswordDialogProps | null;

export type LightBoxOptions = {
  media: Array<MediaItemType>;
  attachment: AttachmentTypeWithPath;
  selectedIndex?: number;
  onClose?: () => void;
} | null;

export type DebugMenuModalState = object | null;

export type ConversationSettingsModalPage = 'default' | 'disappearing_message' | 'notifications';
type SettingsPageThatCannotBeStandalone = Extract<ConversationSettingsModalPage, 'default'>;
type SettingsPageThatCanBeStandalone = Exclude<ConversationSettingsModalPage, 'default'>;

export type ConversationSettingsPage =
  | { settingsModalPage: SettingsPageThatCannotBeStandalone }
  | {
      settingsModalPage: SettingsPageThatCanBeStandalone;
      standalonePage: boolean;
    };
export type ConversationSettingsModalState = (WithConvoId & ConversationSettingsPage) | null;

export type ModalId =
  | 'confirmModal'
  | 'inviteContactModal'
  | 'banOrUnbanUserModal'
  | 'blockOrUnblockModal'
  | 'removeModeratorsModal'
  | 'addModeratorsModal'
  | 'updateConversationDetailsModal'
  | 'groupMembersModal'
  | 'userProfileModal'
  | 'nickNameModal'
  | 'userSettingsModal'
  | 'onionPathModal'
  | 'enterPasswordModal'
  | 'deleteAccountModal'
  | 'reactListModal'
  | 'reactClearAllModal'
  | 'editProfilePictureModal'
  | 'hideRecoveryPasswordModal'
  | 'openUrlModal'
  | 'localizedPopupDialog'
  | 'sessionProInfoModal'
  | 'lightBoxOptions'
  | 'debugMenuModal'
  | 'conversationSettingsModal';

export type ModalState = {
  confirmModal: ConfirmModalState;
  inviteContactModal: InviteContactModalState;
  banOrUnbanUserModal: BanOrUnbanUserModalState;
  blockOrUnblockModal: BlockOrUnblockModalState;
  removeModeratorsModal: RemoveModeratorsModalState;
  addModeratorsModal: AddModeratorsModalState;
  updateConversationDetailsModal: UpdateConversationDetailsModalState;
  groupMembersModal: UpdateGroupMembersModalState;
  userProfileModal: UserProfileModalState;
  nickNameModal: ChangeNickNameModalState;
  userSettingsModal: UserSettingsModalState;
  onionPathModal: OnionPathModalState;
  enterPasswordModal: EnterPasswordModalState;
  deleteAccountModal: DeleteAccountModalState;
  reactListModal: ReactModalsState;
  reactClearAllModal: ReactModalsState;
  editProfilePictureModal: EditProfilePictureModalState;
  hideRecoveryPasswordModal: HideRecoveryPasswordModalState;
  openUrlModal: OpenUrlModalState;
  localizedPopupDialog: LocalizedPopupDialogState;
  sessionProInfoModal: SessionProInfoState;
  lightBoxOptions: LightBoxOptions;
  debugMenuModal: DebugMenuModalState;
  conversationSettingsModal: ConversationSettingsModalState;
  modalStack: Array<ModalId>;
};

export const initialModalState: ModalState = {
  modalStack: [],
  confirmModal: null,
  inviteContactModal: null,
  addModeratorsModal: null,
  removeModeratorsModal: null,
  banOrUnbanUserModal: null,
  blockOrUnblockModal: null,
  updateConversationDetailsModal: null,
  groupMembersModal: null,
  userProfileModal: null,
  nickNameModal: null,
  userSettingsModal: { userSettingsPage: 'pro' },
  onionPathModal: null,
  enterPasswordModal: null,
  deleteAccountModal: null,
  reactListModal: null,
  reactClearAllModal: null,
  editProfilePictureModal: null,
  hideRecoveryPasswordModal: null,
  openUrlModal: null,
  localizedPopupDialog: null,
  sessionProInfoModal: null,
  lightBoxOptions: null,
  debugMenuModal: null,
  conversationSettingsModal: null,
};

function pushModal<T extends ModalId>(
  state: ModalState,
  modalId: T,
  thatModalState: ModalState[T]
) {
  state[modalId] = thatModalState;
  state.modalStack.push(modalId);

  return state;
}

function popModal(state: ModalState, modalId: ModalId) {
  state[modalId] = null;
  state.modalStack = state.modalStack.filter(m => m !== modalId);

  return state;
}

function pushOrPopModal<T extends ModalId>(
  state: ModalState,
  modalId: T,
  thatModalState: ModalState[T]
) {
  const modalStack = state.modalStack;
  if (thatModalState === null) {
    // consider that this is a pop of that corresponding modal id
    return popModal(state, modalId);
  }
  // if the modal is already on the stack, do nothing
  if (modalStack.includes(modalId)) {
    state[modalId] = thatModalState;
    return state;
  }
  return pushModal(state, modalId, thatModalState);
}

const ModalSlice = createSlice({
  name: 'modals',
  initialState: initialModalState,
  reducers: {
    updateConfirmModal(state, action: PayloadAction<ConfirmModalState | null>) {
      return pushOrPopModal(state, 'confirmModal', action.payload);
    },
    updateInviteContactModal(state, action: PayloadAction<InviteContactModalState | null>) {
      return pushOrPopModal(state, 'inviteContactModal', action.payload);
    },
    updateBanOrUnbanUserModal(state, action: PayloadAction<BanOrUnbanUserModalState | null>) {
      return pushOrPopModal(state, 'banOrUnbanUserModal', action.payload);
    },
    updateBlockOrUnblockModal(state, action: PayloadAction<BlockOrUnblockModalState | null>) {
      return pushOrPopModal(state, 'blockOrUnblockModal', action.payload);
    },
    updateAddModeratorsModal(state, action: PayloadAction<AddModeratorsModalState | null>) {
      return pushOrPopModal(state, 'addModeratorsModal', action.payload);
    },
    updateRemoveModeratorsModal(state, action: PayloadAction<RemoveModeratorsModalState | null>) {
      return pushOrPopModal(state, 'removeModeratorsModal', action.payload);
    },
    updateConversationDetailsModal(
      state,
      action: PayloadAction<UpdateConversationDetailsModalState | null>
    ) {
      return pushOrPopModal(state, 'updateConversationDetailsModal', action.payload);
    },
    updateGroupMembersModal(state, action: PayloadAction<UpdateGroupMembersModalState | null>) {
      return pushOrPopModal(state, 'groupMembersModal', action.payload);
    },
    updateUserProfileModal(state, action: PayloadAction<UserProfileModalState | null>) {
      return pushOrPopModal(state, 'userProfileModal', action.payload);
    },
    changeNickNameModal(state, action: PayloadAction<ChangeNickNameModalState | null>) {
      return pushOrPopModal(state, 'nickNameModal', action.payload);
    },
    userSettingsModal(state, action: PayloadAction<UserSettingsModalState | null>) {
      return pushOrPopModal(state, 'userSettingsModal', action.payload);
    },
    onionPathModal(state, action: PayloadAction<OnionPathModalState | null>) {
      return pushOrPopModal(state, 'onionPathModal', action.payload);
    },
    updateEnterPasswordModal(state, action: PayloadAction<EnterPasswordModalState | null>) {
      return pushOrPopModal(state, 'enterPasswordModal', action.payload);
    },
    updateDeleteAccountModal(state, action: PayloadAction<DeleteAccountModalState>) {
      return pushOrPopModal(state, 'deleteAccountModal', action.payload);
    },
    updateReactListModal(state, action: PayloadAction<ReactModalsState>) {
      return pushOrPopModal(state, 'reactListModal', action.payload);
    },
    updateReactClearAllModal(state, action: PayloadAction<ReactModalsState>) {
      return pushOrPopModal(state, 'reactClearAllModal', action.payload);
    },
    updateEditProfilePictureModal(state, action: PayloadAction<EditProfilePictureModalState>) {
      return pushOrPopModal(state, 'editProfilePictureModal', action.payload);
    },
    updateHideRecoveryPasswordModal(state, action: PayloadAction<HideRecoveryPasswordModalState>) {
      return pushOrPopModal(state, 'hideRecoveryPasswordModal', action.payload);
    },
    updateOpenUrlModal(state, action: PayloadAction<OpenUrlModalState>) {
      return pushOrPopModal(state, 'openUrlModal', action.payload);
    },
    updateLocalizedPopupDialog(state, action: PayloadAction<LocalizedPopupDialogState>) {
      return pushOrPopModal(state, 'localizedPopupDialog', action.payload);
    },
    updateSessionProInfoModal(state, action: PayloadAction<SessionProInfoState>) {
      return pushOrPopModal(state, 'sessionProInfoModal', action.payload);
    },
    updateLightBoxOptions(state, action: PayloadAction<LightBoxOptions>) {
      const lightBoxOptions = action.payload;

      if (lightBoxOptions) {
        const { media, attachment } = lightBoxOptions;

        if (attachment && media) {
          const selectedIndex =
            media.length > 1
              ? media.findIndex(mediaMessage => mediaMessage.attachment.path === attachment.path)
              : 0;
          lightBoxOptions.selectedIndex = selectedIndex;
        }
      }
      return pushOrPopModal(state, 'lightBoxOptions', lightBoxOptions);
    },
    updateDebugMenuModal(state, action: PayloadAction<DebugMenuModalState>) {
      return pushOrPopModal(state, 'debugMenuModal', action.payload);
    },
    updateConversationSettingsModal(state, action: PayloadAction<ConversationSettingsModalState>) {
      return pushOrPopModal(state, 'conversationSettingsModal', action.payload);
    },
  },
});

export const { actions, reducer } = ModalSlice;
export const {
  updateConfirmModal,
  updateInviteContactModal,
  updateAddModeratorsModal,
  updateRemoveModeratorsModal,
  updateConversationDetailsModal,
  updateGroupMembersModal,
  updateUserProfileModal,
  changeNickNameModal,
  userSettingsModal,
  onionPathModal,
  updateEnterPasswordModal,
  updateDeleteAccountModal,
  updateBanOrUnbanUserModal,
  updateBlockOrUnblockModal,
  updateReactListModal,
  updateReactClearAllModal,
  updateEditProfilePictureModal,
  updateHideRecoveryPasswordModal,
  updateOpenUrlModal,
  updateLocalizedPopupDialog,
  updateSessionProInfoModal,
  updateLightBoxOptions,
  updateDebugMenuModal,
  updateConversationSettingsModal,
} = actions;
export const modalReducer = reducer;
