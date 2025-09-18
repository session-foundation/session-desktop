import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { isFinite, sortBy, uniq, xor } from 'lodash';
import { ConvoHub } from '../../session/conversations';
import { urlToBlob } from '../../types/attachments/VisualAttachment';
import { OpenGroupData } from '../../data/opengroups';
import { downloadAttachmentSogsV3 } from '../../receiver/attachments';
import { uploadImageForRoomSogsV3 } from '../../session/apis/open_group_api/sogsv3/sogsV3RoomImage';
import { MIME } from '../../types';
import { processNewAttachment } from '../../types/MessageAttachment';
import { updateConversationDetailsModal, updateEditProfilePictureModal } from './modalDialog';
import { changeRoomDetailsSogsV3 } from '../../session/apis/open_group_api/sogsv3/sogsV3RoomInfosChange';

type RoomInfo = {
  canWrite: boolean;
  subscriberCount: number;
  moderators: Array<string>;
  uploadingNewAvatar: boolean;
  detailsChangePending: boolean;
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
      nameChangePending: false,
      roomDescription: '',
    };
  }
}

const roomDetailsChange = createAsyncThunk(
  'sogs/roomDetailsChange',
  async ({
    conversationId,
    newName,
    newDescription,
  }: {
    conversationId: string;
    newName: string;
    newDescription: string;
  }) => {
    const roomInfos = ConvoHub.use().get(conversationId)?.toOpenGroupV2();
    if (!roomInfos) {
      throw new Error(`roomInfos not found for convo: ${conversationId}`);
    }

    await changeRoomDetailsSogsV3(roomInfos, {
      roomName: newName,
      roomDescription: newDescription,
    });
    window.inboxStore?.dispatch(updateConversationDetailsModal(null));

    return true;
  }
);

const roomAvatarChange = createAsyncThunk(
  'sogs/roomAvatarChange',
  async ({
    conversationId,
    avatarObjectUrl,
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
    const { fileUrl } = uploadedFileDetails;

    // this is kind of a hack just made to avoid having a specific function downloading from sogs by URL rather than fileID
    const downloaded = await downloadAttachmentSogsV3({ size: null, url: fileUrl }, roomInfos);

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
      type: 'setAvatarDownloadedCommunity',
      profileKey: new Uint8Array(), // communities avatar don't have a profile key
      displayName: null, // null so we don't overwrite it
      avatarPath: upgraded.path,
      avatarPointer: fileUrl,
      fallbackAvatarPath: upgraded.path, // no need for a fallback for a community
    });

    window.inboxStore?.dispatch(updateEditProfilePictureModal(null));

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
      const diff = xor(existing, newMods);
      if (!diff.length) {
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
    builder.addCase(roomAvatarChange.fulfilled, (state, action) => {
      const convoId = action.meta.arg.conversationId;
      addEmptyEntryIfNeeded(state, convoId);

      window.log.debug('a roomAvatarChange was fulfilled with:', action.payload);
      state.rooms[convoId].uploadingNewAvatar = false;

      return state;
    });
    builder.addCase(roomAvatarChange.pending, (state, action) => {
      const convoId = action.meta.arg.conversationId;
      addEmptyEntryIfNeeded(state, convoId);

      window.log.debug('a roomAvatarChange is pending');
      state.rooms[convoId].uploadingNewAvatar = true;
      return state;
    });
    builder.addCase(roomAvatarChange.rejected, (state, action) => {
      const convoId = action.meta.arg.conversationId;
      addEmptyEntryIfNeeded(state, convoId);

      window.log.warn('a roomAvatarChange was rejected with:', action.error);
      state.rooms[convoId].uploadingNewAvatar = false;
      return state;
    });
    builder.addCase(roomDetailsChange.fulfilled, (state, action) => {
      const convoId = action.meta.arg.conversationId;
      addEmptyEntryIfNeeded(state, convoId);

      window.log.debug('a roomDetailsChange was fulfilled with:', action.payload);
      state.rooms[convoId].detailsChangePending = false;

      return state;
    });
    builder.addCase(roomDetailsChange.pending, (state, action) => {
      const convoId = action.meta.arg.conversationId;
      addEmptyEntryIfNeeded(state, convoId);

      window.log.debug('a roomDetailsChange is pending');
      state.rooms[convoId].detailsChangePending = true;
      return state;
    });
    builder.addCase(roomDetailsChange.rejected, (state, action) => {
      const convoId = action.meta.arg.conversationId;
      addEmptyEntryIfNeeded(state, convoId);

      window.log.warn('a roomDetailsChange was rejected with:', action.error);
      state.rooms[convoId].detailsChangePending = false;
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
  roomAvatarChange,
  roomDetailsChange,
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
