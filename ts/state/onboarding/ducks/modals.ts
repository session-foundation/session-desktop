import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { TermsOfServicePrivacyDialogProps } from '../../../components/dialog/TermsOfServicePrivacyDialog';
import { ConfirmModalState, type OpenUrlModalState } from '../../ducks/modalDialog';

export type TermsOfServicePrivacyModalState = TermsOfServicePrivacyDialogProps | null;

export type ModalsState = {
  quitModalState: ConfirmModalState | null;
  termsOfServicePrivacyModalState: TermsOfServicePrivacyModalState | null;
  openUrlModal: OpenUrlModalState;
};

const initialState: ModalsState = {
  quitModalState: null,
  termsOfServicePrivacyModalState: null,
  openUrlModal: null,
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
  },
});

export const { updateQuitModal, updateTermsOfServicePrivacyModal } = modalsSlice.actions;
export default modalsSlice.reducer;
