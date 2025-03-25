import { KeyPair } from 'libsodium-wrappers-sumo';
import { toHex } from '../session/utils/String';

export type HexKeyPair = {
  publicHex: string;
  privateHex: string;
};

export type SessionKeyPair = {
  /**
   * The curve25519 pubkey with prepended 5
   */
  pubKey: ArrayBufferLike;

  /**
   * The curve25519 secret key
   */
  privKey: ArrayBufferLike;

  ed25519KeyPair: KeyPair;
};

export class ECKeyPair {
  public readonly publicKeyData: Uint8Array;
  public readonly privateKeyData: Uint8Array;

  constructor(publicKeyData: Uint8Array, privateKeyData: Uint8Array) {
    this.publicKeyData = publicKeyData;
    this.privateKeyData = privateKeyData;
  }

  public static fromArrayBuffer(pub: ArrayBuffer, priv: ArrayBuffer) {
    return new ECKeyPair(new Uint8Array(pub), new Uint8Array(priv));
  }

  public toString() {
    const hexKeypair = this.toHexKeyPair();
    return `ECKeyPair: ${hexKeypair.publicHex} ${hexKeypair.privateHex}`;
  }

  public toHexKeyPair(): HexKeyPair {
    const publicHex = toHex(this.publicKeyData);
    const privateHex = toHex(this.privateKeyData);
    return {
      publicHex,
      privateHex,
    };
  }
}
