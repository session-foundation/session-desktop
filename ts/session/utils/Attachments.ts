import * as crypto from 'crypto';
import { isEmpty, isString } from 'lodash';
import Long from 'long';

import { Attachment } from '../../types/Attachment';

import { encryptAttachment } from '../../util/crypto/attachmentsEncrypter';
import { addAttachmentPadding } from '../crypto/BufferPadding';
import {
  AttachmentPointer,
  AttachmentPointerWithUrl,
  PreviewWithAttachmentUrl,
} from '../messages/outgoing/visibleMessage/VisibleMessage';
import {
  fileServerQueryPubkey,
  uploadFileToFsWithOnionV4,
} from '../apis/file_server_api/FileServerApi';
import { MultiEncryptWrapperActions } from '../../webworker/workers/browser/libsession_worker_interface';

type UploadParams = {
  attachment: Attachment;

  /**
   * Explicit padding is only needed for the legacy encryption, as libsession deterministic encryption already pads the data.
   */
  shouldPad?: boolean;
  /**
   * Use the libsession deterministic encryption.
   * Only used when the feature flag is enabled.
   */
  seed?: Uint8Array;
};

export interface RawPreview {
  url: string;
  title?: string;
  image: Attachment;
}

export interface RawQuoteAttachment {
  contentType?: string;
  fileName?: string;
  thumbnail?: Attachment;
}

export interface RawQuote {
  id: number;
  author: string;
  text?: string;
  attachments?: Array<RawQuoteAttachment>;
}

async function uploadToFileServer(params: UploadParams): Promise<AttachmentPointerWithUrl> {
  const { attachment, shouldPad = false } = params;
  if (typeof attachment !== 'object' || attachment == null) {
    throw new Error('Invalid attachment passed.');
  }

  if (!(attachment.data instanceof ArrayBuffer)) {
    throw new TypeError(
      `\`attachment.data\` must be an \`ArrayBuffer\`; got: ${typeof attachment.data}`
    );
  }
  const pointer: AttachmentPointer = {
    contentType: attachment.contentType || undefined,
    size: attachment.size,
    fileName: attachment.fileName,
    flags: attachment.flags,
    caption: attachment.caption,
    width: attachment.width,
    height: attachment.height,
  };

  let attachmentData: ArrayBuffer;

  if (
    window?.sessionFeatureFlags?.useDeterministicEncryption &&
    (!params.seed || isEmpty(params.seed))
  ) {
    throw new Error(
      'uploadAttachmentsToFileServer: useDeterministicEncryption is true but no seed was provided'
    );
  }

  if (window.sessionFeatureFlags.useDeterministicEncryption && params.seed) {
    // this throws if the encryption fails
    window?.log?.debug('Using deterministic for attachment upload: ', attachment.fileName);
    const encryptedContent = await MultiEncryptWrapperActions.attachmentEncrypt({
      allowLarge: false,
      seed: params.seed,
      data: new Uint8Array(attachment.data),
      domain: 'attachment',
    });
    pointer.key = encryptedContent.encryptionKey;
    attachmentData = encryptedContent.encryptedData;
  } else {
    // this is the legacy attachment encryption
    pointer.key = new Uint8Array(crypto.randomBytes(64));
    const iv = new Uint8Array(crypto.randomBytes(16));

    const dataToEncrypt = !shouldPad ? attachment.data : addAttachmentPadding(attachment.data);
    const data = await encryptAttachment(dataToEncrypt, pointer.key.buffer, iv.buffer);
    pointer.digest = new Uint8Array(data.digest);
    attachmentData = data.ciphertext;
  }

  // use file server v2
  const uploadToV2Result = await uploadFileToFsWithOnionV4(attachmentData);
  if (uploadToV2Result) {
    const pointerWithUrl: AttachmentPointerWithUrl = {
      ...pointer,
      url: `${uploadToV2Result.fileUrl}${fileServerQueryPubkey(uploadToV2Result.serverPubkey)}`,
    };
    return pointerWithUrl;
  }
  window?.log?.warn('upload to file server v2 failed');
  throw new Error(`upload to file server v2 of ${attachment.fileName} failed`);
}

export async function uploadAttachmentsToFileServer(
  attachments: Array<Attachment>
): Promise<Array<AttachmentPointerWithUrl>> {
  const promises = (attachments || []).map(async attachment =>
    uploadToFileServer({
      attachment,
      shouldPad: true,
      seed: crypto.randomBytes(32),
    })
  );

  return Promise.all(promises);
}

export async function uploadLinkPreviewToFileServer(
  preview: RawPreview | null
): Promise<PreviewWithAttachmentUrl | undefined> {
  // some links do not have an image associated, and it makes the whole message fail to send
  if (!preview?.image) {
    if (!preview) {
      window.log.debug('tried to upload file to FileServer without image.. skipping');
    }
    return preview as any;
  }
  const image = await uploadToFileServer({
    attachment: preview.image,
  });
  return {
    ...preview,
    image,
  };
}

export function attachmentIdAsStrFromUrl(url: string) {
  const lastSegment = url?.split('/')?.pop();
  if (!lastSegment) {
    throw new Error('attachmentIdAsStrFromUrl last is not valid');
  }
  return lastSegment;
}

export function attachmentIdAsLongFromUrl(url: string) {
  const lastSegment = url?.split('/')?.pop();
  if (!lastSegment) {
    throw new Error('attachmentIdAsLongFromUrl last is not valid');
  }
  try {
    // this throws if not a valid long
    return Long.fromString(lastSegment);
  } catch (e) {
    window.log.warn(`attachmentIdAsLongFromUrl failed with ${e.message}.. Returning 0.`);
    if (isString(lastSegment) && !isEmpty(lastSegment)) {
      return Long.fromNumber(0);
    }
    throw e;
  }
}
