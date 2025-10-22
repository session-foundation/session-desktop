import { MAX_ATTACHMENT_FILESIZE_BYTES } from '../constants';

/**
 * This file is used to pad message buffer and attachments
 */
const PADDING_BYTE = 0x00;


/*
 * If the attachment has padding, remove the padding and return the unpad attachment
 */
export function getUnpaddedAttachment(
  data: ArrayBuffer,
  unpaddedExpectedSize: number
): ArrayBuffer | null {
  // window?.log?.debug('Removing attachment padding...');

  // to have a padding we must have a strictly longer length expected
  if (data.byteLength <= unpaddedExpectedSize) {
    return null;
  }
  // we now consider that anything coming after the expected size is padding, no matter what there is there
  return data.slice(0, unpaddedExpectedSize);
}

export function addAttachmentPadding(data: ArrayBuffer): ArrayBuffer {
  const originalUInt = new Uint8Array(data);
  window?.log?.info('Adding attachment padding...');

  let paddedSize = Math.max(
    541,
    // eslint-disable-next-line prefer-exponentiation-operator, no-restricted-properties
    Math.floor(Math.pow(1.05, Math.ceil(Math.log(originalUInt.length) / Math.log(1.05))))
  );

  if (
    paddedSize > MAX_ATTACHMENT_FILESIZE_BYTES &&
    originalUInt.length <= MAX_ATTACHMENT_FILESIZE_BYTES
  ) {
    paddedSize = MAX_ATTACHMENT_FILESIZE_BYTES;
  }
  const paddedData = new ArrayBuffer(paddedSize);
  const paddedUInt = new Uint8Array(paddedData);

  paddedUInt.fill(PADDING_BYTE, originalUInt.length);
  paddedUInt.set(originalUInt);

  return paddedUInt.buffer;
}
