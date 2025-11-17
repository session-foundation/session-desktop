import { type DecodedEnvelope } from './types';
import { DURATION } from '../session/constants';
import { longOrNumberToNumber } from '../types/long/longOrNumberToNumber';

export function getEnvelopeId(envelope: DecodedEnvelope) {
  if (envelope.source) {
    return `${envelope.source} ${longOrNumberToNumber(envelope.sentAtMs)} (${envelope.id})`;
  }

  return envelope.id;
}

export function shouldProcessContentMessage({
  sentAtMs,
  isCommunity,
  sigTimestampMs,
}: {
  sentAtMs: number;
  sigTimestampMs: number;
  isCommunity: boolean;
}) {
  // FIXME: drop this case once the change has been out in the wild long enough
  if (!sentAtMs || !longOrNumberToNumber(sigTimestampMs)) {
    // legacy client
    return true;
  }
  const envelopeTimestamp = longOrNumberToNumber(sentAtMs);
  const contentTimestamp = longOrNumberToNumber(sigTimestampMs);
  if (!isCommunity) {
    return envelopeTimestamp === contentTimestamp;
  }
  // we want to process a community message and allow a window of 6 hours
  return Math.abs(envelopeTimestamp - contentTimestamp) <= 6 * DURATION.HOURS;
}
