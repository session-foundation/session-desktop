import { isFinite } from 'lodash';
import { Attachment } from '../../types/Attachment';

import { uploadFileToRoomSogs3 } from '../apis/open_group_api/sogsv3/sogsV3SendFile';
import { addAttachmentPadding } from '../crypto/BufferPadding';
import {
  AttachmentPointer,
  AttachmentPointerWithUrl,
  PreviewWithAttachmentUrl,
} from '../messages/outgoing/visibleMessage/VisibleMessage';
import { RawPreview } from './Attachments';
import { OpenGroupRequestCommonType } from '../../data/types';

interface UploadParamsV2 {
  attachment: Attachment;
  openGroup: OpenGroupRequestCommonType;
}

async function uploadV3(params: UploadParamsV2): Promise<AttachmentPointerWithUrl> {
  const { attachment, openGroup } = params;
  if (typeof attachment !== 'object' || attachment == null) {
    throw new Error('Invalid attachment passed.');
  }

  if (!(attachment.data instanceof ArrayBuffer)) {
    throw new TypeError(
      `attachment.data must be an ArrayBuffer but got: ${typeof attachment.data}`
    );
  }

  const pointer: AttachmentPointer = {
    contentType: attachment.contentType || undefined,
    size: attachment.size,
    fileName: attachment.fileName,
    flags: attachment.flags,
    caption: attachment.caption,
    width: attachment.width && isFinite(attachment.width) ? attachment.width : undefined,
    height: attachment.height && isFinite(attachment.height) ? attachment.height : undefined,
  };

  const paddedAttachment: ArrayBuffer = !openGroup
    ? addAttachmentPadding(attachment.data)
    : attachment.data;

  const fileDetails = await uploadFileToRoomSogs3(new Uint8Array(paddedAttachment), openGroup);

  if (!fileDetails) {
    throw new Error(`upload to fileopengroup of ${attachment.fileName} failed`);
  }

  return {
    ...pointer,
    url: fileDetails.fileUrl,
  };
}

export async function uploadAttachmentsV3(
  attachments: Array<Attachment>,
  openGroup: OpenGroupRequestCommonType
): Promise<Array<AttachmentPointerWithUrl>> {
  const promises = (attachments || []).map(async attachment =>
    uploadV3({
      attachment,
      openGroup,
    })
  );

  return Promise.all(promises);
}

export async function uploadLinkPreviewsV3(
  preview: RawPreview | null,
  openGroup: OpenGroupRequestCommonType
): Promise<PreviewWithAttachmentUrl | undefined> {
  // some links does not have an image associated, and it makes the whole message fail to send
  if (!preview?.image) {
    window.log.warn('tried to upload preview to opengroupv2 without image.. skipping');

    return undefined;
  }
  const image = await uploadV3({
    attachment: preview.image,
    openGroup,
  });
  return {
    ...preview,
    image,
    url: preview.url || image.url,
  };
}
