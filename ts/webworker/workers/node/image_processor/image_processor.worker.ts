import sharp from 'sharp';
import type { ImageProcessorWorkerActions, MainAvatarType } from './image_processor';
/* eslint-disable no-console */
/* eslint-disable strict */

const DEBUG_IMAGE_PROCESSOR_WORKER = true;

onmessage = async (e: any) => {
  const [jobId, fnName, ...args] = e.data;

  try {
    const fn = (functions as any)[fnName];
    if (!fn) {
      throw new Error(`Worker: job ${jobId} did not find function ${fnName}`);
    }
    if (DEBUG_IMAGE_PROCESSOR_WORKER) {
      console.log(`[imageProcessorWorker] ${fnName} called with args:`, ...args);
    }
    const result = await fn(...args);
    postMessage([jobId, null, result]);
  } catch (error) {
    const errorForDisplay = prepareErrorForPostMessage(error);
    postMessage([jobId, errorForDisplay]);
  }
};

function prepareErrorForPostMessage(error: any) {
  if (!error) {
    return null;
  }

  if (error.stack) {
    return error.stack;
  }

  return error.message;
}

function isAnimated(metadata: sharp.Metadata) {
  return (metadata.pages || 0) > 1; // more than 1 frame means that the image is animated
}

const extractFirstFrameJpeg: ImageProcessorWorkerActions['extractFirstFrameJpeg'] =
  async inputBuffer => {
    if (!inputBuffer?.byteLength) {
      throw new Error('inputBuffer is required');
    }
    const inputMetadata = await sharp(new Uint8Array(inputBuffer)).metadata();

    if (!inputMetadata.size) {
      throw new Error('extractFirstFrameJpeg: Could not get size of the output jpeg');
    }

    if (!isAnimated(inputMetadata)) {
      throw new Error('extractFirstFrameJpeg: input is not animated');
    }

    const parsed = sharp(new Uint8Array(inputBuffer), { pages: 1 }).rotate();
    const jpeg = parsed.jpeg();
    const outputBuffer = await jpeg.toBuffer();
    const outputMetadata = await sharp(new Uint8Array(outputBuffer)).metadata();

    if (!outputMetadata.size) {
      throw new Error('extractFirstFrameJpeg: Could not get size of the output jpeg');
    }

    if (isAnimated(outputMetadata)) {
      throw new Error('extractFirstFrameJpeg: outputMetadata cannot be animated');
    }

    return {
      outputBuffer: outputBuffer.buffer,
      width: outputMetadata.width,
      height: outputMetadata.height,
      size: outputMetadata.size,
      format: outputMetadata.format,
    };
  };

const processLocalAvatarChange: ImageProcessorWorkerActions['processLocalAvatarChange'] = async (
  inputBuffer: ArrayBufferLike,
  maxSidePx: number
) => {
  if (!inputBuffer?.byteLength) {
    throw new Error('processLocalAvatarChange: inputBuffer is required');
  }
  const start = Date.now();

  const metadata = await sharp(new Uint8Array(inputBuffer), { animated: true }).metadata();

  const avatarIsAnimated = isAnimated(metadata);

  if (avatarIsAnimated && metadata.format !== 'webp' && metadata.format !== 'gif') {
    throw new Error('processLocalAvatarChange: we only support animated images in webp or gif');
  }

  // generate a square image of the avatar, scaled down or up to `maxSide`

  const resized = sharp(new Uint8Array(inputBuffer), { animated: true })
    .resize({
      height: maxSidePx,
      width: maxSidePx,
      position: 'center', // default
      fit: 'cover', // cover as we want the image to be cropped on the sides if needed, but take the full maxSide
    })
    .rotate();

  // we know the avatar is animated and gif or webp, force it to webp for performance reasons
  if (avatarIsAnimated) {
    resized.webp({ quality: 80, effort: 4 });
  } else {
    resized.jpeg({ quality: 80 });
  }

  const resizedBuffer = await resized.toBuffer();

  // Note: we need to use the resized buffer here, not the original one,
  // as metadata is always linked to the source buffer (even if a resize() is done before the metadata() call)
  const resizedMetadata = await sharp(resizedBuffer).metadata(); // rotate() is done as part of resized above

  if (!resizedMetadata.size) {
    throw new Error('processLocalAvatarChange: Could not get size of the resized image');
  }

  if (DEBUG_IMAGE_PROCESSOR_WORKER) {
    console.log(
      `[imageProcessorWorker] processLocalAvatarChange mainAvatar resize took ${Date.now() - start}ms for ${inputBuffer.byteLength} bytes`
    );
  }

  const resizedIsAnimated = isAnimated(resizedMetadata);
  const mainAvatarDetails = {
    outputBuffer: resizedBuffer.buffer,
    height: resizedMetadata.height,
    width: resizedMetadata.width,
    isAnimated: resizedIsAnimated,
    format: resizedMetadata.format,
    size: resizedMetadata.size,
  };
  let avatarFallback = null;

  if (resizedIsAnimated) {
    // also extract the first frame of the resized (animated) avatar
    const firstFrameBuffer = await extractFirstFrameJpeg(resizedBuffer.buffer);

    avatarFallback = {
      outputBuffer: firstFrameBuffer.outputBuffer,
      height: firstFrameBuffer.height,
      width: firstFrameBuffer.width,
      format: firstFrameBuffer.format,
      size: firstFrameBuffer.size,
    };
  }

  if (DEBUG_IMAGE_PROCESSOR_WORKER) {
    console.log(
      `[imageProcessorWorker] processLocalAvatarChange sizes: main: ${mainAvatarDetails.size} bytes, fallback: ${avatarFallback ? avatarFallback.size : 0} bytes`
    );
  }

  return { mainAvatarDetails, avatarFallback };
};

const testIntegrationFakeAvatar: ImageProcessorWorkerActions['testIntegrationFakeAvatar'] = async (
  maxSidePx: number,
  background: { r: number; g: number; b: number }
) => {
  const created = sharp({
    create: {
      width: maxSidePx,
      height: maxSidePx,
      channels: 3, // RGB
      background,
    },
  }).jpeg({ quality: 90 });

  const createdBuffer = await created.toBuffer();
  const createdMetadata = await sharp(createdBuffer).metadata(); // rotate() is done as part of resized above

  if (!createdMetadata.size) {
    throw new Error('testIntegrationFakeAvatar: Could not get size of the createdBuffer image');
  }

  const mainAvatarDetails: MainAvatarType = {
    outputBuffer: createdBuffer.buffer,
    height: createdMetadata.height,
    width: createdMetadata.width,
    isAnimated: false,
    format: createdMetadata.format,
    size: createdMetadata.size,
  };

  return mainAvatarDetails;
};

const processForLinkPreviewThumbnail: ImageProcessorWorkerActions['processForLinkPreviewThumbnail'] =
  async (inputBuffer: ArrayBufferLike, maxSidePx: number) => {
    if (!inputBuffer?.byteLength) {
      throw new Error('processForLinkPreviewThumbnail: inputBuffer is required');
    }

    const parsed = sharp(new Uint8Array(inputBuffer), { animated: false }).rotate();
    const metadata = await parsed.metadata();

    if (!metadata.size) {
      throw new Error('processForLinkPreviewThumbnail: Could not get size of the input');
    }

    const resized = parsed.resize({
      height: maxSidePx,
      width: maxSidePx,
      position: 'center', // default
      fit: 'cover', // cover as we want the image to be cropped on the sides if needed, but take the full maxSide
    });

    const resizedBuffer = await resized.toBuffer();
    const resizedMetadata = await sharp(resizedBuffer).metadata();

    if (!resizedMetadata.size) {
      throw new Error('processForLinkPreviewThumbnail: Could not get size of the resized image');
    }

    return {
      outputBuffer: resizedBuffer.buffer,
      height: resizedMetadata.height,
      width: resizedMetadata.width,
      format: resizedMetadata.format,
      size: resizedMetadata.size,
    };
  };

const imageMetadata: ImageProcessorWorkerActions['imageMetadata'] = async inputBuffer => {
  if (!inputBuffer?.byteLength) {
    throw new Error('imageMetadata: inputBuffer is required');
  }

  const parsed = sharp(new Uint8Array(inputBuffer), { animated: true }).rotate();
  const metadata = await parsed.metadata();

  if (!metadata.size) {
    throw new Error('imageMetadata: Could not get size of the input');
  }

  return {
    size: metadata.size,
    format: metadata.format,
    width: metadata.width,
    height: metadata.height,
    isAnimated: isAnimated(metadata),
  };
};

const functions = {
  extractFirstFrameJpeg,
  imageMetadata,
  processLocalAvatarChange,
  testIntegrationFakeAvatar,
  processForLinkPreviewThumbnail,
};
