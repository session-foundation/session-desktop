import { expect } from 'chai';

import { validateDownloadedSogsAttachment } from '../../receiver/sogsAttachmentDownload';

describe('receiver/attachments', () => {
  const attachmentUrl = 'https://example.org/file/12345';

  it('rejects a SOGS message attachment without an expected size', () => {
    expect(() =>
      validateDownloadedSogsAttachment({ url: attachmentUrl }, new Uint8Array([1, 2, 3]))
    ).to.throw('Missing attachment size');
  });

  it('allows unknown size when explicitly requested', () => {
    const data = new Uint8Array([1, 2, 3]);

    const downloaded = validateDownloadedSogsAttachment({ size: null, url: attachmentUrl }, data, {
      allowUnknownSize: true,
    });

    expect(new Uint8Array(downloaded)).to.deep.eq(data);
  });

  it('rejects a truncated SOGS message attachment', () => {
    expect(() =>
      validateDownloadedSogsAttachment({ size: 4, url: attachmentUrl }, new Uint8Array([1, 2, 3]))
    ).to.throw('did not match downloaded attachment size');
  });

  it('rejects an invalid SOGS message attachment size', () => {
    expect(() =>
      validateDownloadedSogsAttachment({ size: 1.5, url: attachmentUrl }, new Uint8Array([1, 2, 3]))
    ).to.throw('Invalid attachment size');
  });

  it('removes padding from oversized SOGS message attachments', () => {
    const downloaded = validateDownloadedSogsAttachment(
      { size: 3, url: attachmentUrl },
      new Uint8Array([1, 2, 3, 0, 0])
    );

    expect(new Uint8Array(downloaded)).to.deep.eq(new Uint8Array([1, 2, 3]));
  });

  it('does not include bytes outside the downloaded Uint8Array view', () => {
    const source = new Uint8Array([9, 1, 2, 3, 9]);
    const downloaded = validateDownloadedSogsAttachment(
      { size: 3, url: attachmentUrl },
      new Uint8Array(source.buffer, 1, 3)
    );

    expect(new Uint8Array(downloaded)).to.deep.eq(new Uint8Array([1, 2, 3]));
  });
});
