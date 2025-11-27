import { fromBase64, fromHex } from 'bytebuffer';
import chai, { expect } from 'chai';
import chaiBytes from 'chai-bytes';

import { SogsBlinding } from '../../../../session/apis/open_group_api/sogsv3/sogsBlinding';
import { ByteKeyPair } from '../../../../session/utils/User';

chai.use(chaiBytes);

describe('OpenGroupAuthentication', () => {
  const secondPartPrivKey = new Uint8Array([
    186, 198, 231, 30, 253, 125, 250, 74, 131, 201, 142, 210, 79, 37, 74, 178, 194, 103, 249, 204,
    219, 23, 42, 82, 128, 160, 68, 74, 210, 78, 137, 204,
  ]);
  const signingKeysA: ByteKeyPair = {
    // 881132ee03dbd2da065aa4c94f96081f62142dc8011d1b7a00de83e4aab38ce4
    privKeyBytes: new Uint8Array([
      192,
      16,
      216,
      158,
      204,
      186,
      245,
      209,
      198,
      209,
      157,
      247,
      102,
      198,
      238,
      223,
      150,
      93,
      74,
      40,
      165,
      111,
      135,
      201,
      252,
      129,
      158,
      219,
      89,
      137,
      109,
      217,
      ...secondPartPrivKey,
    ]),
    // 057aecdcade88d881d2327ab011afd2e04c2ec6acffc9e9df45aaf78a151bd2f7d
    pubKeyBytes: secondPartPrivKey,
  };

  const serverPubKey = new Uint8Array(
    fromHex('c3b3c6f32f0ab5a57f853cc4f30f5da7fda5624b0c77b3fb0829de562ada081d').toArrayBuffer()
  );

  const ts = 1642472103;
  const method = 'GET';
  const path = '/room/the-best-room/messages/recent?limit=25';

  const nonce = new Uint8Array(fromBase64('CdB5nyKVmQGCw6s0Bvv8Ww==').toArrayBuffer());

  const body = 'hello 🎂';

  describe('HeaderCreation', () => {
    describe('Blinded Headers', () => {
      it('should produce correct X-SOGS-Nonce', async () => {
        const headers = await SogsBlinding.getOpenGroupHeaders({
          signingKeys: signingKeysA,
          serverPK: serverPubKey,
          nonce,
          method,
          path,
          timestamp: ts,
          blinded: true,
          body: null,
        });
        expect(headers['X-SOGS-Nonce']).to.be.equal('CdB5nyKVmQGCw6s0Bvv8Ww==');
      });

      it('should produce correct X-SOGS-Pubkey', async () => {
        const headers = await SogsBlinding.getOpenGroupHeaders({
          signingKeys: signingKeysA,
          serverPK: serverPubKey,
          nonce,
          method,
          path,
          timestamp: ts,
          blinded: true,
          body: null,
        });
        expect(headers['X-SOGS-Pubkey']).to.be.equal(
          '1598932d4bccbe595a8789d7eb1629cefc483a0eaddc7e20e8fe5c771efafd9af5'
        );
      });

      it('should produce correct X-SOGS-Timestamp', async () => {
        const headers = await SogsBlinding.getOpenGroupHeaders({
          signingKeys: signingKeysA,
          serverPK: serverPubKey,
          nonce,
          method,
          path,
          timestamp: ts,
          blinded: true,
          body: null,
        });
        expect(headers['X-SOGS-Timestamp']).to.be.equal('1642472103');
      });
      it('should produce correct X-SOGS-Signature without body', async () => {
        const headers = await SogsBlinding.getOpenGroupHeaders({
          signingKeys: signingKeysA,
          serverPK: serverPubKey,
          nonce,
          method,
          path,
          timestamp: ts,
          blinded: true,
          body: null,
        });
        expect(headers['X-SOGS-Signature']).to.be.equal(
          'gYqpWZX6fnF4Gb2xQM3xaXs0WIYEI49+B8q4mUUEg8Rw0ObaHUWfoWjMHMArAtP9QlORfiydsKWz1o6zdPVeCQ=='
        );
      });

      it('should produce correct X-SOGS-Signature with body', async () => {
        const headers = await SogsBlinding.getOpenGroupHeaders({
          signingKeys: signingKeysA,
          serverPK: serverPubKey,
          nonce,
          method,
          path,
          timestamp: ts,
          blinded: true,
          body,
        });
        expect(headers['X-SOGS-Signature']).to.be.equal(
          'hZCg5pEoy9t98umaY6fNarzcLP5UKUF8chz5mIjwwrRIQLy1kinRoYcNPdFOpJu8heA0val4viymXRTp1DGeBg=='
        );
      });
    });

    describe('Unblinded Headers', () => {
      it('should produce correct X-SOGS-Nonce', async () => {
        const headers = await SogsBlinding.getOpenGroupHeaders({
          signingKeys: signingKeysA,
          serverPK: serverPubKey,
          nonce,
          method,
          path,
          timestamp: ts,
          blinded: false,
          body: null,
        });
        expect(headers['X-SOGS-Nonce']).to.be.equal('CdB5nyKVmQGCw6s0Bvv8Ww==');
      });

      it('should produce correct X-SOGS-Pubkey', async () => {
        const headers = await SogsBlinding.getOpenGroupHeaders({
          signingKeys: signingKeysA,
          serverPK: serverPubKey,
          nonce,
          method,
          path,
          timestamp: ts,
          blinded: false,
          body: null,
        });
        expect(headers['X-SOGS-Pubkey']).to.be.equal(
          '00bac6e71efd7dfa4a83c98ed24f254ab2c267f9ccdb172a5280a0444ad24e89cc'
        );
      });

      it('should produce correct X-SOGS-Timestamp', async () => {
        const headers = await SogsBlinding.getOpenGroupHeaders({
          signingKeys: signingKeysA,
          serverPK: serverPubKey,
          nonce,
          method,
          path,
          timestamp: ts,
          blinded: false,
          body: null,
        });
        expect(headers['X-SOGS-Timestamp']).to.be.equal('1642472103');
      });
      it('should produce correct X-SOGS-Signature without body', async () => {
        const headers = await SogsBlinding.getOpenGroupHeaders({
          signingKeys: signingKeysA,
          serverPK: serverPubKey,
          nonce,
          method,
          path,
          timestamp: ts,
          blinded: false,
          body: null,
        });
        expect(headers['X-SOGS-Signature']).to.be.equal(
          'xxLpXHbomAJMB9AtGMyqvBsXrdd2040y+Ol/IKzElWfKJa3EYZRv1GLO6CTLhrDFUwVQe8PPltyGs54Kd7O5Cg=='
        );
      });

      it('should produce correct X-SOGS-Signature with body', async () => {
        const headers = await SogsBlinding.getOpenGroupHeaders({
          signingKeys: signingKeysA,
          serverPK: serverPubKey,
          nonce,
          method,
          path,
          timestamp: ts,
          blinded: false,
          body,
        });
        expect(headers['X-SOGS-Signature']).to.be.equal(
          'uumZNee7NUb0lVufegjzgjjnj4pe3kAe6OYw7iVTJrcxxxdIxUCgt5/xliBWqPlgY6ReUZRAuptNa4nprv7nCA=='
        );
      });
    });
  });
});
