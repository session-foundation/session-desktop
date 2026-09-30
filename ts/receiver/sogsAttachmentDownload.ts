import { getUnpaddedAttachment } from '../session/crypto/BufferPadding';

export type SogsAttachmentDownloadOptions = {
  allowUnknownSize?: boolean;
};

export function validateDownloadedSogsAttachment(
  attachment: {
    url: string;
    size?: number | null;
  },
  dataUint: Uint8Array,
  options: SogsAttachmentDownloadOptions = {}
): ArrayBuffer {
  const data = toExactArrayBuffer(dataUint);

  if (attachment.size === null || attachment.size === undefined) {
    if (!options.allowUnknownSize) {
      throw new Error(`downloadAttachmentSogsV3: Missing attachment size for ${attachment.url}`);
    }

    return data;
  }

  if (
    !Number.isFinite(attachment.size) ||
    !Number.isInteger(attachment.size) ||
    attachment.size <= 0
  ) {
    throw new Error(
      `downloadAttachmentSogsV3: Invalid attachment size ${attachment.size} for ${attachment.url}`
    );
  }

  if (attachment.size !== data.byteLength) {
    // Payloads may include attachment padding, which is trimmed to the expected size.
    const unpaddedData = getUnpaddedAttachment(data, attachment.size);
    if (!unpaddedData) {
      throw new Error(
        `downloadAttachment: Size ${attachment.size} did not match downloaded attachment size ${data.byteLength}`
      );
    }
    return unpaddedData;
  }

  // The attachment already has the expected size, without padding.
  return data;
}

function toExactArrayBuffer(data: Uint8Array): ArrayBuffer {
  if (data.byteOffset === 0 && data.byteLength === data.buffer.byteLength) {
    return data.buffer;
  }

  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
}
