import ByteBuffer from 'bytebuffer';

export type Encoding = 'base64' | 'hex' | 'binary' | 'utf8';
export type BufferType = ByteBuffer | Buffer | ArrayBuffer | Uint8Array;

/**
 * Take a string value with the given encoding and converts it to an `ArrayBuffer`.
 * @param value The string value.
 * @param encoding The encoding of the string value.
 */
export function encode(value: string, encoding: Encoding): ArrayBuffer {
  return ByteBuffer.wrap(value, encoding).toArrayBuffer();
}

/**
 * Take a buffer and convert it to a string with the given encoding.
 * @param buffer The buffer.
 * @param stringEncoding The encoding of the converted string value.
 */
export function decode(buffer: BufferType, stringEncoding: Encoding): string {
  return ByteBuffer.wrap(buffer).toString(stringEncoding);
}

export const toHex = (d: BufferType) => decode(d, 'hex');
export const fromHex = (d: string) => encode(d, 'hex');

export const fromHexToArray = (d: string) => new Uint8Array(fromHex(d));

export const fromBase64ToArrayBuffer = (d: string) => encode(d, 'base64');
export const fromBase64ToArray = (d: string) => new Uint8Array(fromBase64ToArrayBuffer(d));

export const fromArrayBufferToBase64 = (d: BufferType) => decode(d, 'base64');
export const fromUInt8ArrayToBase64 = (d: Uint8Array) => decode(d, 'base64');

export const stringToArrayBuffer = (str: string): ArrayBuffer => {
  if (typeof str !== 'string') {
    throw new TypeError("'string' must be a string");
  }

  return encode(str, 'binary');
};

export const stringToUint8Array = (str?: string): Uint8Array => {
  if (!str) {
    return new Uint8Array();
  }
  return new Uint8Array(stringToArrayBuffer(str));
};

export const ed25519Str = (ed25519Key: string) =>
  `(...${ed25519Key.length > 58 ? ed25519Key.substr(58) : ed25519Key})`;

// eslint-disable-next-line no-misleading-character-class -- We specifically want these unicode chars
const OUTER_WHITESPACE_REGEX = /^[\s\u200B-\u200F\u2060\uFEFF]+|[\s\u200B-\u200F\u2060\uFEFF]+$/g;

/**
 * Trims a string including any special whitespace characters.
 * @param value the string to trim
 * @returns the trimmed string
 * @note https://en.wikipedia.org/wiki/Whitespace_character
 * @note The following characters are considered special whitespace characters:
 * - U+200B ZERO WIDTH SPACE https://unicode-explorer.com/c/200B
 * - U+200C ZERO WIDTH NON-JOINER https://unicode-explorer.com/c/200C
 * - U+200D ZERO WIDTH JOINER https://unicode-explorer.com/c/200D
 * - U+200E LEFT-TO-RIGHT MARK https://unicode-explorer.com/c/200E
 * - U+200F RIGHT-TO-LEFT MARK https://unicode-explorer.com/c/200F
 * - U+2060 WORD JOINER https://unicode-explorer.com/c/2060
 * - U+FEFF ZERO WIDTH NO-BREAK SPACE https://unicode-explorer.com/c/FEFF
 */
export const trimWhitespace = (value: string): string => {
  return value.replace(OUTER_WHITESPACE_REGEX, '');
};
