import crypto from 'crypto';
import libsodiumwrappers from 'libsodium-wrappers-sumo';

export type LibSodiumWrappers = typeof libsodiumwrappers;

export type WithLibSodiumWrappers = {
  sodium: LibSodiumWrappers;
};

export async function getSodiumRenderer(): Promise<LibSodiumWrappers> {
  await libsodiumwrappers.ready;
  return libsodiumwrappers;
}

export const sha256 = (s: string) => {
  return crypto.createHash('sha256').update(s).digest('base64');
};

export const concatUInt8Array = (...args: Array<Uint8Array>): Uint8Array => {
  const totalLength = args.reduce((acc, current) => acc + current.length, 0);

  const concatted = new Uint8Array(totalLength);
  let currentIndex = 0;
  args.forEach(arr => {
    concatted.set(arr, currentIndex);
    currentIndex += arr.length;
  });

  return concatted;
};
