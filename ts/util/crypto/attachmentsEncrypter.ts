/* eslint-disable more/no-then */

async function sign(key: any, data: any) {
  return crypto.subtle
    .importKey('raw', key, { name: 'HMAC', hash: { name: 'SHA-256' } }, false, ['sign'])
    .then(async secondKey => {
      return crypto.subtle.sign({ name: 'HMAC', hash: 'SHA-256' }, secondKey, data);
    });
}

async function decrypt(key: any, data: any, iv: any) {
  return crypto.subtle
    .importKey('raw', key, { name: 'AES-CBC' }, false, ['decrypt'])
    .then(async secondKey => {
      return crypto.subtle.decrypt({ name: 'AES-CBC', iv: new Uint8Array(iv) }, secondKey, data);
    });
}
async function verifyMAC(data: any, key: any, mac: any, length: any) {
  return sign(key, data).then(calculatedMac => {
    if (mac.byteLength !== length || calculatedMac.byteLength < length) {
      throw new Error('Bad MAC length');
    }
    const a = new Uint8Array(calculatedMac);
    const b = new Uint8Array(mac);
    let result = 0;
    for (let i = 0; i < mac.byteLength; ++i) {
      // eslint-disable-next-line no-bitwise
      result |= a[i] ^ b[i];
    }
    if (result !== 0) {
      throw new Error('Bad MAC');
    }
  });
}

async function verifyDigest(data: ArrayBuffer, theirDigest: ArrayBuffer) {
  return crypto.subtle.digest({ name: 'SHA-256' }, data).then(ourDigest => {
    if (theirDigest.byteLength !== ourDigest.byteLength) {
      throw new Error('Bad digest length');
    }

    const a = new Uint8Array(ourDigest);
    const b = new Uint8Array(theirDigest);
    let result = 0;
    for (let i = 0; i < theirDigest.byteLength; i += 1) {
      // eslint-disable-next-line no-bitwise
      result |= a[i] ^ b[i];
    }
    if (result !== 0) {
      throw new Error('Bad digest');
    }
  });
}

export async function decryptAttachment(
  encryptedBin: ArrayBuffer,
  keys: ArrayBuffer,
  theirDigest: ArrayBuffer
) {
  if (keys.byteLength !== 64) {
    throw new Error('Got invalid length attachment keys');
  }
  if (encryptedBin.byteLength < 16 + 32) {
    throw new Error('Got invalid length attachment');
  }

  const aesKey = keys.slice(0, 32);
  const macKey = keys.slice(32, 64);

  const iv = encryptedBin.slice(0, 16);
  const ciphertext = encryptedBin.slice(16, encryptedBin.byteLength - 32);
  const ivAndCiphertext = encryptedBin.slice(0, encryptedBin.byteLength - 32);
  const mac = encryptedBin.slice(encryptedBin.byteLength - 32, encryptedBin.byteLength);

  return verifyMAC(ivAndCiphertext, macKey, mac, 32)
    .then(async () => {
      if (!theirDigest) {
        throw new Error('Failure: Ask sender to update Session and resend.');
      }
      return verifyDigest(encryptedBin, theirDigest);
    })
    .then(() => decrypt(aesKey, ciphertext, iv));
}
