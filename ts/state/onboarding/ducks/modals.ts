import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { TermsOfServicePrivacyDialogProps } from '../../../components/dialog/TermsOfServicePrivacyDialog';
import {
  ConfirmModalState,
  type SessionProInfoState,
  type OpenUrlModalState,
  type LocalizedPopupDialogState,
} from '../../ducks/modalDialog';

export type TermsOfServicePrivacyModalState = TermsOfServicePrivacyDialogProps | null;

export type ModalsState = {
  quitModalState: ConfirmModalState;
  termsOfServicePrivacyModalState: TermsOfServicePrivacyModalState;
  openUrlModal: OpenUrlModalState;
  localizedPopupDialog: LocalizedPopupDialogState;
  sessionProInfoModal: SessionProInfoState;
};

const initialState: ModalsState = {
  quitModalState: null,
  termsOfServicePrivacyModalState: null,
  openUrlModal: null,
  localizedPopupDialog: null,
  sessionProInfoModal: null,
};

export const modalsSlice = createSlice({
  name: 'modals',
  initialState,
  reducers: {
    updateQuitModal(state, action: PayloadAction<ConfirmModalState>) {
      return { ...state, quitModalState: action.payload };
    },
    updateTermsOfServicePrivacyModal(
      state,
      action: PayloadAction<TermsOfServicePrivacyModalState>
    ) {
      return { ...state, termsOfServicePrivacyModalState: action.payload };
    },
    updateOpenUrlModal(state, action: PayloadAction<OpenUrlModalState>) {
      return { ...state, openUrlModal: action.payload };
    },
    updateLocalizedPopupDialogModal(state, action: PayloadAction<LocalizedPopupDialogState>) {
      return { ...state, localizedPopupDialog: action.payload };
    },
    updateSessionProInfoModal(state, action: PayloadAction<SessionProInfoState>) {
      return { ...state, sessionProInfoModal: action.payload };
    },
  },
});

export const { updateQuitModal, updateTermsOfServicePrivacyModal } = modalsSlice.actions;
export default modalsSlice.reducer;
