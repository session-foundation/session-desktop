import type { RefObject } from 'react';

/**
 * Converts a QRCodeSVG to a PNG and triggers a file download.
 * Pass a ref to either the <svg> element directly or to a container element — in the latter case
 * the first <svg> descendant is used.
 */
export async function saveQRCodeAsPng(
  ref: RefObject<Element | null>,
  filename = 'qr-code.png'
): Promise<void> {
  const node = ref.current;
  if (!node) {
    window.log?.warn('saveQRCodeAsPng: ref is not attached to a DOM element');
    return;
  }

  const svgElement =
    node instanceof SVGSVGElement ? node : node.querySelector<SVGSVGElement>('svg');
  if (!svgElement) {
    window.log?.warn('saveQRCodeAsPng: no <svg> found');
    return;
  }

  // Use the SVG's own width/height attributes (qrcode.react sets these to the `size` prop)
  const svgWidth = Number(svgElement.getAttribute('width')) || 1000;
  const svgHeight = Number(svgElement.getAttribute('height')) || 1000;

  const svgString = new XMLSerializer().serializeToString(svgElement);
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = svgWidth;
        canvas.height = svgHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('saveQRCodeAsPng: could not get 2d canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0, svgWidth, svgHeight);

        const pngDataUrl = canvas.toDataURL('image/png');
        const anchor = document.createElement('a');
        anchor.href = pngDataUrl;
        anchor.download = filename;
        anchor.click();
        resolve();
      };
      img.onerror = reject;
      img.src = svgUrl;
    });
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
