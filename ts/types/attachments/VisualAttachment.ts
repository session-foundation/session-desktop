/* eslint-disable more/no-then */
/* global document, URL, Blob */

import { dataURLToBlob } from 'blob-util';
import { toLogFormat } from './Errors';

import { DecryptedAttachmentsManager } from '../../session/crypto/DecryptedAttachmentsManager';
import { ToastUtils } from '../../session/utils';
import { GoogleChrome } from '../../util';
import { isAudio } from '../MIME';
import { formatTimeDurationMs } from '../../util/i18n/formatting/generics';
import { isTestIntegration } from '../../shared/env_vars';
import { getFeatureFlag } from '../../state/ducks/types/releasedFeaturesReduxTypes';
import { processAvatarData } from '../../util/avatar/processAvatarData';
import type { ProcessedAvatarDataType } from '../../webworker/workers/node/image_processor/image_processor';
import { ImageProcessor } from '../../webworker/workers/browser/image_processor_interface';
import { maxAvatarDetails, maxThumbnailDetails } from '../../util/attachment/attachmentSizes';

export const THUMBNAIL_CONTENT_TYPE = 'image/webp';

export const urlToBlob = async (dataUrl: string) => {
  return (await fetch(dataUrl)).blob();
};

export const getImageDimensions = async ({
  objectUrl,
}: {
  objectUrl: string;
}): Promise<{ height: number; width: number }> => {
  const blob = await urlToBlob(objectUrl);
  const metadata = await ImageProcessor.imageMetadata(await blob.arrayBuffer());

  if (!metadata || !metadata.height || !metadata.width) {
    throw new Error('getImageDimensions: metadata is empty');
  }

  return {
    height: metadata.height,
    width: metadata.width,
  };
};

export const makeImageThumbnailBuffer = async ({
  objectUrl,
  contentType,
}: {
  objectUrl: string;
  contentType: string;
}) => {
  if (!GoogleChrome.isImageTypeSupported(contentType)) {
    throw new Error(
      'makeImageThumbnailBuffer can only be called with what GoogleChrome image type supports'
    );
  }
  const decryptedBlob = await DecryptedAttachmentsManager.getDecryptedBlob(objectUrl, contentType);

  // Calling processForInConversationThumbnail here means the generated thumbnail will be static, even if the original image is animated.
  // Let's fix this separately in the future, but we'd want to use processForInConversationThumbnail
  // so that we have a webp when the source was animated.
  // Note: when we decide to change this, we will also need to update a bunch of things regarding `THUMBNAIL_CONTENT_TYPE` assumed type.
  const processed = await ImageProcessor.processForInConversationThumbnail(
    await decryptedBlob.arrayBuffer(),
    maxThumbnailDetails.maxSide
  );
  if (!processed) {
    throw new Error('makeImageThumbnailBuffer failed to processForInConversationThumbnail');
  }

  return processed.outputBuffer;
};

export const makeVideoScreenshot = async ({
  objectUrl,
  contentType = 'image/png',
}: {
  objectUrl: string;
  contentType: string | undefined;
}) =>
  new Promise<Blob>((resolve, reject) => {
    const video = document.createElement('video');

    function capture() {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctxCanvas = canvas.getContext('2d');
      if (!ctxCanvas) {
        throw new Error('Failed to get a 2d context for canvas of video in capture()');
      }
      ctxCanvas.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = dataURLToBlob(canvas.toDataURL(contentType));

      video.removeEventListener('canplay', capture);
      video.pause();
      video.currentTime = 0;
      resolve(blob);
    }

    video.addEventListener('canplay', capture);
    video.addEventListener('error', error => {
      window.log.error('makeVideoScreenshot error', toLogFormat(error));
      reject(error);
    });

    void DecryptedAttachmentsManager.getDecryptedMediaUrl(objectUrl, contentType, false).then(
      decryptedUrl => {
        video.src = decryptedUrl;
        video.muted = true;
        void video.play(); // for some reason, this is to be started, otherwise the generated thumbnail will be empty
      }
    );
  });

export async function getVideoDuration({
  objectUrl,
  contentType,
}: {
  objectUrl: string;
  contentType: string;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');

    video.addEventListener('loadedmetadata', () => {
      const duration = formatTimeDurationMs(video.duration * 1000, { unit: 'second' });
      resolve(duration);
    });

    video.addEventListener('error', error => {
      reject(error);
    });

    void DecryptedAttachmentsManager.getDecryptedMediaUrl(objectUrl, contentType, false)
      .then(decryptedUrl => {
        video.src = decryptedUrl;
      })
      .catch(err => {
        reject(err);
      });
  });
}

export async function getAudioDuration({
  objectUrl,
  contentType,
}: {
  objectUrl: string;
  contentType: string;
}): Promise<string> {
  if (!isAudio(contentType)) {
    throw new Error('getAudioDuration can only be called with audio content type');
  }

  return new Promise((resolve, reject) => {
    const audio = document.createElement('audio');

    audio.addEventListener('loadedmetadata', () => {
      const duration = formatTimeDurationMs(audio.duration * 1000, { unit: 'second' });
      resolve(duration);
    });

    audio.addEventListener('error', error => {
      reject(error);
    });

    void DecryptedAttachmentsManager.getDecryptedMediaUrl(objectUrl, contentType, false)
      .then(decryptedUrl => {
        audio.src = decryptedUrl;
      })
      .catch(err => {
        reject(err);
      });
  });
}

export const makeObjectUrl = (data: ArrayBufferLike, contentType: string) => {
  const blob = new Blob([data], {
    type: contentType,
  });

  return URL.createObjectURL(blob);
};

export const revokeObjectUrl = (objectUrl: string) => {
  URL.revokeObjectURL(objectUrl);
};

async function pickFileForReal() {
  const acceptedImages = ['.png', '.gif', '.jpeg', '.jpg'];
  if (getFeatureFlag('proAvailable')) {
    acceptedImages.push('.webp');
  }

  const [fileHandle] = await (window as any).showOpenFilePicker({
    types: [
      {
        description: 'Images',
        accept: {
          'image/*': acceptedImages,
        },
      },
    ],
    excludeAcceptAllOption: true,
    multiple: false,
  });

  const file = (await fileHandle.getFile()) as File;
  return file;
}

async function pickFileForTestIntegration() {
  const blueAvatarDetails = await ImageProcessor.testIntegrationFakeAvatar(
    maxAvatarDetails.maxSidePlanReupload,
    {
      r: 0,
      g: 0,
      b: 255,
    }
  );
  const file = new File([blueAvatarDetails.outputBuffer], 'testIntegrationFakeAvatar.jpeg', {
    type: blueAvatarDetails.format,
  });
  return file;
}

/**
 * Shows the system file picker for images, scale the image down for avatar/opengroup measurements and return the blob objectURL on success
 */
export async function pickFileForAvatar(): Promise<ProcessedAvatarDataType | null> {
  const file = isTestIntegration() ? await pickFileForTestIntegration() : await pickFileForReal();

  try {
    const arrayBuffer = await file.arrayBuffer();
    // pickFileForAvatar is only used for avatars we want to be able to reupload (ourselves or 03-groups)
    const processed = await processAvatarData(arrayBuffer, true);
    return processed;
  } catch (e) {
    ToastUtils.pushToastError(
      'pickFileForAvatar',
      `An error happened while picking/resizing the image: "${e.message?.slice(200) || ''}"`
    );
    window.log.error(e);
    return null;
  }
}
