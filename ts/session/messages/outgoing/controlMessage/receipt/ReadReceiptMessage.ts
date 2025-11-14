import { ContentMessage } from '../..';
import { SignalService } from '../../../../../protobuf';
import { MessageParams } from '../../Message';

type ReadReceiptMessageParams = MessageParams & {
  timestamps: Array<number>;
};

export class ReadReceiptMessage extends ContentMessage {
  public readonly timestamps: Array<number>;

  constructor({ createAtNetworkTimestamp, identifier, timestamps }: ReadReceiptMessageParams) {
    super({ createAtNetworkTimestamp, identifier });
    this.timestamps = timestamps;
  }

  public contentProto(): SignalService.Content {
    // Note: read receipts are not disappearing messages
    return super.makeNonDisappearingContentProto({ receiptMessage: this.receiptProto() });
  }

  protected receiptProto(): SignalService.ReceiptMessage {
    return new SignalService.ReceiptMessage({
      type: SignalService.ReceiptMessage.Type.READ,
      timestamp: this.timestamps,
    });
  }

  public proMessageProto() {
    return null;
  }

  public lokiProfileProto() {
    return {};
  }
}
