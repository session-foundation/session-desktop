import Long from 'long';

export function longOrNumberToNumber(value: number | Long): number {
  const asLong = Long.fromValue(value);
  if (asLong.greaterThan(Number.MAX_SAFE_INTEGER)) {
    throw new Error('longOrNumberToNumber: value is too big');
  }
  return asLong.toNumber();
}
