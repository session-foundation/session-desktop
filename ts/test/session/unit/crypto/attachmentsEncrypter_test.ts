import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { decryptAttachment, encryptAttachment } from '../../../../util/crypto/attachmentsEncrypter';

use(chaiAsPromised);

function makeBuffer(length: number, offset: number) {
  const buffer = new ArrayBuffer(length);
  const view = new Uint8Array(buffer);

  for (let index = 0; index < length; index += 1) {
    view[index] = (index + offset) % 256;
  }

  return buffer;
}

describe('attachmentsEncrypter', () => {
  it('decrypts attachments encrypted with the matching digest', async () => {
    const plaintext = makeBuffer(48, 3);
    const keys = makeBuffer(64, 7);
    const iv = makeBuffer(16, 11);

    const encrypted = await encryptAttachment(plaintext, keys, iv);
    const decrypted = await decryptAttachment(encrypted.ciphertext, keys, encrypted.digest);

    expect(new Uint8Array(decrypted)).to.deep.equal(new Uint8Array(plaintext));
  });

  it('rejects truncated attachment digests', async () => {
    const plaintext = makeBuffer(48, 3);
    const keys = makeBuffer(64, 7);
    const iv = makeBuffer(16, 11);

    const encrypted = await encryptAttachment(plaintext, keys, iv);
    const truncatedDigest = encrypted.digest.slice(0, 16);

    await expect(decryptAttachment(encrypted.ciphertext, keys, truncatedDigest)).to.be.rejectedWith(
      'Bad digest length'
    );
  });
});
