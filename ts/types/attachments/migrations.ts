/* eslint-disable no-param-reassign */
import { blobToArrayBuffer } from 'blob-util';

import fse from 'fs-extra';
import { isString } from 'lodash';
import * as GoogleChrome from '../../util/GoogleChrome';
import { toLogFormat } from './Errors';

import { deleteOnDisk, readAttachmentData, writeNewAttachmentData } from '../MessageAttachment';
import {
  THUMBNAIL_CONTENT_TYPE,
  getImageDimensions,
  makeImageThumbnailBuffer,
  makeObjectUrl,
  makeVideoScreenshot,
  revokeObjectUrl,
} from './VisualAttachment';
import { maxThumbnailDetails } from '../../util/attachment/attachmentSizes';

const UNICODE_REPLACEMENT_CHARACTER = '\uFFFD';

// \u202A-\u202E is LRE, RLE, PDF, LRO, RLO
// \u2066-\u2069 is LRI, RLI, FSI, PDI
// \u200E is LRM
// \u200F is RLM
// \u061C is ALM
const V2_UNWANTED_UNICODE = /[\u202A-\u202E\u2066-\u2069\u200E\u200F\u061C]/g;

export const replaceUnicodeV2 = (fileName: string) => {
  if (!isString(fileName)) {
    throw new Error('replaceUnicodeV2 should not be called without a filename');
  }

  return fileName.replace(V2_UNWANTED_UNICODE, UNICODE_REPLACEMENT_CHARACTER);
};

export const loadData = async (attachment: any) => {
  if (!attachment) {
    throw new TypeError("'attachment' is not valid");
  }

  // attachment is already loaded
  if (attachment.data instanceof ArrayBuffer || ArrayBuffer.isView(attachment.data)) {
    return attachment;
  }

  if (!isString(attachment.path)) {
    throw new TypeError("'attachment.path' is required");
  }

  const data = await readAttachmentData(attachment.path);
  return { ...attachment, data };
};

export const deleteData = async (attachment: {
  path: string | undefined;
  thumbnail: any;
  screenshot: any;
}) => {
  if (!attachment) {
    throw new TypeError('deleteData: attachment is not valid');
  }

  const { path, thumbnail, screenshot } = attachment;
  if (isString(path)) {
    await deleteOnDisk(path);
    attachment.path = '';
  }
  if (thumbnail && isString(thumbnail.path)) {
    await deleteOnDisk(thumbnail.path);
    attachment.thumbnail = undefined;
  }
  if (screenshot && isString(screenshot.path)) {
    await deleteOnDisk(screenshot.path);
    attachment.screenshot = undefined;
  }

  return attachment;
};

export const deleteDataSuccessful = async (attachment: {
  path: string;
  thumbnail: any;
  screenshot: any;
}) => {
  const errorMessage = `deleteDataSuccessful: Deletion failed for attachment ${attachment.path}`;
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  return fse.pathExists(attachment.path, (err, exists) => {
    if (err) {
      return Promise.reject(new Error(`${errorMessage} ${err}`));
    }

    // Note we want to confirm the path no longer exists
    if (exists) {
      return Promise.reject(errorMessage);
    }

    window.log.debug(`deleteDataSuccessful: Deletion succeeded for attachment ${attachment.path}`);
    return true;
  });
};

export const captureDimensionsAndScreenshot = async (opts: {
  data: ArrayBufferLike;
  contentType: string;
}): Promise<{
  width?: number;
  height?: number;

  thumbnail: {
    path: string;
    contentType: string;
    width: number;
    height: number;
  } | null;
  screenshot: {
    path: string;
    contentType: string;
    width: number;
    height: number;
  } | null;
}> => {
  const { contentType } = opts;

  const fallbackResult = {
    width: undefined,
    height: undefined,
    screenshot: null,
    thumbnail: null,
  };

  if (
    !contentType ||
    (!GoogleChrome.isImageTypeSupported(contentType) &&
      !GoogleChrome.isVideoTypeSupported(contentType))
  ) {
    return fallbackResult;
  }

  // If the attachment hasn't been downloaded yet, we won't have any data
  if (!opts.data.byteLength) {
    return fallbackResult;
  }

  const objectUrl = URL.createObjectURL(new Blob([opts.data]));

  if (GoogleChrome.isImageTypeSupported(contentType)) {
    try {
      const { width, height } = await getImageDimensions({
        objectUrl,
      });
      const thumbnailBuffer = await makeImageThumbnailBuffer({
        objectUrl,
        contentType,
      });

      const thumbnailPath = await writeNewAttachmentData(thumbnailBuffer);
      return {
        width,
        height,
        thumbnail: {
          path: thumbnailPath,
          contentType: THUMBNAIL_CONTENT_TYPE,
          width: maxThumbnailDetails.maxSide,
          height: maxThumbnailDetails.maxSide,
        },
        screenshot: null,
      };
    } catch (error) {
      window.log.error(
        'captureDimensionsAndScreenshot:',
        'error processing image; skipping screenshot generation',
        toLogFormat(error)
      );
      return fallbackResult;
    }
  }

  if (!GoogleChrome.isImageTypeSupported(contentType)) {
    window.log.error('captureDimensionsAndScreenshot: this should have returned earlier');
    return fallbackResult;
  }

  let screenshotObjectUrl;
  try {
    const screenshotBuffer = await blobToArrayBuffer(
      await makeVideoScreenshot({
        objectUrl,
        contentType: THUMBNAIL_CONTENT_TYPE,
      })
    );
    screenshotObjectUrl = makeObjectUrl(screenshotBuffer, THUMBNAIL_CONTENT_TYPE);
    const { width, height } = await getImageDimensions({
      objectUrl: screenshotObjectUrl,
    });

    const screenshotPath = await writeNewAttachmentData(screenshotBuffer);

    const thumbnailBuffer = await makeImageThumbnailBuffer({
      objectUrl: screenshotObjectUrl,
      contentType: THUMBNAIL_CONTENT_TYPE,
    });

    const thumbnailPath = await writeNewAttachmentData(thumbnailBuffer);

    return {
      screenshot: {
        contentType: THUMBNAIL_CONTENT_TYPE,
        path: screenshotPath,
        width,
        height,
      },
      thumbnail: {
        path: thumbnailPath,
        contentType: THUMBNAIL_CONTENT_TYPE,
        width: maxThumbnailDetails.maxSide,
        height: maxThumbnailDetails.maxSide,
      },
      width,
      height,
    };
  } catch (error) {
    window.log.error(
      'captureDimensionsAndScreenshot: error processing video; skipping screenshot generation',
      toLogFormat(error)
    );
    return fallbackResult;
  } finally {
    if (screenshotObjectUrl) {
      revokeObjectUrl(screenshotObjectUrl);
    }
  }
};
