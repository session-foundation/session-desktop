import { isArrayBuffer, isEmpty } from 'lodash';
import { isAbsolute } from 'path';
import sharp from 'sharp';
import { existsSync, statSync } from 'fs';
import type { ImageProcessorWorkerActions } from './image_processor';
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

const extractFirstFrame: ImageProcessorWorkerActions['extractFirstFrame'] = async absolutePath => {
  if (!absolutePath) {
    throw new Error('filepath is required');
  }

  if (!existsSync(absolutePath)) {
    throw new Error(`"${absolutePath}" does not exist`);
  }

  const stat = statSync(absolutePath);
  if (!stat.isFile()) {
    throw new Error(`"${absolutePath}" is not a file`);
  }
  if (!isAbsolute(absolutePath)) {
    throw new Error(`"${absolutePath}" is not an absolute path`);
  }
  const buffer = await sharp(absolutePath, { pages: 1 }).jpeg().toBuffer();
  return buffer.buffer;
};

const extractFirstFrameBuffer: ImageProcessorWorkerActions['extractFirstFrameBuffer'] =
  async inputBuffer => {
    if (!inputBuffer || isEmpty(inputBuffer)) {
      throw new Error('inputBuffer is required');
    }

    const parsed = sharp(new Uint8Array(inputBuffer), { pages: 1 });
    const jpeg = parsed.jpeg();
    const buffer = await jpeg.toBuffer();
    return buffer.buffer;
  };

const cropAnimatedAvatar: ImageProcessorWorkerActions['cropAnimatedAvatar'] = async (
  inputBuffer,
  maxSide
) => {
  if (!inputBuffer || !isArrayBuffer(inputBuffer) || !inputBuffer.byteLength) {
    console.warn('inputBuffer is required, got: ', inputBuffer);
    throw new Error('inputBuffer is required');
  }
  const start = Date.now();

  if (DEBUG_IMAGE_PROCESSOR_WORKER) {
    console.log(
      `[imageProcessorWorker] cropAnimatedAvatar starting at ${start} for ${inputBuffer.byteLength} bytes`
    );
  }
  const buffer = await sharp(new Uint8Array(inputBuffer), { animated: true })
    .resize({
      height: maxSide,
      width: maxSide,
      fit: 'cover', // cover as we want the image to be cropped on the sides if needed, but take the full maxSide
    })
    .toBuffer();
  if (DEBUG_IMAGE_PROCESSOR_WORKER) {
    console.log(
      `[imageProcessorWorker] cropAnimatedAvatar took ${Date.now() - start}ms for ${inputBuffer.byteLength} bytes`
    );
  }
  const metadata = await sharp(buffer).metadata();

  return { resizedBuffer: buffer.buffer, height: metadata.height, width: metadata.width };
};

const functions = {
  extractFirstFrame,
  extractFirstFrameBuffer,
  cropAnimatedAvatar,
};
