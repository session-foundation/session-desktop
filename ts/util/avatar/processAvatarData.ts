import { isArrayBuffer } from 'lodash';
import { ImageProcessor } from '../../webworker/workers/browser/image_processor_interface';
import { MAX_ATTACHMENT_FILESIZE_BYTES } from '../../session/constants';

/**
 * When the current device makes a change to its avatar, or a group/communities avatar we need to process it.
 * The same applies for an incoming avatar downloaded.
 *
 * This function will create the required buffers of data, depending on the type of avatar.
 * - mainAvatarDetails will be animated (webp enforced) if the source was animated, or a jpeg of the original image
 * - avatarFallback will be an image (jpeg enforced) of the first frame of `mainAvatarDetails` if it was animated, or null
 *
 * There is a specific case for the avatars that we need to be able to reupload,
 * as we do want to keep a resolution of 600 x 600 instead of the usual 200 x 200.
 *
 * This is because we need to be able to reupload our full avatar to the file server, and mobile pixel density can be 3x.
 * We still want to reduce incoming avatars to 200 x 200 for performance reasons.
 */
export async function processAvatarData(arrayBuffer: ArrayBuffer, planForReupload: boolean) {
  if (!arrayBuffer || arrayBuffer.byteLength === 0 || !isArrayBuffer(arrayBuffer)) {
    throw new Error('processAvatarData: arrayBuffer is empty');
  }

  /**
   * whatever is provided, we need to generate
   * 1. a resized avatar as we never need to show the full size avatar anywhere in the app
   * 2. a fallback avatar in case the user looses its pro (static image, even if the main avatar is animated)
   */
  // this is step 1, we generate a scaled down avatar, but keep its nature (animated or not)
  const processed = await ImageProcessor.processAvatarData(arrayBuffer, planForReupload);

  if (!processed) {
    throw new Error('processLocalAvatarChange: failed to process avatar');
  }

  const { mainAvatarDetails, avatarFallback } = processed;

  // sanity check the returned data
  if (mainAvatarDetails.format !== 'webp' && mainAvatarDetails.format !== 'gif') {
    throw new Error(
      'processLocalAvatarChange: we only support animated mainAvatarDetails in webp after conversion'
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
      'processLocalAvatarChange: we only support avatarFallback in jpeg after conversion'
    );
  }

  if (mainAvatarDetails.size >= MAX_ATTACHMENT_FILESIZE_BYTES) {
    throw new Error(
      'processLocalAvatarChange: mainAvatarDetails size is too big after conversion (bigger than fs limit'
    );
  }

  return { mainAvatarDetails, avatarFallback };
}
