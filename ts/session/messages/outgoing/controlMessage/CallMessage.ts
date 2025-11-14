import { SignalService } from '../../../../protobuf';
import { TTL_DEFAULT } from '../../../constants';
import { ExpirableMessageNoProfile, ExpirableMessageParams } from '../ExpirableMessage';

type CallMessageParams = ExpirableMessageParams & {
  type: SignalService.CallMessage.Type;
  sdpMLineIndexes?: Array<number>;
  sdpMids?: Array<string>;
  sdps?: Array<string>;
  uuid: string;
};

export class CallMessage extends ExpirableMessageNoProfile {
  public readonly type: SignalService.CallMessage.Type;
  public readonly sdpMLineIndexes?: Array<number>;
  public readonly sdpMids?: Array<string>;
  public readonly sdps?: Array<string>;
  public readonly uuid: string;

  constructor(params: CallMessageParams) {
    super(params);
    this.type = params.type;
    this.sdpMLineIndexes = params.sdpMLineIndexes;
    this.sdpMids = params.sdpMids;
    this.sdps = params.sdps;
    this.uuid = params.uuid;

    // this does not make any sense
    if (
      this.type !== SignalService.CallMessage.Type.END_CALL &&
      this.type !== SignalService.CallMessage.Type.PRE_OFFER &&
      (!this.sdps || this.sdps.length === 0)
    ) {
      throw new Error('sdps must be set unless this is a END_CALL type message');
    }
    if (this.uuid.length === 0) {
      throw new Error('uuid must cannot be empty');
    }
  }

  public override contentProto(): SignalService.Content {
    const content = super.makeDisappearingContentProto();
    content.callMessage = this.callProto();
    return content;
  }

  public ttl() {
    return TTL_DEFAULT.CALL_MESSAGE;
  }

  private callProto(): SignalService.CallMessage {
    return new SignalService.CallMessage({
      type: this.type,
      sdpMLineIndexes: this.sdpMLineIndexes,
      sdpMids: this.sdpMids,
      sdps: this.sdps,
      uuid: this.uuid,
    });
  }
}
