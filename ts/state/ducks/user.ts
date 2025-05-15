import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { ConvoHub } from '../../session/conversations';
import { UserUtils } from '../../session/utils';
import { getSodiumRenderer } from '../../session/crypto';
import { uploadAndSetOurAvatarShared } from '../../interactions/avatar-interactions/nts-avatar-interactions';

export type UserStateType = {
  ourDisplayNameInProfile: string;
  ourNumber: string;
  uploadingNewAvatarCurrentUser: boolean;
};

export const initialUserState: UserStateType = {
  ourDisplayNameInProfile: '',
  ourNumber: 'missing',
  uploadingNewAvatarCurrentUser: false,
};

/**
 * updateOurAvatar is called when the user is, from the current device, changing his avatar.
 * Note: auto reupload is not done here, as we do not need a UI for it.
 *
 */
const updateOurAvatar = createAsyncThunk(
  'user/updateOurAvatar',
  async ({ newAvatarDecrypted }: { newAvatarDecrypted: ArrayBuffer }) => {
    const ourConvo = ConvoHub.use().get(UserUtils.getOurPubKeyStrFromCache());
    if (!ourConvo) {
      window.log.warn('ourConvo not found... This is not a valid case');
      return null;
    }

    const sodium = await getSodiumRenderer();
    // Uploading a new avatar, we want to encrypt its data with a new key.
    const profileKey = sodium.randombytes_buf(32);

    return uploadAndSetOurAvatarShared({
      decryptedAvatarData: newAvatarDecrypted,
      ourConvo,
      profileKey,
    });
  }
);

/**
 * This slice is representing the state of our user account.
 * It also contains the loading states of the changes being made to it.
 */
const userSlice = createSlice({
  name: 'userSlice',
  initialState: initialUserState,
  reducers: {
    userChanged(
      state: UserStateType,
      action: PayloadAction<{
        ourDisplayNameInProfile: string;
        ourNumber: string;
      }>
    ) {
      return {
        ...state,
        ...action.payload,
      };
    },
  },
  extraReducers: builder => {
    builder.addCase(updateOurAvatar.fulfilled, (state, action) => {
      window.log.error('a updateOurAvatar was fulfilled with:', action.payload);

      state.uploadingNewAvatarCurrentUser = false;
      return state;
    });
    builder.addCase(updateOurAvatar.rejected, (state, action) => {
      window.log.error('a updateOurAvatar was rejected', action.error);
      state.uploadingNewAvatarCurrentUser = false;
      return state;
    });
    builder.addCase(updateOurAvatar.pending, (state, _action) => {
      state.uploadingNewAvatarCurrentUser = true;

      window.log.debug('a updateOurAvatar is pending');
      return state;
    });
  },
});

export const userActions = {
  ...userSlice.actions,
  updateOurAvatar,
};

export const userReducer = userSlice.reducer;
