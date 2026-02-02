import { Timestamp } from '../types/timestamp/timestamp';

const rollingAverageWindowSize = 10;

const defaultValue = Number.MAX_SAFE_INTEGER;
const latestTimestampOffsets = Array(rollingAverageWindowSize).fill(defaultValue);
let currentIndex = 0;

function getAverageTimestampOffset() {
  const toConsider = latestTimestampOffsets.filter(offset => offset !== defaultValue);
  if (toConsider.length === 0) {
    return defaultValue;
  }
  const average = toConsider.reduce((acc, offset) => acc + offset, 0) / toConsider.length;
  return Math.floor(average);
}

/**
 * This function has no use to be called except during tests.
 * @returns the current offset we have with the rest of the network.
 */
function getLatestTimestampOffset() {
  const latestTimestampOffset = getAverageTimestampOffset();
  if (latestTimestampOffset === defaultValue) {
    window.log.debug('latestTimestampOffset is not set yet');
    return 0;
  }
  // window.log.info('latestTimestampOffset is ', latestTimestampOffset);

  return latestTimestampOffset;
}

function setLatestTimestampOffset(newOffset: number, request: string) {
  const previousTimestampOffset =
    latestTimestampOffsets[currentIndex] === defaultValue
      ? 0
      : latestTimestampOffsets[currentIndex];

  const newIndex = (currentIndex + 1) % rollingAverageWindowSize;
  latestTimestampOffsets[newIndex] = newOffset;

  if (currentIndex === 0 && latestTimestampOffsets.every(offset => offset === defaultValue)) {
    window?.log?.info(`first timestamp offset received:  ${newOffset}ms`);
  } else if (Math.abs(previousTimestampOffset - newOffset) > 1000) {
    window?.log?.debug(
      `latestTimestampOffset changed more than 1s, from ${previousTimestampOffset}ms to ${newOffset}ms on request "${request}" but we have a rolling average of ${getAverageTimestampOffset()}ms`
    );
  }
  currentIndex = newIndex;
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

function reset() {
  latestTimestampOffsets.fill(defaultValue);
  currentIndex = 0;
}

export const NetworkTime = {
  getLatestTimestampOffset,
  now,
  nowTs,
  nowSeconds,
  setLatestTimestampOffset,
  reset,
};
