import { toNumber } from 'lodash';
import { EnvelopePlus } from './types';
import type { SignalService } from '../protobuf';
import { DURATION } from '../session/constants';

export function getEnvelopeId(envelope: EnvelopePlus) {
  if (envelope.source) {
    return `${envelope.source} ${toNumber(envelope.timestamp)} (${envelope.id})`;
  }

  return envelope.id;
}

export function shouldProcessContentMessage(
  envelope: Pick<EnvelopePlus, 'timestamp'>,
  content: Pick<SignalService.Content, 'sigTimestamp'>,
  isCommunity: boolean
) {
  // FIXME: drop this case once the change has been out in the wild long enough
  if (!content.sigTimestamp || !toNumber(content.sigTimestamp)) {
    // legacy client
    return true;
  }
  const envelopeTimestamp = toNumber(envelope.timestamp);
  const contentTimestamp = toNumber(content.sigTimestamp);
  if (!isCommunity) {
    return envelopeTimestamp === contentTimestamp;
  }
  // we want to process a community message and allow a window of 6 hours
  return Math.abs(envelopeTimestamp - contentTimestamp) <= 6 * DURATION.HOURS;
}
