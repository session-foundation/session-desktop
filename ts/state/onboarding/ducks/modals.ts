import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { TermsOfServicePrivacyDialogProps } from '../../../components/dialog/TermsOfServicePrivacyDialog';
import { type OpenUrlModalState } from '../../ducks/modalDialog';
import type { SessionConfirmDialogProps } from '../../../components/dialog/SessionConfirm';

export type TermsOfServicePrivacyModalState = TermsOfServicePrivacyDialogProps | null;

export type QuitModalProps = Required<
  Pick<SessionConfirmDialogProps, 'onClickOk' | 'onClickCancel' | 'i18nMessage'>
>;

export type QuitModalState = QuitModalProps | null;

export type ModalsState = {
  quitModalState: QuitModalState;
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
    updateQuitModal(state, action: PayloadAction<QuitModalState>) {
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
