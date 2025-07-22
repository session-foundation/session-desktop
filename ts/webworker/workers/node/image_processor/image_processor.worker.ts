import { isFinite, isNumber } from 'lodash';
import sharp from 'sharp';
import type { ImageProcessorWorkerActions } from './image_processor';
/* eslint-disable no-console */
/* eslint-disable strict */

const DEBUG_IMAGE_PROCESSOR_WORKER = true;

onmessage = async (e: any) => {
  const [jobId, fnName, ...args] = e.data;

  try {
    const fn = (workerActions as any)[fnName];
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

function metadataSizeIsSetOrThrow(metadata: sharp.Metadata, identifier: string) {
  if (!isNumber(metadata.size) || !isFinite(metadata.size)) {
    throw new Error(`assertMetadataSizeIsSet: ${identifier} metadata.size is not set`);
  }

  return metadata.size;
}

function isAnimated(metadata: sharp.Metadata) {
  return (metadata.pages || 0) > 1; // more than 1 frame means that the image is animated
}

function centerCoverOpts(maxSidePx: number) {
  return {
    height: maxSidePx,
    width: maxSidePx,
    fit: 'cover' as const, // a thumbnail we generate should contain the source image
  };
}

const workerActions: ImageProcessorWorkerActions = {
  extractFirstFrameJpeg: async inputBuffer => {
    if (!inputBuffer?.byteLength) {
      throw new Error('inputBuffer is required');
    }
    const inputMetadata = await sharp(new Uint8Array(inputBuffer)).metadata();

    metadataSizeIsSetOrThrow(inputMetadata, 'extractFirstFrameJpeg');

    if (!isAnimated(inputMetadata)) {
      throw new Error('extractFirstFrameJpeg: input is not animated');
    }

    const parsed = sharp(new Uint8Array(inputBuffer), { pages: 1 }).rotate();
    const jpeg = parsed.jpeg();
    const outputBuffer = await jpeg.toBuffer();
    const outputMetadata = await sharp(new Uint8Array(outputBuffer)).metadata();

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
  },

  imageMetadata: async inputBuffer => {
    if (!inputBuffer?.byteLength) {
      throw new Error('imageMetadata: inputBuffer is required');
    }

    const parsed = sharp(new Uint8Array(inputBuffer), { animated: true }).rotate();
    const metadata = await parsed.metadata();

    const metadataSize = metadataSizeIsSetOrThrow(metadata, 'imageMetadata');

    return {
      size: metadataSize,
      format: metadata.format,
      width: metadata.width,
      height: metadata.height,
      isAnimated: isAnimated(metadata),
    };
  },

  processLocalAvatarChange: async (inputBuffer: ArrayBufferLike, maxSidePx: number) => {
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
      .resize(centerCoverOpts(maxSidePx))
      .rotate();

    // we know the avatar is animated and gif or webp, force it to webp for performance reasons
    if (avatarIsAnimated) {
      resized.webp();
    } else {
      resized.jpeg();
    }

    const resizedBuffer = await resized.toBuffer();

    // Note: we need to use the resized buffer here, not the original one,
    // as metadata is always linked to the source buffer (even if a resize() is done before the metadata() call)
    const resizedMetadata = await sharp(resizedBuffer).metadata(); // rotate() is done as part of resized above

    const resizedMetadataSize = metadataSizeIsSetOrThrow(
      resizedMetadata,
      'processLocalAvatarChange'
    );

    if (DEBUG_IMAGE_PROCESSOR_WORKER) {
      console.log(
        `[imageProcessorWorker] processLocalAvatarChange mainAvatar resize took ${Date.now() - start}ms for ${inputBuffer.byteLength} bytes`
      );
    }

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
      const firstFrameJpeg = await workerActions.extractFirstFrameJpeg(resizedBuffer.buffer);
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

    if (DEBUG_IMAGE_PROCESSOR_WORKER) {
      console.log(
        `[imageProcessorWorker] processLocalAvatarChange sizes: main: ${mainAvatarDetails.size} bytes, fallback: ${avatarFallback ? avatarFallback.size : 0} bytes`
      );
    }

    return { mainAvatarDetails, avatarFallback };
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
    }).jpeg({ quality: 90 });

    const createdBuffer = await created.toBuffer();
    const createdMetadata = await sharp(createdBuffer).metadata(); // rotate() is done as part of resized above

    const size = metadataSizeIsSetOrThrow(createdMetadata, 'testIntegrationFakeAvatar');

    const format = 'jpeg' as const;
    return {
      outputBuffer: createdBuffer.buffer,
      height: createdMetadata.height,
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

    const parsed = sharp(new Uint8Array(inputBuffer), { animated: false }).rotate();
    const metadata = await parsed.metadata();

    metadataSizeIsSetOrThrow(metadata, 'processForLinkPreviewThumbnail');

    const resized = parsed.resize(centerCoverOpts(maxSidePx));

    const resizedBuffer = await resized.png().toBuffer();
    const resizedMetadata = await sharp(resizedBuffer).metadata();

    const resizedSize = metadataSizeIsSetOrThrow(resizedMetadata, 'processForLinkPreviewThumbnail');

    const format = 'png' as const;

    return {
      outputBuffer: resizedBuffer.buffer,
      height: resizedMetadata.height,
      width: resizedMetadata.width,
      format,
      contentType: `image/${format}` as const,
      size: resizedSize,
    };
  },

  processForInConversationThumbnail: async (inputBuffer, maxSidePx) => {
    if (!inputBuffer?.byteLength) {
      throw new Error('processForInConversationThumbnail: inputBuffer is required');
    }

    // Note: this is true here because we want to keep an animated image as is (just scaled down)
    const parsed = sharp(new Uint8Array(inputBuffer), { animated: true })
      .rotate()
      .resize(centerCoverOpts(maxSidePx));
    const metadata = await parsed.metadata();

    const animated = isAnimated(metadata);
    const resizedBuffer = animated ? await parsed.webp().toBuffer() : await parsed.png().toBuffer();
    const resizedMetadata = await sharp(resizedBuffer).metadata();

    const size = metadataSizeIsSetOrThrow(resizedMetadata, 'processForInConversationThumbnail');

    const formatDetails = animated
      ? { format: 'webp' as const, contentType: 'image/webp' as const }
      : { format: 'png' as const, contentType: 'image/png' as const };

    return {
      outputBuffer: resizedBuffer.buffer,
      height: resizedMetadata.height,
      width: resizedMetadata.width,
      ...formatDetails,
      size,
      isAnimated: animated,
    };
  },

  processForFileServerUpload: async (inputBuffer, maxSidePx, maxSizeBytes) => {
    if (!inputBuffer?.byteLength) {
      throw new Error('processForFileServerUpload: inputBuffer is required');
    }
    const start = Date.now();
    const metadata = await sharp(new Uint8Array(inputBuffer)).metadata();

    if (!metadata.format || !sharp.format[metadata.format]?.output) {
      console.warn(`Unsupported format: ${metadata.format}`);
      return null;
    }

    const animated = isAnimated(metadata);
    const base = sharp(new Uint8Array(inputBuffer), { animated });

    // Resize if needed
    if (metadata.width > maxSidePx || metadata.height > maxSidePx) {
      base.resize({
        width: maxSidePx,
        height: maxSidePx,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // If format is a lossless format, no quality to adjust
    // return the buffer resized to the maxSide
    const lossyFormats = ['jpeg', 'webp', 'avif'];
    if (!lossyFormats.includes(metadata.format)) {
      const output = await base.toBuffer();
      if (output.length >= maxSizeBytes) {
        return null;
      }
      const outputMetadata = await sharp(output).metadata();

      const size = metadataSizeIsSetOrThrow(outputMetadata, 'processForFileServerUpload');
      return {
        format: outputMetadata.format,
        outputBuffer: output.buffer,
        size,
        width: outputMetadata.width,
        height: outputMetadata.height,
        isAnimated: isAnimated(outputMetadata),
      };
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
      const buffer = await pipeline.toBuffer();

      if (buffer.length < maxSizeBytes) {
        if (DEBUG_IMAGE_PROCESSOR_WORKER) {
          console.log(
            `[imageProcessorWorker] processForFileServerUpload: DONE quality ${quality} took ${
              Date.now() - start
            }ms for ${inputBuffer.byteLength} bytes for image of ${metadata.width}x${metadata.height} with format ${metadata.format}`
          );
        }
        // eslint-disable-next-line no-await-in-loop
        const outputMetadata = await sharp(buffer).metadata();

        const size = metadataSizeIsSetOrThrow(outputMetadata, 'processForFileServerUpload');
        return {
          format: outputMetadata.format,
          outputBuffer: buffer.buffer,
          size,
          width: outputMetadata.width,
          height: outputMetadata.height,
          isAnimated: isAnimated(outputMetadata),
        };
      }
      if (DEBUG_IMAGE_PROCESSOR_WORKER) {
        console.log(
          `[imageProcessorWorker] processForFileServerUpload: iteration[${qualityRange.length - qualityRangeIndex}] took so far ${
            Date.now() - start
          }ms for ${inputBuffer.byteLength} bytes for image of ${metadata.width}x${metadata.height} with format ${metadata.format}`
        );
      }
      qualityRangeIndex++;
    }
    if (DEBUG_IMAGE_PROCESSOR_WORKER) {
      console.log(
        `[imageProcessorWorker] processForFileServerUpload: failed to get a buffer of size ${maxSizeBytes} for ${inputBuffer.byteLength} bytes for image of ${metadata.width}x${metadata.height} with format ${metadata.format}`
      );
    }

    return null;
  },
};
