import { SignalService } from '../../../../protobuf';
import { PubKey } from '../../../types';
import { DataMessage } from '../DataMessage';
import { ExpirableMessageParams } from '../ExpirableMessage';

type ExpirationTimerUpdateMessageParams = ExpirableMessageParams & {
  syncTarget?: string | PubKey;
};

// NOTE legacy messages used a data message for the expireTimer.
// The new ones use properties on the Content Message

export class ExpirationTimerUpdateMessage extends DataMessage {
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

  public contentProto(): SignalService.Content {
    // Note: we do not want this one to call `makeContentProto` because super.contentProto() does it and deals
    // with the expirable field for usn
    return new SignalService.Content({
      ...super.contentProto(),
      dataMessage: this.dataProto(),
    });
  }

  public dataProto(): SignalService.DataMessage {
    const data = new SignalService.DataMessage({});

    data.flags = SignalService.DataMessage.Flags.EXPIRATION_TIMER_UPDATE;

    if (this.syncTarget) {
      data.syncTarget = this.syncTarget;
    }

    return data;
  }

  public ttl(): number {
    return super.ttl();
  }
}
