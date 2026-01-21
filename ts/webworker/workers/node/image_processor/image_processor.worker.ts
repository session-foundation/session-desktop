import { isBuffer, isEmpty, isFinite, isNumber } from 'lodash';
import sharp from 'sharp';
import type {
  ImageProcessorWorkerActions,
  StaticOutputType,
  WithWebpFormat,
} from './image_processor';
/* eslint-disable no-console */
/* eslint-disable strict */

const DEBUG_IMAGE_PROCESSOR_WORKER = !isEmpty(process.env.DEBUG_IMAGE_PROCESSOR_WORKER);

function logIfOn(...args: Array<any>) {
  if (DEBUG_IMAGE_PROCESSOR_WORKER) {
    console.log(...args);
  }
}

/**
 * iOS allows 5 seconds for converting images, and 2s for resizing.
 * We can't separate those two without making addition copies, so we use a timeout of 7s.
 */
const defaultTimeoutProcessingSeconds = 7;

/**
 * This is the default of sharp, but better to have it explicit in case they (or we) want to change it.
 */
const webpDefaultQuality = 80;

/**
 * Duplicated to be used in the worker environment
 */
const maxAvatarDetails = {
  /**
   * 600 px
   */
  maxSidePlanReupload: 600,
  /**
   * 200 px
   */
  maxSideNoReuploadRequired: 200,
};

onmessage = async (e: any) => {
  const [jobId, fnName, ...args] = e.data;

  try {
    const fn = (workerActions as any)[fnName];
    if (!fn) {
      throw new Error(`Worker: job ${jobId} did not find function ${fnName}`);
    }
    logIfOn(`[imageProcessorWorker] ${fnName}() called with:`, ...args);

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

function metadataSizeIsSetOrThrow(metadata: sharp.Metadata, identifier: string) {
  if (!isNumber(metadata.size) || !isFinite(metadata.size)) {
    throw new Error(`assertMetadataSizeIsSet: ${identifier} metadata.size is not set`);
  }

  return metadata.size;
}

function isAnimated(metadata: sharp.Metadata) {
  return (metadata.pages || 0) > 1; // more than 1 frame means that the image is animated
}

function centerCoverOpts({
  maxSidePx,
  withoutEnlargement,
}: {
  maxSidePx: number;
  withoutEnlargement: boolean;
}) {
  return {
    height: maxSidePx,
    width: maxSidePx,
    fit: 'cover' as const, // a thumbnail we generate should contain the source image
    withoutEnlargement,
  };
}

function formattedMetadata(metadata: {
  width: number | undefined;
  height: number | undefined;
  format: keyof sharp.FormatEnum;
  size: number;
}) {
  return `(${metadata.width}x${metadata.height}, format:${String(metadata.format)}  of ${metadata.size} bytes)`;
}

function sharpFrom(inputBuffer: ArrayBufferLike | Buffer, options?: sharp.SharpOptions) {
  if (inputBuffer instanceof Buffer) {
    return sharp(inputBuffer, options).rotate();
  }

  if (inputBuffer instanceof SharedArrayBuffer) {
    const arrayBuffer = inputBuffer.slice(0);
    return sharp(new Uint8Array(arrayBuffer), options).rotate();
  }

  return sharp(new Uint8Array(inputBuffer), options).rotate();
}

function metadataToFrameHeight(metadata: sharp.Metadata) {
  const frameCount = Math.max(metadata.pages || 0, 1);
  const frameHeight =
    metadata.height && frameCount ? metadata.height / frameCount : metadata.height;
  return frameHeight;
}

/**
 * Wrapper around `sharp.metadata` as it throws if not a valid image, and we usually
 * want to just return null.
 *
 * Note: this will also orient a jpeg if needed. (i.e. calls rotate() through sharpFrom)
 * Note: metadata height will be set to the frame height, not the full height
 * of the canvas (as sharp.metadata does with animated webp)
 */
async function metadataFromBuffer(
  inputBuffer: ArrayBufferLike | Buffer,
  rethrow = false,
  options?: sharp.SharpOptions
) {
  // Note: this might throw and we want to allow the error to be forwarded to the user if that happens.
  // A toast will display the error
  try {
    const metadata = await sharpFrom(inputBuffer, options).metadata();
    const frameHeight = metadataToFrameHeight(metadata);
    return { ...metadata, height: frameHeight };
  } catch (e) {
    if (rethrow) {
      throw e;
    }
    return null;
  }
}

async function extractFirstFrameWebp(
  inputBuffer: ArrayBufferLike
): Promise<(StaticOutputType & WithWebpFormat) | null> {
  if (!inputBuffer?.byteLength) {
    throw new Error('inputBuffer is required');
  }
  const inputMetadata = await metadataFromBuffer(inputBuffer);
  if (!inputMetadata) {
    return null;
  }

  metadataSizeIsSetOrThrow(inputMetadata, 'extractFirstFrameWebp');

  if (!isAnimated(inputMetadata)) {
    throw new Error('extractFirstFrameWebp: input is not animated');
  }

  const webp = sharpFrom(inputBuffer, { pages: 1 })
    .resize(
      centerCoverOpts({
        // Note: the extracted avatar fallback is never used for reupload
        maxSidePx: maxAvatarDetails.maxSideNoReuploadRequired,
        withoutEnlargement: true,
      })
    )
    .webp({ quality: webpDefaultQuality });

  const outputBuffer = await webp.toBuffer();
  const outputMetadata = await metadataFromBuffer(outputBuffer);
  if (!outputMetadata) {
    return null;
  }

  const outputMetadataSize = metadataSizeIsSetOrThrow(outputMetadata, 'extractFirstFrameWebp');

  if (isAnimated(outputMetadata)) {
    throw new Error('extractFirstFrameWebp: outputMetadata cannot be animated');
  }

  return {
    outputBuffer: outputBuffer.buffer,
    width: outputMetadata.width,
    height: outputMetadata.height, // this one is only the frame height already, no need for `metadataToFrameHeight`
    size: outputMetadataSize,
    format: 'webp' as const,
    contentType: 'image/webp' as const,
  };
}

async function extractAvatarFallback({
  resizedBuffer,
  avatarIsAnimated,
}: {
  resizedBuffer: ArrayBufferLike;
  avatarIsAnimated: boolean;
}) {
  if (!avatarIsAnimated) {
    return null;
  }
  const firstFrameWebp = await extractFirstFrameWebp(resizedBuffer);
  if (!firstFrameWebp) {
    throw new Error('extractAvatarFallback: failed to extract first frame as webp');
  }
  // the fallback (static image out of an animated one) is always a webp
  const fallbackFormat = 'webp' as const;

  if (
    firstFrameWebp.height > maxAvatarDetails.maxSideNoReuploadRequired ||
    firstFrameWebp.width > maxAvatarDetails.maxSideNoReuploadRequired
  ) {
    throw new Error(
      'extractAvatarFallback: fallback image is too big. Have you provided the correct resizedBuffer?'
    );
  }

  return {
    outputBuffer: firstFrameWebp.outputBuffer,
    height: firstFrameWebp.height, // this one is only the frame height already. No need for `metadataToFrameHeight`
    width: firstFrameWebp.width,
    format: fallbackFormat,
    contentType: `image/${fallbackFormat}` as const,
    size: firstFrameWebp.size,
  };
}

async function extractMainAvatarDetails({
  isSourceGif,
  planForReupload,
  resizedBuffer,
  resizedMetadata,
}: {
  resizedBuffer: ArrayBufferLike;
  resizedMetadata: sharp.Metadata;
  planForReupload: boolean;
  isSourceGif: boolean;
}) {
  const resizedIsAnimated = isAnimated(resizedMetadata);
  const resizedMetadataSize = metadataSizeIsSetOrThrow(resizedMetadata, 'extractMainAvatarDetails');

  return {
    outputBuffer: resizedBuffer,
    height: resizedMetadata.height,
    width: resizedMetadata.width,
    isAnimated: resizedIsAnimated,
    format: planForReupload && isSourceGif ? ('gif' as const) : ('webp' as const),
    contentType: planForReupload && isSourceGif ? ('image/gif' as const) : ('image/webp' as const),
    size: resizedMetadataSize,
  };
}

async function sleepFor(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

async function processPlanForReuploadAvatar({
  inputBuffer,
  remoteChange,
}: {
  inputBuffer: ArrayBufferLike;
  remoteChange: boolean;
}) {
  const start = Date.now();

  const metadata = await metadataFromBuffer(inputBuffer, true, { animated: true });
  if (!metadata) {
    return null;
  }

  /**
   * This is not pretty, but when we download our own avatar from the network and we didn't set it locally,
   * we need to make sure a reupload will be planned if required.
   * What this means is that, if we get an avatar of size 640 from the network we should plan for a reupload.
   * But, if we resize it here to 600, the AvatarReuploadJob will be skipped as the avatar is already the correct size.
   * As a hack, we add 1 pixel to the size required when this is a remote change, so that the AvatarReuploadJob will be triggered.
   *
   * Note: We do not upscale the file if it's already smaller than 600px, so a reupload won't be triggered if a device set an avatar to 600 already.
   */
  const sizeRequired = remoteChange
    ? maxAvatarDetails.maxSidePlanReupload + 1
    : maxAvatarDetails.maxSidePlanReupload;
  const avatarIsAnimated = isAnimated(metadata);

  if (avatarIsAnimated && metadata.format !== 'webp' && metadata.format !== 'gif') {
    throw new Error('processPlanForReuploadAvatar: we only support animated images in webp or gif');
  }

  // When planning for reupload, the rules about gif/webp are quite different that when not planning for reupload.
  // Essentially, we want to try to resize a gif to webp, but if it takes too long or the resulting file size is too big, we will just use the original gif.
  const isSourceGif = metadata.format === 'gif';
  if (
    metadata.width <= sizeRequired &&
    metadata.height <= sizeRequired &&
    metadata.format === 'webp'
  ) {
    // It appears this avatar is already small enough and of the correct format, so we don't want to resize it.
    // We still want to extract the first frame of the animated avatar, if it is animated though.

    // also extract the first frame of the resized (animated) avatar
    const avatarFallback = await extractAvatarFallback({
      resizedBuffer: inputBuffer,
      avatarIsAnimated,
    });
    const mainAvatarDetails = await extractMainAvatarDetails({
      resizedBuffer: inputBuffer, // we can just reuse the input buffer here as the dimensions and format are correct
      resizedMetadata: metadata,
      planForReupload: true,
      isSourceGif,
    });

    logIfOn(
      `[imageProcessorWorker] processPlanForReuploadAvatar sizes (already correct sizes & format): main: ${inputBuffer.byteLength} bytes, fallback: ${avatarFallback ? avatarFallback.size : 0} bytes`
    );

    return {
      mainAvatarDetails,
      avatarFallback,
    };
  }
  const resizeOpts = centerCoverOpts({
    maxSidePx: sizeRequired,
    withoutEnlargement: true,
  });

  let awaited: any;
  // if the avatar was animated, we want an animated webp.
  // if it was static, we want a static webp.
  if (isSourceGif) {
    logIfOn(
      `[imageProcessorWorker] src is gif, trying to convert to webp with timeout of ${defaultTimeoutProcessingSeconds}s`
    );
    // See the comment in image_processor.d.ts:
    // We want to try to convert a gif to webp, but if it takes too long or the resulting file size is too big, we will just use the original gif.
    awaited = await Promise.race([
      sharpFrom(inputBuffer, { animated: true }).resize(resizeOpts).webp().toBuffer(),
      sleepFor(defaultTimeoutProcessingSeconds * 1000), // it seems that timeout is not working as expected in sharp --'
    ]);
    if (awaited && isBuffer(awaited)) {
      logIfOn(
        `[imageProcessorWorker] processPlanForReuploadAvatar: gif conversion took ${Date.now() - start}ms for ${awaited.byteLength} bytes`
      );
    } else {
      logIfOn(`[imageProcessorWorker] processPlanForReuploadAvatar: gif conversion failed`);
    }
  } else {
    // when not planning for reupload, we always want a webp, and no timeout for that
    awaited = await sharpFrom(inputBuffer, { animated: true })
      .resize(resizeOpts)
      .webp({ quality: webpDefaultQuality })
      .toBuffer();
    logIfOn(
      `[imageProcessorWorker] always webp conversion took ${Date.now() - start}ms for ${awaited.byteLength} bytes`
    );
  }

  if (isSourceGif && (!isBuffer(awaited) || awaited.byteLength > inputBuffer.byteLength)) {
    logIfOn(
      `[imageProcessorWorker] isSourceGif & gif conversion failed, using original gif without resize`
    );
    // we failed to process the gif fast enough, or the resulting webp is bigger than the original gif. Fallback to the original gif.
    awaited = Buffer.from(inputBuffer);
  }

  if (!isBuffer(awaited)) {
    throw new Error('Image processing failed for an unknown reason');
  }

  const resizedBuffer = awaited as Buffer;

  // Note: we need to use the resized buffer here, not the original one,
  // as metadata is always linked to the source buffer (even if a resize() is done before the metadata call)
  const resizedMetadata = await metadataFromBuffer(resizedBuffer);

  if (!resizedMetadata) {
    return null;
  }

  const resizedMetadataSize = metadataSizeIsSetOrThrow(
    resizedMetadata,
    'processPlanForReuploadAvatar'
  );

  logIfOn(
    `[imageProcessorWorker] processPlanForReuploadAvatar mainAvatar resize took ${Date.now() - start}ms for ${inputBuffer.byteLength} bytes`
  );

  const resizedIsAnimated = isAnimated(resizedMetadata);

  // also extract the first frame of the resized (animated) avatar
  const avatarFallback = await extractAvatarFallback({
    resizedBuffer: resizedBuffer.buffer,
    avatarIsAnimated: resizedIsAnimated,
  });

  logIfOn(
    `[imageProcessorWorker] processPlanForReuploadAvatar sizes: main: ${resizedMetadataSize} bytes, fallback: ${avatarFallback ? avatarFallback.size : 0} bytes`
  );
  const mainAvatarDetails = await extractMainAvatarDetails({
    resizedBuffer: resizedBuffer.buffer,
    resizedMetadata,
    planForReupload: true,
    isSourceGif,
  });

  return {
    mainAvatarDetails,
    avatarFallback,
  };
}

async function processNoPlanForReuploadAvatar({ inputBuffer }: { inputBuffer: ArrayBufferLike }) {
  const start = Date.now();
  const sizeRequired = maxAvatarDetails.maxSideNoReuploadRequired;
  const metadata = await metadataFromBuffer(inputBuffer, false, { animated: true });

  if (!metadata) {
    return null;
  }
  const avatarIsAnimated = isAnimated(metadata);

  if (avatarIsAnimated && metadata.format !== 'webp' && metadata.format !== 'gif') {
    throw new Error(
      'processNoPlanForReuploadAvatar: we only support animated images in webp or gif'
    );
  }
  // Not planning for reupload. We always generate a webp instead for the main avatar.
  if (
    metadata.width <= sizeRequired &&
    metadata.height <= sizeRequired &&
    metadata.format === 'webp'
  ) {
    // It appears this avatar is already small enough and of the correct format, so we don't want to resize it.
    // We still want to extract the first frame of the animated avatar, if it is animated though.

    // also extract the first frame of the resized (animated) avatar
    const avatarFallback = await extractAvatarFallback({
      resizedBuffer: inputBuffer,
      avatarIsAnimated,
    });
    const mainAvatarDetails = await extractMainAvatarDetails({
      resizedBuffer: inputBuffer, // we can just reuse the input buffer here as the dimensions and format are correct
      resizedMetadata: metadata,
      planForReupload: false,
      isSourceGif: false,
    });

    logIfOn(
      `[imageProcessorWorker] processNoPlanForReuploadAvatar sizes (already correct sizes): main: ${inputBuffer.byteLength} bytes, fallback: ${avatarFallback ? avatarFallback.size : 0} bytes`
    );

    return {
      mainAvatarDetails,
      avatarFallback,
    };
  }

  // generate a square image of the avatar, scaled down or up to `maxSide`
  const resized = sharpFrom(inputBuffer, { animated: true }).resize(
    centerCoverOpts({
      maxSidePx: sizeRequired,
      withoutEnlargement: true,
    })
  );

  // when not planning for reupload, we always want a webp for the main avatar (and we do not care about how long that takes)
  const resizedBuffer = await resized.webp({ quality: webpDefaultQuality }).toBuffer();

  // Note: we need to use the resized buffer here, not the original one,
  // as metadata is always linked to the source buffer (even if a resize() is done before the metadata call)
  const resizedMetadata = await metadataFromBuffer(resizedBuffer);

  if (!resizedMetadata) {
    return null;
  }

  const resizedMetadataSize = metadataSizeIsSetOrThrow(
    resizedMetadata,
    'processNoPlanForReuploadAvatar'
  );

  logIfOn(
    `[imageProcessorWorker] processNoPlanForReuploadAvatar mainAvatar resize took ${Date.now() - start}ms for ${inputBuffer.byteLength} bytes`
  );

  const resizedIsAnimated = isAnimated(resizedMetadata);

  // also extract the first frame of the resized (animated) avatar
  const avatarFallback = await extractAvatarFallback({
    resizedBuffer: resizedBuffer.buffer,
    avatarIsAnimated: resizedIsAnimated,
  });

  logIfOn(
    `[imageProcessorWorker] processNoPlanForReuploadAvatar sizes: main: ${resizedMetadataSize} bytes, fallback: ${avatarFallback ? avatarFallback.size : 0} bytes`
  );
  const mainAvatarDetails = await extractMainAvatarDetails({
    resizedBuffer: resizedBuffer.buffer,
    resizedMetadata,
    planForReupload: false,
    isSourceGif: false, // we always generate a webp here so we do not care if the src was a gif.
  });

  return {
    mainAvatarDetails,
    avatarFallback,
  };
}

const workerActions: ImageProcessorWorkerActions = {
  imageMetadata: async inputBuffer => {
    if (!inputBuffer?.byteLength) {
      throw new Error('imageMetadata: inputBuffer is required');
    }

    const metadata = await metadataFromBuffer(inputBuffer, false, { animated: true });

    if (!metadata) {
      return null;
    }

    const metadataSize = metadataSizeIsSetOrThrow(metadata, 'imageMetadata');

    return {
      size: metadataSize,
      format: metadata.format,
      width: metadata.width,
      height: metadata.height,
      isAnimated: isAnimated(metadata),
    };
  },

  processAvatarData: async (
    inputBuffer: ArrayBufferLike,
    planForReupload: boolean,
    remoteChange: boolean
  ) => {
    if (!inputBuffer?.byteLength) {
      throw new Error('processAvatarData: inputBuffer is required');
    }

    if (planForReupload) {
      return await processPlanForReuploadAvatar({ inputBuffer, remoteChange });
    }
    return await processNoPlanForReuploadAvatar({ inputBuffer });
  },

  testIntegrationFakeAvatar: async (
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
    }).webp({ quality: webpDefaultQuality });

    const createdBuffer = await created.toBuffer();
    const createdMetadata = await metadataFromBuffer(createdBuffer);

    if (!createdMetadata) {
      // Note: throwing here is fine, as we control the source buffer
      throw new Error('testIntegrationFakeAvatar: failed to get metadata');
    }

    const size = metadataSizeIsSetOrThrow(createdMetadata, 'testIntegrationFakeAvatar');

    const format = 'webp' as const;
    return {
      outputBuffer: createdBuffer.buffer,
      height: createdMetadata.height, // this one is only the frame height already, no need for `metadataToFrameHeight`
      width: createdMetadata.width,
      isAnimated: false,
      format,
      contentType: `image/${format}` as const,
      size,
    };
  },

  processForLinkPreviewThumbnail: async (inputBuffer: ArrayBufferLike, maxSidePx: number) => {
    if (!inputBuffer?.byteLength) {
      throw new Error('processForLinkPreviewThumbnail: inputBuffer is required');
    }

    const parsed = sharpFrom(inputBuffer, { animated: false });
    const metadata = await metadataFromBuffer(inputBuffer, false, { animated: false });

    if (!metadata) {
      return null;
    }

    metadataSizeIsSetOrThrow(metadata, 'processForLinkPreviewThumbnail');

    // for thumbnail, we actually want to enlarge the image if required
    const resized = parsed.resize(centerCoverOpts({ maxSidePx, withoutEnlargement: false }));

    const resizedBuffer = await resized.webp({ quality: webpDefaultQuality }).toBuffer();
    const resizedMetadata = await metadataFromBuffer(resizedBuffer);

    if (!resizedMetadata) {
      return null;
    }

    const resizedSize = metadataSizeIsSetOrThrow(resizedMetadata, 'processForLinkPreviewThumbnail');

    const format = 'webp' as const;

    return {
      outputBuffer: resizedBuffer.buffer,
      height: resizedMetadata.height,
      width: resizedMetadata.width,
      format,
      contentType: `image/${format}` as const,
      size: resizedSize,
    };
  },

  processForInConversationThumbnail: async (inputBuffer: ArrayBufferLike, maxSidePx: number) => {
    if (!inputBuffer?.byteLength) {
      throw new Error('processForInConversationThumbnail: inputBuffer is required');
    }

    // Note: this `animated` is false here because we want to force a static image (so no need to extract all the frames)
    const parsed = sharpFrom(inputBuffer, { animated: false }).resize(
      centerCoverOpts({ maxSidePx, withoutEnlargement: false }) // We actually want to enlarge the image if required for a thumbnail in conversation
    );
    const metadata = await metadataFromBuffer(inputBuffer, false, { animated: false });

    if (!metadata) {
      return null;
    }

    const animated = isAnimated(metadata);

    const awaited = await Promise.race([
      parsed.webp({ quality: webpDefaultQuality }).toBuffer(),
      sleepFor(defaultTimeoutProcessingSeconds * 1000), // it seems that timeout is not working as expected in sharp --'
    ]);

    if (!isBuffer(awaited)) {
      throw new Error('Image processing timed out');
    }

    const resizedBuffer = awaited as Buffer;
    const resizedMetadata = await metadataFromBuffer(resizedBuffer);

    if (!resizedMetadata) {
      return null;
    }

    const size = metadataSizeIsSetOrThrow(resizedMetadata, 'processForInConversationThumbnail');

    const formatDetails = { format: 'webp' as const, contentType: 'image/webp' as const };

    return {
      outputBuffer: resizedBuffer.buffer,
      height: resizedMetadata.height,
      width: resizedMetadata.width,
      ...formatDetails,
      size,
      isAnimated: animated,
    };
  },

  processForFileServerUpload: async (
    inputBuffer: ArrayBufferLike,
    maxSidePx: number,
    maxSizeBytes: number
  ) => {
    if (!inputBuffer?.byteLength) {
      throw new Error('processForFileServerUpload: inputBuffer is required');
    }
    const lossyFormats = ['jpeg', 'webp', 'avif'];
    const start = Date.now();
    const metadata = await metadataFromBuffer(inputBuffer, false);

    if (
      !metadata ||
      !metadata.format ||
      !sharp.format[metadata.format]?.output ||
      !metadata.width ||
      !metadata.height
    ) {
      logIfOn(`Unsupported format: ${metadata?.format}`);
      return null;
    }

    const animated = isAnimated(metadata);

    const isLossyFormat = lossyFormats.includes(metadata.format);

    // Note: this will resize
    const isLossyFormatButFits =
      isLossyFormat &&
      inputBuffer.byteLength < maxSizeBytes &&
      metadata.width <= maxSidePx &&
      metadata.height <= maxSidePx;

    // If the image is lossy but fits in the max size, we can just return it as is.
    // This is to speed up large image additions to the staged attachments list.
    if (isLossyFormatButFits) {
      const size = metadataSizeIsSetOrThrow(metadata, 'processForFileServerUpload');
      logIfOn(
        `isLossyFormatButFits: returning buffer of size ${size} and WxH: ${metadata.width}x${metadata.height}`
      );

      return {
        format: metadata.format,
        outputBuffer: inputBuffer,
        size,
        width: metadata.width,
        height: metadata.height, // this one is only the frame height already, no need for `metadataToFrameHeight`
        isAnimated: isAnimated(metadata),
      };
    }

    // If image is lossless, we cannot adjust the quality and we assume we don't want to scale it down either (as it can be slow)
    // so just return the source buffer
    if (!isLossyFormat) {
      if (inputBuffer.byteLength >= maxSizeBytes) {
        logIfOn(`not lossy format and does not fit`);

        return null;
      }

      const size = metadataSizeIsSetOrThrow(metadata, 'processForFileServerUpload');
      logIfOn(
        `not lossy format but fits, returning buffer of size ${size} and WxH: ${metadata.width}x${metadata.height}`
      );

      return {
        format: metadata.format,
        outputBuffer: inputBuffer,
        size,
        width: metadata.width,
        height: metadata.height, // this one is only the frame height already, no need for `metadataToFrameHeight`
        isAnimated: isAnimated(metadata),
      };
    }

    const base = sharpFrom(inputBuffer, { animated }).rotate();

    // Resize if needed
    if (metadata.width > maxSidePx || metadata.height > maxSidePx) {
      base.resize({
        width: maxSidePx,
        height: maxSidePx,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // if we can't get a picture with a quality of more than 30, consider it a failure and return null
    const qualityRange = [95, 85, 75, 55, 30] as const;
    for (const quality of qualityRange) {
      const pipeline = base.clone();

      switch (metadata.format) {
        case 'jpeg':
          pipeline.jpeg({ quality });
          break;
        case 'webp':
          pipeline.webp({ quality });
          break;
        case 'avif':
          pipeline.avif({ quality });
          break;
        default:
          throw new Error(`Unsupported format: ${metadata.format}`);
      }

      // eslint-disable-next-line no-await-in-loop
      const buffer = await pipeline.toBuffer(); // no timeout here for now

      if (buffer.length < maxSizeBytes) {
        // eslint-disable-next-line no-await-in-loop
        const outputMetadata = await metadataFromBuffer(buffer, false);

        if (!outputMetadata) {
          return null;
        }

        const size = metadataSizeIsSetOrThrow(outputMetadata, 'processForFileServerUpload');
        logIfOn(
          `[imageProcessorWorker] processForFileServerUpload: DONE quality ${quality} took ${
            Date.now() - start
          }ms for}`
        );
        logIfOn(
          `\t src${formattedMetadata({ width: metadata.width, height: metadata.height, format: metadata.format, size: inputBuffer.byteLength })} `
        );
        logIfOn(
          `\t dest${formattedMetadata({ width: outputMetadata.width, height: outputMetadata.height, format: metadata.format, size: buffer.buffer.byteLength })} `
        );

        return {
          format: outputMetadata.format,
          outputBuffer: buffer.buffer,
          size,
          width: outputMetadata.width,
          height: outputMetadata.height, // this one is only the frame height already, no need for `metadataToFrameHeight`
          isAnimated: isAnimated(outputMetadata),
        };
      }
      logIfOn(
        `[imageProcessorWorker] processForFileServerUpload: took so far ${
          Date.now() - start
        }ms with quality ${quality}`
      );
      logIfOn(
        `\t src${formattedMetadata({ width: metadata.width, height: metadata.height, format: metadata.format, size: inputBuffer.byteLength })} `
      );
    }

    logIfOn(
      `[imageProcessorWorker] processForFileServerUpload: failed to get a buffer of size ${maxSizeBytes} for ${inputBuffer.byteLength} bytes for image of ${metadata.width}x${metadata.height} with format ${metadata.format}`
    );
    logIfOn(
      `[imageProcessorWorker] processForFileServerUpload: failed after ${Date.now() - start}ms`
    );
    logIfOn(
      `\t src${formattedMetadata({ width: metadata.width, height: metadata.height, format: metadata.format, size: inputBuffer.byteLength })} `
    );

    return null;
  },
};
