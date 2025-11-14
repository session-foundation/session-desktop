import { SignalService } from '../../../../protobuf';
import { PubKey } from '../../../types';
import { DataMessageNoProfile } from '../DataMessage';
import { ExpirableMessageParams } from '../ExpirableMessage';

type ExpirationTimerUpdateMessageParams = ExpirableMessageParams & {
  syncTarget?: string | PubKey;
};

// NOTE legacy messages used a data message for the expireTimer.
// The new ones use properties on the Content Message

export class ExpirationTimerUpdateMessage extends DataMessageNoProfile {
  public readonly syncTarget?: string;

  constructor(params: ExpirationTimerUpdateMessageParams) {
    super({
      createAtNetworkTimestamp: params.createAtNetworkTimestamp,
      identifier: params.identifier,
      expirationType: params.expirationType,
      expireTimer: params.expireTimer,
    });

    this.syncTarget = params.syncTarget ? PubKey.cast(params.syncTarget).key : undefined;
  }

  // Note: DataMessage::contentProto is already what we need here, so no need to rewrite it

  public override dataProto(): SignalService.DataMessage {
    const proto = super.makeDataProtoNoProfile();
    proto.flags = SignalService.DataMessage.Flags.EXPIRATION_TIMER_UPDATE;

    if (this.syncTarget) {
      proto.syncTarget = this.syncTarget;
    }

    return proto;
  }

  public ttl(): number {
    return super.ttl();
  }
}
