import { expect } from 'chai';

import { decryptAttachment } from '../../../../util/crypto/attachmentsEncrypter';
import { getUnpaddedAttachment } from '../../../../session/crypto/BufferPadding';

const hexToBuffer = (hex: string) =>
  Uint8Array.from(hex.match(/.{2}/g)!.map(b => parseInt(b, 16))).buffer;

/**
 * Content encrypted the legacy way stays on the file server indefinitely, so this format has to keep
 * decrypting long after nothing writes it. The vectors were produced externally rather than by a round
 * trip, so they still describe the wire format now that the encrypting half is gone.
 */
describe('legacy attachment decryption', () => {
  /** 32-byte AES key ‖ 32-byte HMAC key */
  const key = hexToBuffer('11'.repeat(32) + '22'.repeat(32));
  /** IV ‖ AES-256-CBC(PKCS7) ‖ HMAC-SHA256(IV ‖ ciphertext), over a 541-byte zero-padded plaintext */
  const ciphertext = hexToBuffer(
    '333333333333333333333333333333330ee1ed4f89c70232caed52b8765365ff' +
      'e904557d3c61038c97bdb5bee3189fc6f53aac97422dc92d8693c0a72b3aa362' +
      '01d1bd3a6dd6164a09154ae87aa95888066a80449e211fc64a69c04b0f9ddce0' +
      '2f144fbea3a731ded616d0436b2fd6ec908f89ebf85d15bad69bdaa66827f0b3' +
      '484b7425d383f7136e3c911881731c043863f49f5ada6f85f8fa456efd08a2db' +
      '8c7b510cb04a225035db36e21660f5274939dc09639ffd30cc36ac9fc8776761' +
      '5a93ab017c028a8bdf2dd7ef48c245b846c7cd4942866d77b056a2a59924d426' +
      '4d1e1d23b8c5ed598f23ada8a905c5579383581203db2c5f60c434551992162f' +
      'b9f36105a91515c5472105c64f3c111a16c745bbca3e810460319b3124c430ca' +
      '3d87f4fd9400502cd62d7e782ee5eebf4656f4acd84a9ae964e0f40804dea71d' +
      '675eb620a2659094b52a3bdf9b36c8ac66ffcbbb129749e5394eabf4b8708249' +
      '12cf7966797621b0ca073baf66d500d5589649b89d5298855471178c724907d2' +
      '5e5812ea7cbf4d9fdf19319eeba03b491cf2857a388ef861ea11e83876d43751' +
      'fbbc80aaf205e5d937e9dcc046f9aaf3ee56b6a627a5a474e1ac5cde5a12e52a' +
      'fd23fcdadeb591aa06f374bd84edf8a5d61151df711ed8fbded86f0b23c28ef4' +
      '414b99d422c4bf95f30f1f18b274c42d9e61a48f63a754d100c7bf64fc88f469' +
      '407560f167919c9d5f10d5a343dff87e753ab281e57073fce95481d2b8c4da0e' +
      '5f0d13c67d802c1733c232e3d520f38a4f9d5a43c6ce60843288322b883d7d24' +
      '796efd75c676cb02a5b6148ea737534d'
  );
  const digest = hexToBuffer('ee65e6417b452d017a4d8e2ce984883c1f7dc8d920d7551f0e2d2af7606bd9a9');
  const plaintext = 'legacy attachment payload';
  const paddedSize = 541;

  it('decrypts to the sender-padded plaintext', async () => {
    const decrypted = await decryptAttachment(ciphertext, key, digest);

    expect(decrypted.byteLength).to.equal(paddedSize);
    expect(Buffer.from(decrypted).subarray(0, plaintext.length).toString('utf8')).to.equal(
      plaintext
    );
  });

  it('rejects a tampered ciphertext', async () => {
    const tampered = ciphertext.slice(0);
    new Uint8Array(tampered)[20] += 1;

    let threw = false;
    try {
      await decryptAttachment(tampered, key, digest);
    } catch {
      threw = true;
    }
    expect(threw).to.equal(true);
  });

  it('rejects a mismatched digest', async () => {
    let threw = false;
    try {
      await decryptAttachment(ciphertext, key, hexToBuffer('00'.repeat(32)));
    } catch {
      threw = true;
    }
    expect(threw).to.equal(true);
  });

  describe('the size bookkeeping that follows decryption', () => {
    /**
     * The receiver trims to the size the sender put on the pointer. Legacy senders pad, so there is
     * something to trim; libSession strips its own padding, so a stream-decrypted attachment already
     * matches and must be left alone.
     */
    it('trims a legacy attachment back to the advertised size', async () => {
      const decrypted = await decryptAttachment(ciphertext, key, digest);
      const trimmed = getUnpaddedAttachment(decrypted, plaintext.length);

      expect(trimmed).to.not.equal(null);
      expect(trimmed!.byteLength).to.equal(plaintext.length);
      expect(Buffer.from(trimmed!).toString('utf8')).to.equal(plaintext);
    });

    it('refuses to trim when the data is already the advertised size', () => {
      const exact = new ArrayBuffer(plaintext.length);
      expect(getUnpaddedAttachment(exact, plaintext.length)).to.equal(null);
    });

    it('refuses to trim when the data is shorter than advertised', () => {
      const short = new ArrayBuffer(plaintext.length - 1);
      expect(getUnpaddedAttachment(short, plaintext.length)).to.equal(null);
    });
  });
});
