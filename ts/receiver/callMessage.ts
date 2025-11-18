import { SignalService } from '../protobuf';
import { TTL_DEFAULT } from '../session/constants';
import { CallManager, UserUtils } from '../session/utils';
import { WithOptExpireUpdate } from '../session/utils/calling/CallManager';
import { type SwarmDecodedEnvelope } from './types';
import { WithMessageHash } from '../session/types/with';
import { NetworkTime } from '../util/NetworkTime';

// messageHash & messageHash are only needed for actions adding a callMessage to the database (so they expire)
export async function handleCallMessage(
  envelope: SwarmDecodedEnvelope,
  callMessage: SignalService.CallMessage,
  expireDetails: WithOptExpireUpdate & WithMessageHash
) {
  const { Type } = SignalService.CallMessage;
  const sender = envelope.getAuthor();

  const { type } = callMessage;

  // we just allow self send of ANSWER/END_CALL message to remove the incoming call dialog when we accepted it from another device
  if (
    sender === UserUtils.getOurPubKeyStrFromCache() &&
    callMessage.type !== Type.ANSWER &&
    callMessage.type !== Type.END_CALL
  ) {
    window.log.info('Dropping incoming call from ourself');
    return;
  }

  if (CallManager.isCallRejected(callMessage.uuid)) {
    window.log.info(`Dropping already rejected call from this device ${callMessage.uuid}`);
    return;
  }

  if (type === Type.PROVISIONAL_ANSWER || type === Type.PRE_OFFER) {
    return;
  }

  if (type === Type.OFFER) {
    if (Math.max(envelope.sentAtMs - NetworkTime.now()) > TTL_DEFAULT.CALL_MESSAGE) {
      window?.log?.info(
        'Dropping incoming OFFER callMessage sent a while ago: ',
        envelope.sentAtMs
      );

      return;
    }

    await CallManager.handleCallTypeOffer(sender, callMessage, envelope.sentAtMs, expireDetails);

    return;
  }

  if (type === SignalService.CallMessage.Type.END_CALL) {
    await CallManager.handleCallTypeEndCall(sender, callMessage.uuid);

    return;
  }

  if (type === SignalService.CallMessage.Type.ANSWER) {
    await CallManager.handleCallTypeAnswer(sender, callMessage, envelope.sentAtMs, expireDetails);

    return;
  }
  if (type === SignalService.CallMessage.Type.ICE_CANDIDATES) {
    await CallManager.handleCallTypeIceCandidates(sender, callMessage, envelope.sentAtMs);

    return;
  }

  // if this another type of call message, just add it to the manager
  await CallManager.handleOtherCallTypes(sender, callMessage, envelope.sentAtMs);
}
