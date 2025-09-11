import { longOrNumberToNumber } from '../message';

// in about 71 years
const MAX_TIMESTAMP_SECONDS = 4000000000;
// in 71 years, but in ms
const MAX_TIMESTAMP_MS = MAX_TIMESTAMP_SECONDS * 1000;

function isValidTimestampSeconds(timestamp: number): boolean {
  return timestamp < MAX_TIMESTAMP_SECONDS;
}

function isValidTimestampMs(timestamp: number): boolean {
  return timestamp < MAX_TIMESTAMP_MS;
}

export class Timestamp {
  private value: number;
  private type: 'ms' | 'seconds';

  /**
   * Can be either a timestamp in seconds or milliseconds.
   * An error will be thrown if the value is not a valid timestamp.
   *
   */
  constructor({
    value: valueIn,
    allowZero = true,
    ...args
  }: {
    value: number | Long;
    allowZero?: boolean;
    expectedUnit?: 'seconds' | 'ms';
  }) {
    const value = longOrNumberToNumber(valueIn);
    if (!allowZero && value === 0) {
      throw new Error('Invalid timestamp (zero and was explicitly forbidden)');
    }
    if (args.expectedUnit === 'seconds') {
      if (!isValidTimestampSeconds(value)) {
        throw new Error(`Invalid timestamp (expected seconds): ${value}`);
      }
      this.value = value;
      this.type = 'seconds';
      return;
    }
    if (args.expectedUnit === 'ms') {
      if (!isValidTimestampMs(value)) {
        throw new Error(`Invalid timestamp (expected ms): ${value}`);
      }
      this.value = value;
      this.type = 'ms';
      return;
    }

    // generic case, guess the unit of it
    if (isValidTimestampSeconds(value)) {
      this.value = value;
      this.type = 'seconds';
    } else if (isValidTimestampMs(value)) {
      this.value = value;
      this.type = 'ms';
    } else {
      throw new Error(`Invalid timestamp: ${value}`);
    }
  }

  ms(): number {
    if (this.type === 'ms') {
      return this.value;
    }
    return this.value * 1000;
  }

  seconds(): number {
    if (this.type === 'seconds') {
      return this.value;
    }
    return Math.floor(this.value / 1000);
  }
}
