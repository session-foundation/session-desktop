/* eslint-disable max-len */
import imageType from 'image-type';

import { arrayBufferToBlob } from 'blob-util';
import loadImage from 'blueimp-load-image';
import { filesize } from 'filesize';
import { isUndefined } from 'lodash';
import { StagedAttachmentType } from '../components/conversation/composition/CompositionBox';
import { SignalService } from '../protobuf';
import { DecryptedAttachmentsManager } from '../session/crypto/DecryptedAttachmentsManager';
import { sendDataExtractionNotification } from '../session/messages/outgoing/controlMessage/DataExtractionNotificationMessage';
import { AttachmentType, save } from '../types/Attachment';
import {
  IMAGE_GIF,
  IMAGE_JPEG,
  IMAGE_PNG,
  IMAGE_TIFF,
  IMAGE_UNKNOWN,
  IMAGE_WEBP,
  type MIMEType,
} from '../types/MIME';
import { getAbsoluteAttachmentPath, processNewAttachment } from '../types/MessageAttachment';

import { MAX_ATTACHMENT_FILESIZE_BYTES } from '../session/constants';
import { perfEnd, perfStart } from '../session/utils/Performance';
import { getFeatureFlag } from '../state/ducks/types/releasedFeaturesReduxTypes';
import { isImageAnimated } from '../types/attachments/animated';
import { MIME } from '../types';
import {
  ATTACHMENT_DEFAULT_MAX_SIDE,
  maxAvatarDetails,
  maxThumbnailDetails,
} from './attachmentSizes';
import { callImageProcessorWorker } from '../webworker/workers/browser/image_processor_interface';

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
const DEBUG_ATTACHMENTS_SCALE = true;
type HandleContentTypeCallback = (contentType: MIMEType) => void;

export type BetterBlob = Blob & {
  __brand: 'BetterBlob';
  /** @deprecated -- `type` should not be used, it can be tampered with, use @see {@link contentType} */
  type: Blob['type'];
  contentType: MIMEType;
  animated: boolean;
  width?: number;
  height?: number;
};

async function createBetterBlobFromBlob(
  blob: Blob,
  contentType?: MIMEType,
  isAnimated?: boolean
): Promise<BetterBlob> {
  if (!MIME.isImage(blob.type)) {
    return blob as unknown as BetterBlob;
  }
  const arrayBuffer = await blob.arrayBuffer();

  const betterBlob = blob as unknown as BetterBlob;

  betterBlob.contentType = contentType ?? imageTypeFromArrayBuffer(arrayBuffer);
  betterBlob.animated = isAnimated ?? (await isImageAnimated(arrayBuffer, betterBlob.contentType));

  return betterBlob;
}

async function createBetterBlobFromArrayBuffer(
  arrayBuffer: ArrayBuffer,
  contentType?: MIMEType,
  isAnimated?: boolean
): Promise<BetterBlob> {
  const type = contentType ?? imageTypeFromArrayBuffer(arrayBuffer);
  const blob = arrayBufferToBlob(arrayBuffer, type) satisfies Blob as unknown as BetterBlob;

  blob.contentType = type;
  blob.animated = isAnimated ?? (await isImageAnimated(arrayBuffer, blob.contentType));

  return blob;
}

async function createBetterBlobFromCanvas(
  canvas: HTMLCanvasElement,
  contentType: MIMEType,
  quality: number,
  isAnimated?: boolean
): Promise<BetterBlob | null> {
  const blob = (await canvasToBlob(canvas, contentType, quality)) as unknown as BetterBlob | null;

  if (!blob) {
    return null;
  }

  blob.contentType = contentType;
  if (isUndefined(isAnimated)) {
    const arrayBuffer = await blob.arrayBuffer();
    blob.animated = await isImageAnimated(arrayBuffer, contentType);
  }

  return blob;
}

type MaxScaleSize = {
  maxSize?: number;
  maxHeight?: number;
  maxWidth?: number;
  maxSide?: number; // use this to make avatars cropped if too big and centered if too small.
};

type Options = {
  handleContentTypeCallback?: HandleContentTypeCallback;
  maxScaleSize?: MaxScaleSize;
};

function isSupportedAvatarContentType(contentType: MIMEType) {
  // WEBP is only supported after the pro release
  const proAvailable = getFeatureFlag('proAvailable');

  return (
    contentType === IMAGE_PNG ||
    contentType === IMAGE_GIF ||
    contentType === IMAGE_JPEG ||
    (proAvailable && contentType === IMAGE_WEBP)
  );
}

const handleContentTypeCallbackAvatar = (contentType: MIMEType) => {
  if (!isSupportedAvatarContentType(contentType)) {
    throw new Error(`Cannot processImageAvatar ${contentType} file. Only PNG, GIF or JPEG.`);
  }
};

async function processImage(arrayBuffer: ArrayBuffer, options: Options) {
  const blob = await createBetterBlobFromArrayBuffer(arrayBuffer);
  options.handleContentTypeCallback?.(blob.contentType);

  return autoScale(blob, options.maxScaleSize);
}

function imageTypeFromArrayBuffer(arrayBuffer: ArrayBuffer) {
  const data = new Uint8Array(arrayBuffer);
  return imageType(data)?.mime ?? IMAGE_UNKNOWN;
}

async function processImageBlob(blob: Blob, options: Options = {}) {
  const arrayBuffer = await blob.arrayBuffer();
  return processImage(arrayBuffer, options);
}

/**
 * Resize a jpg/gif/png file to our definition on an avatar before upload
 */
export async function processAvatarImageBlob(blob: Blob) {
  if (DEBUG_ATTACHMENTS_SCALE) {
    window.log.debug('processAvatarImageBlob: autoscale for avatar', maxAvatarDetails);
  }

  return processImageBlob(blob, {
    handleContentTypeCallback: handleContentTypeCallbackAvatar,
    maxScaleSize: maxAvatarDetails,
  });
}

export async function processAvatarImageArrayBuffer(arrayBuffer: ArrayBuffer) {
  if (DEBUG_ATTACHMENTS_SCALE) {
    window.log.debug('processAvatarImageArrayBuffer: autoscale for avatar', maxAvatarDetails);
  }

  return processImage(arrayBuffer, {
    handleContentTypeCallback: handleContentTypeCallbackAvatar,
    maxScaleSize: maxAvatarDetails,
  });
}

/**
 * Auto scale an attachment to get a thumbnail from it.
 * We consider that a thumbnail is currently at most 200 ko, is a square and has a maxSize of THUMBNAIL_SIDE
 * @param attachment the attachment to auto scale
 */
export async function autoScaleForThumbnailBlob(blob: Blob) {
  if (DEBUG_ATTACHMENTS_SCALE) {
    window.log.debug('autoScaleForThumbnail', maxThumbnailDetails);
  }

  return processImageBlob(blob, {
    maxScaleSize: maxThumbnailDetails,
  });
}

/**
 * Auto scale an attachment to get a thumbnail from it. We consider that a thumbnail is currently at most 200 ko, is a square and has a maxSize of THUMBNAIL_SIDE
 * @param attachment the attachment to auto scale
 */
export async function autoScaleForThumbnailArrayBuffer(arrayBuffer: ArrayBuffer) {
  if (DEBUG_ATTACHMENTS_SCALE) {
    window.log.debug('autoScaleForThumbnail', maxThumbnailDetails);
  }

  return processImage(arrayBuffer, {
    maxScaleSize: maxThumbnailDetails,
  });
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise(resolve => {
    canvas.toBlob(
      blob => {
        resolve(blob);
      },
      type,
      quality
    );
  });
}

export async function autoScaleBlob(blob: Blob, maxMeasurements?: MaxScaleSize) {
  const betterBlob = await createBetterBlobFromBlob(blob);
  if (betterBlob.contentType === IMAGE_UNKNOWN || !MIME.isImage(betterBlob.contentType)) {
    betterBlob.contentType = blob.type;
    return betterBlob;
  }
  return autoScale(betterBlob, maxMeasurements);
}

/**
 * Scale down an image to fit in the required dimension.
 * Note: This method won't crop if needed,
 * @param attachment The attachment to scale down
 * @param maxMeasurements any of those will be used if set
 */
export async function autoScale(
  attachment: BetterBlob,
  maxMeasurements?: MaxScaleSize
): Promise<BetterBlob> {
  const start = Date.now();
  const contentType = attachment.contentType;

  if (DEBUG_ATTACHMENTS_SCALE) {
    window.log.debug('autoscale', attachment, maxMeasurements);
  }

  if (!MIME.isImage(contentType) || contentType === IMAGE_TIFF) {
    // nothing to do
    return attachment;
  }

  if (maxMeasurements?.maxSide && (maxMeasurements?.maxHeight || maxMeasurements?.maxWidth)) {
    throw new Error('Cannot have maxSide and another dimension set together');
  }

  // Make sure the asked max size is not more than whatever
  // Services nodes can handle (MAX_ATTACHMENT_FILESIZE_BYTES)
  const askedMaxSize = maxMeasurements?.maxSize || MAX_ATTACHMENT_FILESIZE_BYTES;
  const maxSize =
    askedMaxSize > MAX_ATTACHMENT_FILESIZE_BYTES ? MAX_ATTACHMENT_FILESIZE_BYTES : askedMaxSize;
  const makeSquare = Boolean(maxMeasurements?.maxSide);
  const maxHeight =
    maxMeasurements?.maxHeight || maxMeasurements?.maxSide || ATTACHMENT_DEFAULT_MAX_SIDE;
  const maxWidth =
    maxMeasurements?.maxWidth || maxMeasurements?.maxSide || ATTACHMENT_DEFAULT_MAX_SIDE;

  if (attachment.animated) {
    if (
      attachment.size <= maxSize &&
      (attachment.width || 0) <= maxWidth &&
      (attachment.height || 0) <= maxHeight
    ) {
      return attachment;
    }

    const resized = await callImageProcessorWorker(
      'cropAnimatedAvatar',
      await attachment.arrayBuffer(),
      20
    );

    if (resized.resizedBuffer.byteLength <= maxSize) {
      return createBetterBlobFromArrayBuffer(
        resized.resizedBuffer,
        attachment.contentType,
        attachment.animated
      );
    }

    const imgType = attachment.contentType === IMAGE_WEBP ? 'WEBP' : 'GIF';
    throw new Error(
      `${imgType} is too large. Max size: ${filesize(maxSize, { base: 10, round: 0 })}`
    );
  }

  perfStart(`loadimage-*${attachment.size}`);
  const canvasLoad = await loadImage(attachment, {});
  const canvasScaled = loadImage.scale(
    canvasLoad.image, // img or canvas element
    {
      maxWidth: makeSquare ? maxMeasurements?.maxSide : maxWidth,
      maxHeight: makeSquare ? maxMeasurements?.maxSide : maxHeight,
      crop: !!makeSquare,
      cover: !!makeSquare,
      orientation: 1,
      canvas: true,
      imageSmoothingQuality: 'medium',
      meta: false,
    }
  );
  perfEnd(`loadimage-*${attachment.size}`, `loadimage-*${attachment.size}`);
  if (!canvasScaled || !canvasScaled.width || !canvasScaled.height) {
    throw new Error('failed to scale image');
  }

  const debugData = DEBUG_ATTACHMENTS_SCALE
    ? {
        canvasOriginalWidth: canvasScaled.width,
        canvasOriginalHeight: canvasScaled.height,
        maxWidth,
        maxHeight,
        blobsize: attachment.size,
        maxSize,
        makeSquare,
      }
    : null;

  let readAndResizedBlob = attachment;
  if (
    canvasScaled.width <= maxWidth &&
    canvasScaled.height <= maxHeight &&
    attachment.size <= maxSize &&
    !makeSquare
  ) {
    if (DEBUG_ATTACHMENTS_SCALE) {
      window.log.debug(
        'canvasScaled used right away as width, height and size are fine',
        debugData
      );
    }
    // the canvas has a size of whatever was given by the caller of autoscale().
    // so we have to return those measures as the loaded file has now those measures.
    // eslint-disable-next-line no-param-reassign
    attachment.width = canvasScaled.width;
    // eslint-disable-next-line no-param-reassign
    attachment.height = canvasScaled.height;

    return attachment;
  }
  if (DEBUG_ATTACHMENTS_SCALE) {
    window.log.debug('canvasOri.originalWidth', debugData);
  }
  let quality = 0.95;
  const startI = 4;
  let i = startI;
  do {
    i -= 1;
    if (DEBUG_ATTACHMENTS_SCALE) {
      window.log.debug(`autoscale iteration: [${i}] for:`, JSON.stringify(readAndResizedBlob.size));
    }
    // eslint-disable-next-line no-await-in-loop
    const tempBlob = await createBetterBlobFromCanvas(canvasScaled, IMAGE_JPEG, quality);
    if (!tempBlob) {
      throw new Error('Failed to get blob during canvasToBlob.');
    }

    readAndResizedBlob = tempBlob;
    quality = (quality * maxSize) / (readAndResizedBlob.size * (i === 1 ? 2 : 1)); // make the last iteration decrease drastically quality of the image

    if (quality > 1) {
      quality = 0.95;
    }
  } while (i > 0 && readAndResizedBlob.size > maxSize);

  if (readAndResizedBlob.size > maxSize) {
    throw new Error('Cannot add this attachment even after trying to scale it down.');
  }
  window.log.debug(`[perf] autoscale took ${Date.now() - start}ms `);

  readAndResizedBlob.width = canvasScaled.width;
  readAndResizedBlob.height = canvasScaled.height;

  return readAndResizedBlob;
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
    maxSize: MAX_ATTACHMENT_FILESIZE_BYTES,
  };

  const attachmentFlags = attachment.isVoiceMessage
    ? (SignalService.AttachmentPointer.Flags.VOICE_MESSAGE as number)
    : null;

  const scaled = MIME.isImage(attachment.contentType)
    ? await autoScaleBlob(attachment.file, maxMeasurements)
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
  const scaled = await autoScaleForThumbnailBlob(blob);
  // this operation might change the file size, so be sure to rely on it on return here.
  const attachmentSavedLocally = await processNewAttachment({
    data: await scaled.arrayBuffer(),
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
