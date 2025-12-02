import { isArrayBuffer } from 'lodash';
import { ImageProcessor } from '../../webworker/workers/browser/image_processor_interface';
import { MAX_ATTACHMENT_FILESIZE_BYTES } from '../../session/constants';
import { getFeatureFlag } from '../../state/ducks/types/releasedFeaturesReduxTypes';

/**
 * Fallback image processor using Canvas API. This should only be used if the main image processor is disabled or not working and the functionality doesn't work without image processing.
 */
async function processImageFallback(arrayBuffer: ArrayBuffer) {
  const blob = new Blob([arrayBuffer]);

  const img = new Image();
  const imageUrl = URL.createObjectURL(blob);

  try {
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = imageUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('processImageFallback: ctx is undefined');
    }

    ctx.drawImage(img, 0, 0);

    const outputBlob = await new Promise(resolve => {
      canvas.toBlob(resolve, 'image/webp');
    });

    if (
      !outputBlob ||
      typeof outputBlob !== 'object' ||
      !('arrayBuffer' in outputBlob) ||
      typeof outputBlob.arrayBuffer !== 'function'
    ) {
      throw new Error('processImageFallback: arrayBuffer is not a function on outputBlob');
    }

    const outputBuffer = await outputBlob.arrayBuffer();

    if (!outputBuffer || outputBuffer.byteLength === 0 || !isArrayBuffer(outputBuffer)) {
      throw new Error('processImageFallback: outputBuffer is empty');
    }

    return {
      outputBuffer,
      width: img.width,
      height: img.height,
      size: outputBuffer.byteLength,
      format: 'webp' as const,
      isAnimated: false, // Canvas can't detect animation easily
      contentType: 'image/webp' as const,
    };
  } catch (e) {
    window?.log?.error(e);
    throw e;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

/**
 * When the current device makes a change to its avatar, or a group/communities avatar we need to process it.
 * The same applies for an incoming avatar downloaded.
 *
 * This function will create the required buffers of data, depending on the type of avatar.
 * - mainAvatarDetails will be animated (webp enforced) if the source was animated, or a jpeg of the original image
 * - avatarFallback will be an image (webp enforced) of the first frame of `mainAvatarDetails` if it was animated, or null
 *
 * There is a specific case for the avatars that we need to be able to reupload,
 * as we do want to keep a resolution of 600 x 600 instead of the usual 200 x 200.
 *
 * This is because we need to be able to reupload our full avatar to the file server, and mobile pixel density can be 3x.
 * We still want to reduce incoming avatars to 200 x 200 for performance reasons.
 */
export async function processAvatarData(
  arrayBuffer: ArrayBuffer,
  planForReupload: boolean,
  remoteChange = false
) {
  if (!arrayBuffer || arrayBuffer.byteLength === 0 || !isArrayBuffer(arrayBuffer)) {
    throw new Error('processAvatarData: arrayBuffer is empty');
  }

  if (getFeatureFlag('disableImageProcessor')) {
    const fallbackData = await processImageFallback(arrayBuffer);
    // NOTE: animated display pictures are not supported by the fallback image processor
    return {
      mainAvatarDetails: fallbackData,
      avatarFallback: null,
    };
  }

  /**
   * whatever is provided, we need to generate
   * 1. a resized avatar as we never need to show the full size avatar anywhere in the app
   * 2. a fallback avatar in case the user loses its pro (static image, even if the main avatar is animated)
   */
  // this is step 1, we generate a scaled down avatar, but keep its nature (animated or not)
  const processed = await ImageProcessor.processAvatarData(
    arrayBuffer,
    planForReupload,
    remoteChange
  );

  if (!processed) {
    throw new Error('processLocalAvatarChange: failed to process avatar');
  }

  const { mainAvatarDetails, avatarFallback } = processed;

  // sanity check the returned data
  if (mainAvatarDetails.format !== 'webp' && mainAvatarDetails.format !== 'gif') {
    throw new Error(
      'processLocalAvatarChange: we only support animated mainAvatarDetails in webp or gif after conversion'
    );
  }

  if (mainAvatarDetails.isAnimated && !avatarFallback) {
    throw new Error(
      'processLocalAvatarChange: we only support animated mainAvatarDetails with fallback after conversion'
    );
  }

  // sanity check the returned data
  if (avatarFallback && avatarFallback.format !== 'webp') {
    throw new Error(
      'processLocalAvatarChange: we only support avatarFallback in webp after conversion'
    );
  }

  if (processed.mainAvatarDetails.size >= MAX_ATTACHMENT_FILESIZE_BYTES) {
    throw new Error('Provided image is too big after conversion. Please use another image.');
  }

  return processed;
}
