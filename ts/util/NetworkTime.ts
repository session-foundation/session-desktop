import { Timestamp } from '../types/timestamp/timestamp';

let latestTimestampOffset = Number.MAX_SAFE_INTEGER;

/**
 * This function has no use to be called except during tests.
 * @returns the current offset we have with the rest of the network.
 */
function getLatestTimestampOffset() {
  if (latestTimestampOffset === Number.MAX_SAFE_INTEGER) {
    window.log.debug('latestTimestampOffset is not set yet');
    return 0;
  }
  // window.log.info('latestTimestampOffset is ', latestTimestampOffset);

  return latestTimestampOffset;
}

function setLatestTimestampOffset(newOffset: number) {
  latestTimestampOffset = newOffset;
  if (latestTimestampOffset === Number.MAX_SAFE_INTEGER) {
    window?.log?.info(`first timestamp offset received:  ${newOffset}ms`);
  }
  latestTimestampOffset = newOffset;
}

function now() {
  // make sure to call NetworkTime here, as we stub the exported one for testing.
  return Date.now() - NetworkTime.getLatestTimestampOffset();
}

function nowSeconds() {
  return Math.floor(NetworkTime.now() / 1000);
}

/**
 * Returns the current timestamp as a Timestamp object.
 */
function nowTs() {
  return new Timestamp({ value: NetworkTime.now(), expectedUnit: 'ms' });
}

export const NetworkTime = {
  getLatestTimestampOffset,
  now,
  nowTs,
  nowSeconds,
  setLatestTimestampOffset,
};
