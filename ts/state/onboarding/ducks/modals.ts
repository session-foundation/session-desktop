import { PayloadAction, createSlice } from '@reduxjs/toolkit';
import { TermsOfServicePrivacyDialogProps } from '../../../components/dialog/TermsOfServicePrivacyDialog';
import type { SessionConfirmDialogProps } from '../../../components/dialog/SessionConfirm';
import {
  type SessionCTAState,
  type OpenUrlModalState,
  type LocalizedPopupDialogState,
} from '../../ducks/modalDialog';

export type TermsOfServicePrivacyModalState = TermsOfServicePrivacyDialogProps | null;

export type QuitModalProps = Required<
  Pick<SessionConfirmDialogProps, 'onClickOk' | 'onClickCancel' | 'i18nMessage'>
>;

export type QuitModalState = QuitModalProps | null;

export type ModalsState = {
  quitModalState: QuitModalState;
  termsOfServicePrivacyModalState: TermsOfServicePrivacyModalState;
  openUrlModal: OpenUrlModalState;
  localizedPopupDialog: LocalizedPopupDialogState;
  sessionProInfoModal: SessionCTAState;
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
    updateLocalizedPopupDialogModal(state, action: PayloadAction<LocalizedPopupDialogState>) {
      return { ...state, localizedPopupDialog: action.payload };
    },
    updateSessionProInfoModal(state, action: PayloadAction<SessionCTAState>) {
      return { ...state, sessionProInfoModal: action.payload };
    },
  },
});

export const { updateQuitModal, updateTermsOfServicePrivacyModal } = modalsSlice.actions;
export default modalsSlice.reducer;
