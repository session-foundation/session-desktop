import { ContentMessageNoProfile } from '../..';
import { SignalService } from '../../../../../protobuf';
import { MessageParams } from '../../Message';

type ReadReceiptMessageParams = MessageParams & {
  timestamps: Array<number>;
};

export class ReadReceiptMessage extends ContentMessageNoProfile {
  public readonly timestamps: Array<number>;

  constructor({
    createAtNetworkTimestamp,
    dbMessageIdentifier,
    timestamps,
  }: ReadReceiptMessageParams) {
    super({ createAtNetworkTimestamp, dbMessageIdentifier });
    this.timestamps = timestamps;
  }

  public override contentProto(): SignalService.Content {
    // Note: read receipts are not disappearing messages
    const content = super.makeNonDisappearingContentProto();

    content.receiptMessage = new SignalService.ReceiptMessage({
      type: SignalService.ReceiptMessage.Type.READ,
      timestamp: this.timestamps,
    });
    return content;
  }
}
