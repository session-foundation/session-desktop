/* eslint-disable no-bitwise */
import Long from 'long';

export function bigIntToLong(value: bigint, unsigned: boolean = false): Long {
  const isNegative = value < 0n;
  const abs = isNegative ? -value : value;

  const low = Number(abs & 0xffffffffn);
  const high = Number((abs >> 32n) & 0xffffffffn);

  const long = new Long(low, high, unsigned);
  return isNegative ? long.negate() : long;
}

export function longToBigInt(long: Long): bigint {
  const low = BigInt(long.getLowBitsUnsigned());
  const high = BigInt(long.getHighBits());
  return (high << 32n) | low;
}

export function numberToBigInt(number: number): bigint {
  return BigInt(number);
}
