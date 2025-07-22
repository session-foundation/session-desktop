/* eslint-disable max-len */
import imageType from 'image-type';

import { arrayBufferToBlob } from 'blob-util';
import { StagedAttachmentType } from '../../components/conversation/composition/CompositionBox';
import { SignalService } from '../../protobuf';
import { DecryptedAttachmentsManager } from '../../session/crypto/DecryptedAttachmentsManager';
import { sendDataExtractionNotification } from '../../session/messages/outgoing/controlMessage/DataExtractionNotificationMessage';
import { AttachmentType, save } from '../../types/Attachment';
import { IMAGE_UNKNOWN, type MIMEType } from '../../types/MIME';
import { getAbsoluteAttachmentPath, processNewAttachment } from '../../types/MessageAttachment';

import { MAX_ATTACHMENT_FILESIZE_BYTES } from '../../session/constants';
import { MIME } from '../../types';
import { maxThumbnailDetails } from './attachmentSizes';
import { callImageProcessorWorker } from '../../webworker/workers/browser/image_processor_interface';

/**
 * The logic for sending attachments is as follow:
 *
 * 1. The User selects whatever attachments he wants to send with the system file handler.
 * 2. We generate a preview if possible just to use it in the Composition Box Staged attachments list (preview of attachments scheduled for sending with the next message)
 * 3. During that preview generation, we also autoscale images if possible and make sure the orientation is right.
 * 4. If autoscale is not possible, we make sure the size of each attachments is fine with the service nodes limit. Otherwise, a toast is shown and the attachment is not added.
 * 5. When autoscale is possible, we make sure that the scaled size is OK for the services nodes already
 * 6. We do not keep those autoscaled attachments in memory for now, just the previews are kept in memory and the original filepath.
 *
 * 7. Once the user is ready to send a message and hit ENTER or SEND, we grab the real files again from the staged attachments, autoscale them again if possible, generate thumbnails and screenshot (video) if needed and write them to the attachments folder (encrypting them) with processNewAttachments.
 *
 * 8. This operation will give us back the path of the attachment in the attachments folder and the size written for this attachment (make sure to use that one as size for the outgoing attachment)
 *
 * 9. Once all attachments are written to the attachments folder, we grab the data from those files directly before sending them. This is done in uploadData() with loadAttachmentsData().
 *
 * 10. We use the grabbed data for upload of the attachments, get an url for each of them and send the url with the attachments details to the user/opengroup/closed group
 */

export type BetterBlob = Blob & {
  __brand: 'BetterBlob';
  /** @deprecated -- `type` should not be used, it can be tampered with, use @see {@link contentType} */
  type: Blob['type'];
  contentType: MIMEType;
  animated: boolean;
  width?: number;
  height?: number;
};

async function createBetterBlobFromBlob(blob: Blob): Promise<BetterBlob> {
  if (!MIME.isImage(blob.type)) {
    return blob as unknown as BetterBlob;
  }
  const arrayBuffer = await blob.arrayBuffer();

  const betterBlob = blob as unknown as BetterBlob;

  betterBlob.contentType = imageTypeFromArrayBuffer(arrayBuffer);
  betterBlob.animated =
    (await callImageProcessorWorker('imageMetadata', arrayBuffer))?.isAnimated || false;

  return betterBlob;
}

export async function createBetterBlobFromArrayBuffer(
  arrayBuffer: ArrayBuffer,
  contentType?: MIMEType,
  isAnimated?: boolean
): Promise<BetterBlob> {
  const type = contentType ?? imageTypeFromArrayBuffer(arrayBuffer);
  const blob = arrayBufferToBlob(arrayBuffer, type) satisfies Blob as unknown as BetterBlob;

  blob.contentType = type;
  blob.animated =
    isAnimated ??
    ((await callImageProcessorWorker('imageMetadata', arrayBuffer))?.isAnimated || false);

  return blob;
}

type MaxScaleSize = {
  maxSizeBytes?: number;
  maxHeightPx?: number;
  maxWidthPx?: number;
  maxSidePx?: number; // use this to make avatars cropped if too big and centered if too small.
};

function imageTypeFromArrayBuffer(arrayBuffer: ArrayBuffer) {
  const data = new Uint8Array(arrayBuffer);
  return imageType(data)?.mime ?? IMAGE_UNKNOWN;
}

export async function autoScaleFile(blob: Blob, maxMeasurements?: MaxScaleSize) {
  const betterBlob = await createBetterBlobFromBlob(blob);
  if (betterBlob.contentType === IMAGE_UNKNOWN || !MIME.isImage(betterBlob.contentType)) {
    betterBlob.contentType = blob.type;
    return betterBlob;
  }
  const processed = await callImageProcessorWorker(
    'processForFileServerUpload',
    await blob.arrayBuffer(),
    maxMeasurements?.maxSidePx ?? 2000,
    maxMeasurements?.maxSizeBytes ?? MAX_ATTACHMENT_FILESIZE_BYTES
  );

  if (!processed) {
    return betterBlob;
  }
  return createBetterBlobFromArrayBuffer(processed.outputBuffer);
}

export type StagedAttachmentImportedType = Omit<
  StagedAttachmentType,
  'file' | 'url' | 'fileSize'
> & { flags?: number };

/**
 * This is the type of the image of a link preview once it was saved in the attachment folder
 */
export type StagedImagePreviewImportedType = Pick<
  StagedAttachmentType,
  'contentType' | 'path' | 'size' | 'width' | 'height'
>;

/**
 * This is the type of a complete preview imported in the app, hence with the image being a StagedImagePreviewImportedType.
 * This is the one to be used in uploadData and which should be saved in the database message models
 */
export type StagedPreviewImportedType = {
  url: string;
  title: string;
  image?: StagedImagePreviewImportedType;
};

export async function getFileAndStoreLocally(
  attachment: StagedAttachmentType
): Promise<StagedAttachmentImportedType | null> {
  if (!attachment) {
    return null;
  }

  const maxMeasurements: MaxScaleSize = {
    maxSizeBytes: MAX_ATTACHMENT_FILESIZE_BYTES,
  };

  const attachmentFlags = attachment.isVoiceMessage
    ? (SignalService.AttachmentPointer.Flags.VOICE_MESSAGE as number)
    : null;

  const scaled = MIME.isImage(attachment.contentType)
    ? await autoScaleFile(attachment.file, maxMeasurements)
    : attachment.file;

  // this operation might change the file size, so be sure to rely on it on return here.
  const attachmentSavedLocally = await processNewAttachment({
    data: await scaled.arrayBuffer(),
    contentType: attachment.contentType,
    fileName: attachment.fileName,
  });

  return {
    caption: attachment.caption,
    contentType: attachment.contentType,
    fileName: attachmentSavedLocally.fileName,
    path: attachmentSavedLocally.path,
    width: attachmentSavedLocally.width,
    height: attachmentSavedLocally.height,
    screenshot: attachmentSavedLocally.screenshot,
    thumbnail: attachmentSavedLocally.thumbnail,
    size: attachmentSavedLocally.size,
    flags: attachmentFlags || undefined,
  };
}

export async function getFileAndStoreLocallyImageBlob(blob: BetterBlob) {
  const scaled = await callImageProcessorWorker(
    'processForInConversationThumbnail',
    await blob.arrayBuffer(),
    maxThumbnailDetails.maxSide
  );
  // this operation might change the file size, so be sure to rely on it on return here.
  const attachmentSavedLocally = await processNewAttachment({
    data: scaled.outputBuffer,
    contentType: scaled.contentType,
  });

  return {
    contentType: scaled.contentType,
    path: attachmentSavedLocally.path,
    width: scaled.width,
    height: scaled.height,
    size: attachmentSavedLocally.size,
  };
}

export type AttachmentFileType = {
  attachment: any;
  data: ArrayBuffer;
  size: number;
};

export async function readAvatarAttachment(attachment: {
  file: Blob;
}): Promise<AttachmentFileType> {
  const dataReadFromBlob = await attachment.file.arrayBuffer();

  return { attachment, data: dataReadFromBlob, size: dataReadFromBlob.byteLength };
}

export const saveAttachmentToDisk = async ({
  attachment,
  messageTimestamp,
  messageSender,
  conversationId,
  index,
}: {
  attachment: AttachmentType;
  messageTimestamp: number;
  messageSender: string;
  conversationId: string;
  index: number;
}) => {
  const decryptedUrl = await DecryptedAttachmentsManager.getDecryptedMediaUrl(
    attachment.url,
    attachment.contentType,
    false
  );
  save({
    attachment: { ...attachment, url: decryptedUrl },
    document,
    getAbsolutePath: getAbsoluteAttachmentPath,
    timestamp: messageTimestamp,
    index,
  });
  await sendDataExtractionNotification(conversationId, messageSender, messageTimestamp);
};
