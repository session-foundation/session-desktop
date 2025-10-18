import AbortController, { AbortSignal } from 'abort-controller';
import { isFinite, isNil, isNumber, isUndefined, toNumber } from 'lodash';
import { OpenGroupData, OpenGroupV2RoomWithImageID } from '../../../../data/opengroups';
import { MIME } from '../../../../types';
import { processNewAttachment } from '../../../../types/MessageAttachment';
import { roomHasBlindEnabled } from '../../../../types/sqlSharedTypes';
import { callUtilsWorker } from '../../../../webworker/workers/browser/util_worker_interface';
import { ConvoHub } from '../../../conversations';
import { OnionSending } from '../../../onions/onionSend';
import { allowOnlyOneAtATime } from '../../../utils/Promise';
import { OpenGroupPollingUtils } from '../opengroupV2/OpenGroupPollingUtils';
import { getOpenGroupV2ConversationId } from '../utils/OpenGroupUtils';
import { OpenGroupV2Room } from '../../../../data/types';
import { DURATION } from '../../../constants';

function fileDetailsToEndpoint({ fileId, roomId }: { fileId: number | string; roomId: string }) {
  return `/room/${roomId}/file/${fileId}`;
}

export function fileDetailsToURL({
  fileId,
  roomId,
  serverUrl,
}: {
  fileId: number | string;
  roomId: string;
  serverUrl: string;
}) {
  const endpoint = fileDetailsToEndpoint({ fileId, roomId });
  const builtUrl = new URL(`${serverUrl}${endpoint}`);

  return builtUrl.toString();
}

function imageUrlToImageId(imageFullUrl?: string) {
  if (!imageFullUrl) {
    return null;
  }
  const parsedUrl = URL.canParse(imageFullUrl) && new URL(imageFullUrl);
  const imageId = parsedUrl && parsedUrl?.pathname.split('/').pop();
  if (isNil(imageId) || !isNumber(toNumber(imageId)) || !isFinite(toNumber(imageId))) {
    return null;
  }
  return toNumber(imageId);
}

export async function fetchBinaryFromSogsWithOnionV4(sendOptions: {
  serverUrl: string;
  serverPubkey: string;
  blinded: boolean;
  abortSignal: AbortSignal;
  headers: Record<string, any> | null;
  roomId: string;
  fileId: string;
  throwError: boolean;
}): Promise<Uint8Array | null> {
  const {
    serverUrl,
    serverPubkey,
    blinded,
    abortSignal,
    headers: includedHeaders,
    roomId,
    fileId,
    throwError,
  } = sendOptions;

  const stringifiedBody = null;
  const method = 'GET';

  const builtUrl = new URL(fileDetailsToURL({ fileId, roomId, serverUrl }));
  const endpoint = fileDetailsToEndpoint({ fileId, roomId });
  let headersWithSogsHeadersIfNeeded = await OpenGroupPollingUtils.getOurOpenGroupHeaders(
    serverPubkey,
    endpoint,
    method,
    blinded,
    stringifiedBody
  );

  if (isUndefined(headersWithSogsHeadersIfNeeded)) {
    return null;
  }
  headersWithSogsHeadersIfNeeded = { ...includedHeaders, ...headersWithSogsHeadersIfNeeded };
  const res = await OnionSending.sendViaOnionV4ToNonSnodeWithRetries(
    serverPubkey,
    builtUrl,
    {
      method,
      headers: headersWithSogsHeadersIfNeeded,
      body: stringifiedBody,
      useV4: true,
    },
    throwError,
    abortSignal,
    30 * DURATION.SECONDS // longer time for binary fetch
  );

  if (!res?.bodyBinary) {
    window.log.info('fetchBinaryFromSogsWithOnionV4 no binary content with code', res?.status_code);
    return null;
  }
  return res.bodyBinary;
}

/**
 * This function fetches the avatar on an opengroup room based on the imageID, save it to the attachment folder and update the conversation avatar with the new path.
 */
export async function sogsV3FetchPreviewAndSaveIt(roomInfos: OpenGroupV2RoomWithImageID) {
  const { roomId, serverUrl, imageFullUrl } = roomInfos;

  const imageIdNumber = imageUrlToImageId(imageFullUrl);
  if (!imageIdNumber) {
    return;
  }

  const convoId = getOpenGroupV2ConversationId(roomInfos.serverUrl, roomInfos.roomId);
  let convo = ConvoHub.use().get(convoId);
  if (!convo) {
    return;
  }
  let existingImagePointer = convo.getAvatarPointer();
  if (existingImagePointer === imageFullUrl) {
    // return early as the imageID about to be downloaded the one already set as avatar is the same.
    return;
  }

  const room = OpenGroupData.getV2OpenGroupRoom(convoId);
  const blinded = roomHasBlindEnabled(room);

  // make sure this runs only once for each rooms.
  // we don't want to trigger one of those on each setPollInfo results as it happens on each batch poll.
  const oneAtAtimeResult = await allowOnlyOneAtATime(
    `sogsV3FetchPreview-${serverUrl}-${roomId}`,
    () => sogsV3FetchPreview(roomInfos, blinded)
  );

  if (!oneAtAtimeResult || !oneAtAtimeResult?.byteLength) {
    window?.log?.warn('sogsV3FetchPreviewAndSaveIt failed for room: ', roomId);
    return;
  }
  // refresh to make sure the convo was not deleted during the fetch above
  convo = ConvoHub.use().get(convoId);
  if (!convo) {
    return;
  }
  existingImagePointer = convo.getAvatarPointer();
  if (existingImagePointer !== imageFullUrl && isFinite(imageIdNumber)) {
    // we have to trigger an update
    // write the file to the disk (automatically encrypted),

    const upgradedAttachment = await processNewAttachment({
      isRaw: true,
      data: oneAtAtimeResult.buffer,
      contentType: MIME.IMAGE_UNKNOWN, // contentType is mostly used to generate previews and screenshot. We do not care for those in this case.          // url: `${serverUrl}/${res.roomId}`,
    });

    // this does commit to DB and UI
    if (imageFullUrl) {
      await convo.setSessionProfile({
        displayName: null, // null so we don't overwrite it
        type: 'setAvatarDownloadedCommunity',
        avatarPath: upgradedAttachment.path,
        avatarPointer: imageFullUrl,
        fallbackAvatarPath: upgradedAttachment.path, // no need for a fallback for a community
        profileKey: new Uint8Array(), // unneeded for a community
      });
    } else {
      await convo.setSessionProfile({
        displayName: null, // null so we don't overwrite it
        type: 'resetAvatarCommunity',
      });
    }
  }
}

/**
 * This function can be used to fetch the default rooms (leftpane) images when the app starts.
 * @returns the fetchedData in base64
 */
export async function sogsV3FetchPreviewBase64(roomInfos: OpenGroupV2RoomWithImageID) {
  const fetched = await sogsV3FetchPreview(roomInfos, true); // left pane are session official default rooms, which do require blinded
  if (fetched && fetched.byteLength) {
    return callUtilsWorker('arrayBufferToStringBase64', fetched);
  }
  return null;
}

/**
 * Download the preview image for that opengroup room.
 * The returned value is a Uin8Array.
 * It can be used directly, or saved on the attachments directory if needed (processNewAttachment), but this function does not handle it.
 * Be sure to give the imageID field here, otherwise the request is dropped.
 * This function does not check if the conversation exist, as it can be called for getting the preview image of the default rooms too. (left pane join default rooms)
 * Those default rooms do not have a conversation associated with them, as they are not joined yet
 */
const sogsV3FetchPreview = async (
  roomInfos: OpenGroupV2RoomWithImageID,
  blinded: boolean
): Promise<Uint8Array | null> => {
  if (!roomInfos || !roomInfos.imageFullUrl) {
    return null;
  }

  const imageId = imageUrlToImageId(roomInfos.imageFullUrl);
  if (!imageId) {
    return null;
  }

  // not a batch call yet as we need to exclude headers for this call for now
  const fetched = await fetchBinaryFromSogsWithOnionV4({
    abortSignal: new AbortController().signal,
    blinded,
    headers: null,
    serverPubkey: roomInfos.serverPublicKey,
    serverUrl: roomInfos.serverUrl,
    roomId: roomInfos.roomId,
    fileId: `${imageId}`,
    throwError: false,
  });
  if (fetched && fetched.byteLength) {
    return fetched;
  }
  return null;
};

/**
 * Download the file fileID in that opengroup room.
 * The returned value is a base64 string.
 * It can be used directly, or saved on the attachments directory if needed, but this function does not handle it.
 */
export const sogsV3FetchFileByFileID = async (
  roomInfos: OpenGroupV2Room,
  fileId: string
): Promise<Uint8Array | null> => {
  if (!roomInfos) {
    return null;
  }
  // not a batch call yet as we need to exclude headers for this call for now
  const fetched = await fetchBinaryFromSogsWithOnionV4({
    abortSignal: new AbortController().signal,
    blinded: roomHasBlindEnabled(roomInfos),
    headers: null,
    serverPubkey: roomInfos.serverPublicKey,
    serverUrl: roomInfos.serverUrl,
    roomId: roomInfos.roomId,
    fileId,
    throwError: true,
  });
  return fetched && fetched.byteLength ? fetched : null;
};
