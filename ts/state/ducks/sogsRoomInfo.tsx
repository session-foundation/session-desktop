import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { isFinite, sortBy, uniq, xor } from 'lodash';
import { ConvoHub } from '../../session/conversations';
import { urlToBlob } from '../../types/attachments/VisualAttachment';
import { OpenGroupData } from '../../data/opengroups';
import { downloadAttachmentSogsV3 } from '../../receiver/attachments';
import { uploadImageForRoomSogsV3 } from '../../session/apis/open_group_api/sogsv3/sogsV3RoomImage';
import { MIME } from '../../types';
import { processNewAttachment } from '../../types/MessageAttachment';

type RoomInfo = {
  canWrite: boolean;
  subscriberCount: number;
  moderators: Array<string>;
  uploadingNewAvatar: boolean;
  roomDescription: string;
};

export type SogsRoomInfoState = {
  rooms: Record<string, RoomInfo>;
};

export const initialSogsRoomInfoState: SogsRoomInfoState = {
  rooms: {},
};

function addEmptyEntryIfNeeded(state: any, convoId: string) {
  if (!state.rooms[convoId]) {
    state.rooms[convoId] = {
      canWrite: true,
      subscriberCount: 0,
      moderators: [],
      uploadingNewAvatar: false,
      roomDescription: '',
    };
  }
}
/**
 * This function is only called when the local user makes a change to a community.
 * It can be used to upload and assign the avatar to a room.
 * Note: pysogs do not removing the avatar from the room, only overwriting it with something else
 */
const changeCommunityAvatar = createAsyncThunk(
  'sogs/changeCommunityAvatar',
  async ({
    avatarObjectUrl,
    conversationId,
  }: {
    conversationId: string;
    avatarObjectUrl: string;
  }) => {
    const convo = ConvoHub.use().get(conversationId);

    if (!convo?.isPublic()) {
      throw new Error('changeCommunityAvatar can only be used for communities');
    }
    const blobAvatarAlreadyScaled = await urlToBlob(avatarObjectUrl);

    const dataResized = await blobAvatarAlreadyScaled.arrayBuffer();
    const roomInfos = OpenGroupData.getV2OpenGroupRoom(convo.id);
    if (!roomInfos || !dataResized.byteLength) {
      return false;
    }
    const uploadedFileDetails = await uploadImageForRoomSogsV3(
      new Uint8Array(dataResized),
      roomInfos
    );

    if (!uploadedFileDetails || !uploadedFileDetails.fileUrl) {
      window?.log?.warn('File upload for community failed');
      return false;
    }
    const { fileId: avatarImageId, fileUrl } = uploadedFileDetails;

    // this is kind of a hack just made to avoid having a specific function downloading from sogs by URL rather than fileID
    const downloaded = await downloadAttachmentSogsV3(
      { id: avatarImageId, size: null, url: fileUrl },
      roomInfos
    );

    if (!downloaded || !(downloaded.data instanceof ArrayBuffer)) {
      const typeFound = typeof downloaded;
      throw new Error(`Expected a plain ArrayBuffer but got ${typeFound}`);
    }
    const data = downloaded.data;
    if (!downloaded.data?.byteLength) {
      window?.log?.error('Failed to download attachment. Length is 0');
      throw new Error(
        `Failed to download attachment. Length is 0 for ${uploadedFileDetails.fileUrl}`
      );
    }

    const upgraded = await processNewAttachment({
      data,
      isRaw: true,
      contentType: MIME.IMAGE_UNKNOWN, // contentType is mostly used to generate previews and screenshot. We do not care for those in this case.
    });
    await convo.setSessionProfile({
      displayName: null, // null so we don't overwrite it
      avatarPath: upgraded.path,
      avatarImageId,
    });
    return true;
  }
);

/**
 * This slice is the one holding the memory-only infos of sogs room. This includes
 * - writeCapability
 * - subscriberCount
 * - moderators
 *
 * Note: moderators are almost never used for sogs. We mostly rely on admins, which are tracked through the conversationModel.groupAdmins attributes (and saved to DB)
 */
const sogsRoomInfosSlice = createSlice({
  name: 'sogsRoomInfos',
  initialState: initialSogsRoomInfoState,
  reducers: {
    setSubscriberCount(state, action: PayloadAction<{ convoId: string; subscriberCount: number }>) {
      addEmptyEntryIfNeeded(state, action.payload.convoId);
      if (isFinite(action.payload.subscriberCount)) {
        state.rooms[action.payload.convoId].subscriberCount = action.payload.subscriberCount;
      }
      return state;
    },
    setCanWrite(state, action: PayloadAction<{ convoId: string; canWrite: boolean }>) {
      addEmptyEntryIfNeeded(state, action.payload.convoId);
      state.rooms[action.payload.convoId].canWrite = !!action.payload.canWrite;

      return state;
    },
    setModerators(state, action: PayloadAction<{ convoId: string; moderators: Array<string> }>) {
      addEmptyEntryIfNeeded(state, action.payload.convoId);
      const existing = state.rooms[action.payload.convoId].moderators;
      const newMods = sortBy(uniq(action.payload.moderators));

      // check if there is any changes (order excluded) between those two arrays
      const xord = xor(existing, newMods);
      if (!xord.length) {
        return state;
      }

      state.rooms[action.payload.convoId].moderators = newMods;

      return state;
    },
    setRoomDescription(state, action: PayloadAction<{ convoId: string; roomDescription: string }>) {
      addEmptyEntryIfNeeded(state, action.payload.convoId);
      state.rooms[action.payload.convoId].roomDescription = action.payload.roomDescription;

      return state;
    },
  },
  extraReducers: builder => {
    builder.addCase(changeCommunityAvatar.fulfilled, (state, action) => {
      const convoId = action.meta.arg.conversationId;
      addEmptyEntryIfNeeded(state, convoId);

      window.log.error('a changeCommunityAvatar was fulfilled with:', action.payload);
      state.rooms[convoId].uploadingNewAvatar = false;

      return state;
    });
    builder.addCase(changeCommunityAvatar.pending, (state, action) => {
      const convoId = action.meta.arg.conversationId;
      addEmptyEntryIfNeeded(state, convoId);

      window.log.error('a changeCommunityAvatar is pending');
      state.rooms[convoId].uploadingNewAvatar = true;
      return state;
    });
    builder.addCase(changeCommunityAvatar.rejected, (state, action) => {
      const convoId = action.meta.arg.conversationId;
      addEmptyEntryIfNeeded(state, convoId);

      window.log.error('a changeCommunityAvatar was rejected with:', action.error);
      state.rooms[convoId].uploadingNewAvatar = true;
      return state;
    });
  },
});

const { actions, reducer } = sogsRoomInfosSlice;
const { setSubscriberCount, setCanWrite, setModerators, setRoomDescription } = actions;

export const ReduxSogsRoomInfos = {
  setSubscriberCountOutsideRedux,
  setCanWriteOutsideRedux,
  setModeratorsOutsideRedux,
  setRoomDescriptionOutsideRedux,
  sogsRoomInfoReducer: reducer,
  changeCommunityAvatar,
};

function setSubscriberCountOutsideRedux(convoId: string, subscriberCount: number) {
  window.inboxStore?.dispatch(setSubscriberCount({ convoId, subscriberCount }));
}

function setCanWriteOutsideRedux(convoId: string, canWrite: boolean) {
  window.inboxStore?.dispatch(setCanWrite({ convoId, canWrite }));
}

/**
 * Update the redux slice for that community's moderators list
 * if we are a moderator that room and the room is blinded, this update needs to contain our unblinded pubkey, NOT the blinded one.
 *
 * @param convoId the convoId of the room to set the moderators
 * @param moderators the updated list of moderators
 */
function setModeratorsOutsideRedux(convoId: string, moderators: Array<string>) {
  window.inboxStore?.dispatch(
    setModerators({
      convoId,
      moderators,
    })
  );
  return undefined;
}

/**
 * Update the redux slice for that community's moderators list
 * if we are a moderator that room and the room is blinded, this update needs to contain our unblinded pubkey, NOT the blinded one.
 *
 * @param convoId the convoId of the room to set the moderators
 * @param moderators the updated list of moderators
 */
function setRoomDescriptionOutsideRedux(convoId: string, roomDescription: string) {
  window.inboxStore?.dispatch(
    setRoomDescription({
      convoId,
      roomDescription,
    })
  );
  return undefined;
}
