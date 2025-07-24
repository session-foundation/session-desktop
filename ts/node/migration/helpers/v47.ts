import { isFinite, isNumber } from 'lodash';
import sharp from 'sharp';

/**
 * NOTE: this is not pretty, but it is the only to guarantee that will be run to migrate the existing avatars.
 * With migration 47, we need to extract the first frame of the animated avatar to generate a fallback avatar.
 *
 * This file is mostly a copy and paste
 * of `ts/webworker/workers/node/image_processor/image_processor.worker.ts` as of today, but again
 * we need to duplicate it to guarantee migration 47 will run today, but also when `image_processor.worker.ts` is changed.
 *
 */

const DEBUG_IMAGE_PROCESSOR_MIGRATION_V47 = true;

function logIfOn(...args: Array<any>) {
  if (DEBUG_IMAGE_PROCESSOR_MIGRATION_V47) {
    console.log(...args);
  }
}

function sharpFrom(inputBuffer: ArrayBufferLike | Buffer, options?: sharp.SharpOptions) {
  if (inputBuffer instanceof Buffer) {
    return sharp(inputBuffer, options).rotate();
  }
  return sharp(new Uint8Array(inputBuffer), options).rotate();
}

function isAnimated(metadata: sharp.Metadata) {
  return (metadata.pages || 0) > 1; // more than 1 frame means that the image is animated
}

async function metadataFromBuffer(
  inputBuffer: ArrayBufferLike | Buffer,
  options?: sharp.SharpOptions
) {
  try {
    const metadata = await sharpFrom(inputBuffer, options).metadata();
    // we do need the await above so the try/catch does its job
    return metadata;
  } catch (e) {
    console.info('metadataFromBuffer failed with', e.message);
    return null;
  }
}

function centerCoverOpts(maxSidePx: number) {
  return {
    height: maxSidePx,
    width: maxSidePx,
    fit: 'cover' as const, // a thumbnail we generate should contain the source image
  };
}

function metadataSizeIsSetOrThrow(metadata: sharp.Metadata, identifier: string) {
  if (!isNumber(metadata.size) || !isFinite(metadata.size)) {
    throw new Error(`assertMetadataSizeIsSet: ${identifier} metadata.size is not set`);
  }

  return metadata.size;
}

async function extractFirstFrameJpeg(inputBuffer: ArrayBufferLike | Buffer) {
  if (!inputBuffer?.byteLength) {
    throw new Error('inputBuffer is required');
  }
  const inputMetadata = await metadataFromBuffer(inputBuffer);
  if (!inputMetadata) {
    return null;
  }

  metadataSizeIsSetOrThrow(inputMetadata, 'extractFirstFrameJpeg');

  if (!isAnimated(inputMetadata)) {
    throw new Error('extractFirstFrameJpeg: input is not animated');
  }

  const parsed = sharpFrom(inputBuffer, { pages: 1 });
  const jpeg = parsed.jpeg();
  const outputBuffer = await jpeg.toBuffer();
  const outputMetadata = await metadataFromBuffer(outputBuffer);
  if (!outputMetadata) {
    return null;
  }

  const outputMetadataSize = metadataSizeIsSetOrThrow(outputMetadata, 'extractFirstFrameJpeg');

  if (isAnimated(outputMetadata)) {
    throw new Error('extractFirstFrameJpeg: outputMetadata cannot be animated');
  }

  return {
    outputBuffer: outputBuffer.buffer,
    width: outputMetadata.width,
    height: outputMetadata.height,
    size: outputMetadataSize,
    format: 'jpeg' as const,
    contentType: 'image/jpeg' as const,
  };
}

async function processAvatarData(inputBuffer: ArrayBufferLike, maxSidePx: number) {
  if (!inputBuffer?.byteLength) {
    throw new Error('processAvatarData: inputBuffer is required');
  }
  const start = Date.now();

  const metadata = await metadataFromBuffer(inputBuffer, { animated: true });
  if (!metadata) {
    return null;
  }

  const avatarIsAnimated = isAnimated(metadata);

  if (avatarIsAnimated && metadata.format !== 'webp' && metadata.format !== 'gif') {
    throw new Error('processAvatarData: we only support animated images in webp or gif');
  }

  // generate a square image of the avatar, scaled down or up to `maxSide`

  const resized = sharpFrom(inputBuffer, { animated: true }).resize(centerCoverOpts(maxSidePx));

  // we know the avatar is animated and gif or webp, force it to webp for performance reasons
  if (avatarIsAnimated) {
    resized.webp();
  } else {
    resized.jpeg();
  }

  const resizedBuffer = await resized.toBuffer();

  // Note: we need to use the resized buffer here, not the original one,
  // as metadata is always linked to the source buffer (even if a resize() is done before the metadata call)
  const resizedMetadata = await metadataFromBuffer(resizedBuffer);

  if (!resizedMetadata) {
    return null;
  }

  const resizedMetadataSize = metadataSizeIsSetOrThrow(resizedMetadata, 'processAvatarData');

  logIfOn(
    `[imageProcessorWorker] processAvatarData mainAvatar resize took ${Date.now() - start}ms for ${inputBuffer.byteLength} bytes`
  );

  const resizedIsAnimated = isAnimated(resizedMetadata);

  const formatDetails = avatarIsAnimated
    ? { format: 'webp' as const, contentType: 'image/webp' as const }
    : { format: 'jpeg' as const, contentType: 'image/jpeg' as const };

  const mainAvatarDetails = {
    outputBuffer: resizedBuffer.buffer,
    height: resizedMetadata.height,
    width: resizedMetadata.width,
    isAnimated: resizedIsAnimated,
    ...formatDetails,
    size: resizedMetadataSize,
  };

  let avatarFallback = null;

  if (resizedIsAnimated) {
    // also extract the first frame of the resized (animated) avatar
    const firstFrameJpeg = await extractFirstFrameJpeg(resizedBuffer.buffer);
    if (!firstFrameJpeg) {
      throw new Error('processAvatarData: failed to extract first frame as jpeg');
    }
    const fallbackFormat = 'jpeg' as const;

    avatarFallback = {
      outputBuffer: firstFrameJpeg.outputBuffer,
      height: firstFrameJpeg.height,
      width: firstFrameJpeg.width,
      format: fallbackFormat,
      contentType: `image/${fallbackFormat}` as const,
      size: firstFrameJpeg.size,
    };
  }

  logIfOn(
    `[imageProcessorWorker] processAvatarData sizes: main: ${mainAvatarDetails.size} bytes, fallback: ${avatarFallback ? avatarFallback.size : 0} bytes`
  );

  return { mainAvatarDetails, avatarFallback };
}

export const V47 = {
  processAvatarData,
};
