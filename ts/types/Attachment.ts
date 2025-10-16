import { isUndefined, padStart } from 'lodash';

import { format } from 'date-fns';
import { SignalService } from '../protobuf';
import { isImageTypeSupported, isVideoTypeSupported } from '../util/GoogleChrome';
import { saveURLAsFile } from '../util/saveURLAsFile';
import * as MIME from './MIME';
import { AriaLabels } from '../util/hardcodedAriaLabels';
import {
  ATTACHMENT_DEFAULT_MAX_SIDE,
  maxThumbnailDetails,
} from '../util/attachment/attachmentSizes';

const MAX_WIDTH = maxThumbnailDetails.maxSide;
const MAX_HEIGHT = maxThumbnailDetails.maxSide;
const MIN_WIDTH = maxThumbnailDetails.maxSide;
const MIN_HEIGHT = maxThumbnailDetails.maxSide;

// Used for displaying attachments in the UI
export type AttachmentScreenshot = {
  contentType: MIME.MIMEType;
  height: number;
  width: number;
  url?: string;
  path?: string;
};

export type AttachmentThumbnail = {
  contentType: MIME.MIMEType;
  height: number;
  width: number;
  url?: string;
  path?: string;
};

export type AttachmentType = {
  contentType: MIME.MIMEType;
  fileName: string;
  /** For messages not already on disk, this will be a data url */
  url: string;
  fileSize: string | null;
  pending?: boolean;
  screenshot: AttachmentScreenshot | null;
  thumbnail: AttachmentThumbnail | null;
  caption?: string;
  size?: number;
  width?: number;
  height?: number;
  duration?: string;
  videoUrl?: string;
  /** Not included in protobuf, needs to be pulled from flags */
  isVoiceMessage?: boolean;
};

export type AttachmentTypeWithPath = AttachmentType & {
  path: string;
  flags?: number;
  error?: any;
};

// UI-focused functions

export function getExtensionForDisplay({
  fileName,
  contentType,
}: {
  fileName: string;
  contentType: MIME.MIMEType;
}): string | undefined {
  if (fileName && fileName.indexOf('.') >= 0) {
    const lastPeriod = fileName.lastIndexOf('.');
    const extension = fileName.slice(lastPeriod + 1);
    if (extension.length) {
      return extension;
    }
  }

  if (!contentType) {
    return undefined;
  }

  const slash = contentType.indexOf('/');
  if (slash >= 0) {
    return contentType.slice(slash + 1);
  }

  return undefined;
}

export function isAudio(attachments?: Array<AttachmentType>) {
  return (
    attachments &&
    attachments[0] &&
    attachments[0].contentType &&
    MIME.isAudio(attachments[0].contentType)
  );
}

export function canDisplayImagePreview(attachments?: Array<AttachmentType>) {
  // Note: when we display an image we usually display the preview.
  // The preview is usually downscaled
  const { height, width } =
    attachments && attachments[0]?.thumbnail ? attachments[0].thumbnail : { height: 0, width: 0 };

  return Boolean(
    height &&
      height > 0 &&
      height <= ATTACHMENT_DEFAULT_MAX_SIDE &&
      width &&
      width > 0 &&
      width <= ATTACHMENT_DEFAULT_MAX_SIDE
  );
}

export function getThumbnailUrl(attachment: AttachmentType): string {
  return attachment?.thumbnail?.url || getUrl(attachment);
}

export function getUrl(attachment: Pick<AttachmentType, 'screenshot' | 'url'>): string {
  return attachment?.screenshot?.url || attachment.url;
}

export function isImage(attachments?: Array<AttachmentType>) {
  return (
    attachments &&
    attachments[0] &&
    attachments[0].contentType &&
    isImageTypeSupported(attachments[0].contentType)
  );
}

export function isImageAttachment(attachment: Pick<AttachmentType, 'contentType'>): boolean {
  return Boolean(
    attachment && attachment.contentType && isImageTypeSupported(attachment.contentType)
  );
}

export function hasImage(attachments?: Array<AttachmentType>): boolean {
  return Boolean(attachments && attachments[0] && (attachments[0].url || attachments[0].pending));
}

export function isVideo(attachments?: Array<AttachmentType>): boolean {
  return Boolean(attachments && isVideoAttachment(attachments[0]));
}

export function isVideoAttachment(attachment?: Pick<AttachmentType, 'contentType'>): boolean {
  return Boolean(
    !!attachment && !!attachment.contentType && isVideoTypeSupported(attachment.contentType)
  );
}

export function hasVideoScreenshot(attachments?: Array<AttachmentType>): boolean {
  const firstAttachment = attachments ? attachments[0] : null;
  return Boolean(firstAttachment?.screenshot?.url || firstAttachment?.pending);
}

type DimensionsType = {
  height: number;
  width: number;
};

export async function arrayBufferFromFile(file: any): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const FR = new FileReader();
    FR.onload = (e: any) => {
      resolve(e.target.result);
    };
    FR.onerror = reject;
    FR.onabort = reject;
    FR.readAsArrayBuffer(file);
  });
}

export function getImageDimensionsInAttachment(attachment: AttachmentType): DimensionsType {
  const { height, width } = attachment;
  if (!height || !width) {
    return {
      height: MIN_HEIGHT,
      width: MIN_WIDTH,
    };
  }

  const aspectRatio = height / width;
  const targetWidth = Math.max(Math.min(MAX_WIDTH, width), MIN_WIDTH);
  const candidateHeight = Math.round(targetWidth * aspectRatio);

  return {
    width: targetWidth,
    height: Math.max(Math.min(MAX_HEIGHT, candidateHeight), MIN_HEIGHT),
  };
}

export function areAllAttachmentsVisual(
  attachments?: Array<Pick<AttachmentType, 'contentType'>>
): boolean {
  if (!attachments) {
    return false;
  }

  const max = attachments.length;
  for (let i = 0; i < max; i += 1) {
    const attachment = attachments[i];
    if (!isImageAttachment(attachment) && !isVideoAttachment(attachment)) {
      return false;
    }
  }

  return true;
}

export function getAlt(attachment: AttachmentType): string {
  // TODO: make those localized through crowdin
  return isVideoAttachment(attachment)
    ? AriaLabels.screenshotVideoInMsg
    : AriaLabels.imageAttachmentAlt;
}

// Migration-related attachment stuff

export type Attachment = {
  fileName?: string;
  caption?: string;
  flags?: SignalService.AttachmentPointer.Flags;
  contentType?: MIME.MIMEType;
  size?: number;
  width?: number;
  height?: number;
  data: ArrayBuffer;
} & Partial<AttachmentSchemaVersion3>;

interface AttachmentSchemaVersion3 {
  path: string;
}

export const isVisualMedia = (attachment: Attachment): boolean => {
  const { contentType } = attachment;

  if (isUndefined(contentType)) {
    return false;
  }

  if (isVoiceMessage(attachment)) {
    return false;
  }

  return MIME.isImage(contentType) || MIME.isVideo(contentType);
};

export const isFile = (attachment: Attachment): boolean => {
  const { contentType } = attachment;

  if (isUndefined(contentType)) {
    return false;
  }

  if (isVisualMedia(attachment)) {
    return false;
  }

  if (isVoiceMessage(attachment)) {
    return false;
  }

  return true;
};

export const isVoiceMessage = (attachment: Pick<Attachment, 'flags'>): boolean => {
  const flag = SignalService.AttachmentPointer.Flags.VOICE_MESSAGE;
  const hasFlag =
    // eslint-disable-next-line no-bitwise
    !isUndefined(attachment.flags) && (attachment.flags & flag) === flag;
  return hasFlag;
};

export const save = ({
  attachment,
  document,
  index,
  timestamp,
}: {
  attachment: AttachmentType;
  document: Document;
  index: number;
  getAbsolutePath: (relativePath: string) => string;
  timestamp?: number;
}): void => {
  const isObjectURLRequired = isUndefined(attachment.fileName);
  const filename = getSuggestedFilename({ attachment, timestamp, index });
  saveURLAsFile({ url: attachment.url, filename, document });
  if (isObjectURLRequired) {
    URL.revokeObjectURL(attachment.url);
  }
};

export const getSuggestedFilename = ({
  attachment,
  timestamp,
  index,
}: {
  attachment: AttachmentType;
  timestamp?: number | Date;
  index?: number;
}): string => {
  if (attachment.fileName?.length > 3) {
    return attachment.fileName;
  }
  const prefix = 'session-attachment';
  const suffix = timestamp ? format(new Date(timestamp), '-yyyy-MM-dd-HHmmss') : '';
  const fileType = getFileExtension(attachment);
  const extension = fileType ? `.${fileType}` : '';
  const indexSuffix = index ? `_${padStart(index.toString(), 3, '0')}` : '';

  return `${prefix}${suffix}${indexSuffix}${extension}`;
};

export const getFileExtension = (attachment: AttachmentType): string | undefined => {
  // we override textplain to the extension of the file
  // for contenttype starting with application, the mimetype is probably wrong so just use the extension of the file instead
  if (
    !attachment.contentType ||
    attachment.contentType === 'text/plain' ||
    attachment.contentType.startsWith('application')
  ) {
    if (attachment.fileName?.length) {
      const dotLastIndex = attachment.fileName.lastIndexOf('.');
      if (dotLastIndex !== -1) {
        return attachment.fileName.substring(dotLastIndex + 1);
      }
      return undefined;
    }
    return undefined;
  }

  switch (attachment.contentType) {
    case 'video/quicktime':
      return 'mov';
    default:
      return attachment.contentType.split('/')[1];
  }
};
