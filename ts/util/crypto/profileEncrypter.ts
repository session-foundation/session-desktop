/* eslint-disable more/no-then */

const PROFILE_IV_LENGTH = 12; // bytes
const PROFILE_KEY_LENGTH = 32; // bytes
const PROFILE_TAG_LENGTH = 128; // bits

export async function decryptProfile(data: ArrayBuffer, key: ArrayBuffer): Promise<ArrayBuffer> {
  if (data.byteLength < 12 + 16 + 1) {
    throw new Error(`Got too short input: ${data.byteLength}`);
  }
  const iv = data.slice(0, PROFILE_IV_LENGTH);
  const ciphertext = data.slice(PROFILE_IV_LENGTH, data.byteLength);
  if (key.byteLength !== PROFILE_KEY_LENGTH) {
    throw new Error('Got invalid length profile key');
  }
  if (iv.byteLength !== PROFILE_IV_LENGTH) {
    throw new Error('Got invalid length profile iv');
  }
  const error = new Error(); // save stack
  return crypto.subtle
    .importKey('raw', key, { name: 'AES-GCM' }, false, ['decrypt'])
    .then(keyForEncryption =>
      crypto.subtle
        .decrypt(
          { name: 'AES-GCM', iv, tagLength: PROFILE_TAG_LENGTH },
          keyForEncryption,
          ciphertext
        )
        .catch(e => {
          if (e.name === 'OperationError') {
            // bad mac, basically.
            error.message =
              'Failed to decrypt profile data. Most likely the profile key has changed.';
            error.name = 'ProfileDecryptError';
            throw error;
          }
          throw error;
        })
    );
}
