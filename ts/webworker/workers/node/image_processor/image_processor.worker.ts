import { isEmpty, isFinite, isNumber } from 'lodash';
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

const defaultTimeoutProcessingSeconds = 5;

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
 * of the canvas (as sharp.metadata does with animated webps)
 */
async function metadataFromBuffer(
  inputBuffer: ArrayBufferLike | Buffer,
  options?: sharp.SharpOptions
) {
  try {
    const metadata = await sharpFrom(inputBuffer, options).metadata();
    const frameHeight = metadataToFrameHeight(metadata);
    // we do need the await above so the try/catch does its job
    return { ...metadata, height: frameHeight };
  } catch (e) {
    console.info('metadataFromBuffer failed with', e.message);
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

  const parsed = sharpFrom(inputBuffer, { pages: 1 });
  const webp = parsed.webp();
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

const workerActions: ImageProcessorWorkerActions = {
  imageMetadata: async inputBuffer => {
    if (!inputBuffer?.byteLength) {
      throw new Error('imageMetadata: inputBuffer is required');
    }

    const metadata = await metadataFromBuffer(inputBuffer, { animated: true });

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

  processAvatarData: async (inputBuffer: ArrayBufferLike, planForReupload: boolean) => {
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

    const resized = sharpFrom(inputBuffer, { animated: true }).resize(
      centerCoverOpts({
        maxSidePx: planForReupload
          ? maxAvatarDetails.maxSidePlanReupload
          : maxAvatarDetails.maxSideNoReuploadRequired,
        withoutEnlargement: true,
      })
    );

    const isSourceGif = metadata.format === 'gif';
    // if the avatar was animated, we want an animated webp.
    // if it was static, we want a static webp.
    if (planForReupload) {
      // see the comment in image_processor.d.ts:
      // we don't want to convert gif to webp when planning for reupload
      if (isSourceGif) {
        resized.gif();
      } else {
        resized.webp();
      }
    } else {
      // when not planning for reupload, we always want a webp
      resized.webp();
    }

    const resizedBuffer = await resized
      .timeout({ seconds: defaultTimeoutProcessingSeconds })
      .toBuffer();

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

    let avatarFallback = null;

    if (resizedIsAnimated) {
      // also extract the first frame of the resized (animated) avatar
      const firstFrameWebp = await extractFirstFrameWebp(resizedBuffer.buffer);
      if (!firstFrameWebp) {
        throw new Error('processAvatarData: failed to extract first frame as webp');
      }
      const fallbackFormat = 'webp' as const;

      avatarFallback = {
        outputBuffer: firstFrameWebp.outputBuffer,
        height: firstFrameWebp.height, // this one is only the frame height already. No need for `metadataToFrameHeight`
        width: firstFrameWebp.width,
        format: fallbackFormat,
        contentType: `image/${fallbackFormat}` as const,
        size: firstFrameWebp.size,
      };
    }

    logIfOn(
      `[imageProcessorWorker] processAvatarData sizes: main: ${resizedMetadataSize} bytes, fallback: ${avatarFallback ? avatarFallback.size : 0} bytes`
    );

    return {
      mainAvatarDetails: {
        outputBuffer: resizedBuffer.buffer,
        height: resizedMetadata.height,
        width: resizedMetadata.width,
        isAnimated: resizedIsAnimated,
        format: planForReupload && isSourceGif ? 'gif' : 'webp',
        contentType: planForReupload && isSourceGif ? 'image/gif' : 'image/webp',
        size: resizedMetadataSize,
      },
      avatarFallback,
    };
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
    }).webp({ quality: 90 });

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
    const metadata = await metadataFromBuffer(inputBuffer, { animated: false });

    if (!metadata) {
      return null;
    }

    metadataSizeIsSetOrThrow(metadata, 'processForLinkPreviewThumbnail');

    // for thumbnail, we actually want to enlarge the image if required
    const resized = parsed.resize(centerCoverOpts({ maxSidePx, withoutEnlargement: false }));

    const resizedBuffer = await resized.webp().toBuffer();
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
    const metadata = await metadataFromBuffer(inputBuffer, { animated: false });

    if (!metadata) {
      return null;
    }

    const animated = isAnimated(metadata);
    const resizedBuffer = await parsed
      .webp()
      .timeout({ seconds: defaultTimeoutProcessingSeconds })
      .toBuffer();
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
    const metadata = await metadataFromBuffer(inputBuffer);

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
    let qualityRangeIndex = 0;
    while (qualityRangeIndex < qualityRange.length) {
      const quality = qualityRange[qualityRangeIndex];
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
        const outputMetadata = await metadataFromBuffer(buffer);

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
        `[imageProcessorWorker] processForFileServerUpload: iteration[${qualityRangeIndex}] took so far ${
          Date.now() - start
        }ms with quality ${quality}`
      );
      logIfOn(
        `\t src${formattedMetadata({ width: metadata.width, height: metadata.height, format: metadata.format, size: inputBuffer.byteLength })} `
      );
    }
    qualityRangeIndex++;

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
