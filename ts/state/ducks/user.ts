import { isNil } from 'lodash';
import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { ConvoHub } from '../../session/conversations';
import { SyncUtils, UserUtils } from '../../session/utils';
import { getSodiumRenderer } from '../../session/crypto';
import { uploadAndSetOurAvatarShared } from '../../interactions/avatar-interactions/nts-avatar-interactions';
import { ed25519Str } from '../../session/utils/String';

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

const clearOurAvatar = createAsyncThunk('user/clearOurAvatar', async () => {
  const us = UserUtils.getOurPubKeyStrFromCache();
  if (!us) {
    window.log.warn('user/clearOurAvatar: invalid conversationId provided: ');
    throw new Error('user/clearOurAvatar: invalid conversationId provided');
  }
  const convo = ConvoHub.use().get(us);
  if (!convo) {
    window.log.warn(
      `clearOurAvatar: convo ${ed25519Str(us)} not found... This is not a valid case`
    );
    return;
  }

  // return early if no change are needed at all
  if (
    isNil(convo.get('avatarPointer')) &&
    isNil(convo.get('avatarInProfile')) &&
    isNil(convo.get('profileKey'))
  ) {
    return;
  }

  convo.setKey('avatarPointer', undefined);
  convo.setKey('avatarInProfile', undefined);
  convo.setKey('profileKey', undefined);

  await convo.commit();
  await SyncUtils.forceSyncConfigurationNowIfNeeded(true);
});

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
    builder.addCase(clearOurAvatar.fulfilled, (state, action) => {
      window.log.error('a clearOurAvatar was fulfilled with:', action.payload);

      state.uploadingNewAvatarCurrentUser = false;
      return state;
    });
    builder.addCase(clearOurAvatar.rejected, (state, action) => {
      window.log.error('a clearOurAvatar was rejected', action.error);
      state.uploadingNewAvatarCurrentUser = false;
      return state;
    });
    builder.addCase(clearOurAvatar.pending, (state, _action) => {
      state.uploadingNewAvatarCurrentUser = true;

      window.log.debug('a clearOurAvatar is pending');
      return state;
    });
  },
});

export const userActions = {
  ...userSlice.actions,
  updateOurAvatar,
  clearOurAvatar,
};

export const userReducer = userSlice.reducer;
