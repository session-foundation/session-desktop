import { IMAGE_GIF, IMAGE_WEBP, type MIMEType } from '../MIME';

function isGIFAnimated(uint8Array: Uint8Array): boolean {
  let imageDescriptorCount = 0;
  for (let i = 0; i < uint8Array.length - 1; i++) {
    if (uint8Array[i] === 0x2c) {
      imageDescriptorCount++;
      if (imageDescriptorCount > 1) {
        return true;
      }
    }
  }
  return false;
}

function isWebPAnimated(uint8Array: Uint8Array): boolean {
  const header = Array.from(uint8Array.slice(0, 200))
    .map(b => String.fromCharCode(b))
    .join('');

  if (header.includes('VP8X')) {
    const vp8xIndex = header.indexOf('VP8X');
    // eslint-disable-next-line no-bitwise
    if (vp8xIndex > 0 && uint8Array[vp8xIndex + 8] & 0x02) {
      return true;
    }
  }
  return header.includes('ANIM');
}

export async function isImageAnimated(arrayBuffer: ArrayBuffer, contentType: MIMEType): Promise<boolean> {
  const uint8Array = new Uint8Array(arrayBuffer);

  if (contentType === IMAGE_GIF) {
    return isGIFAnimated(uint8Array);
  }

  if (contentType === IMAGE_WEBP) {
    return isWebPAnimated(uint8Array);
  }

  return false;
}
