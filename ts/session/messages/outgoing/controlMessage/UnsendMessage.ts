import { isFinite } from 'lodash';
import { SignalService } from '../../../../protobuf';
import { ContentMessageNoProfile } from '../ContentMessage';
import { MessageParams } from '../Message';

type UnsendMessageParams = MessageParams & {
  author: string;
  referencedMessageTimestamp: number;
};

export class UnsendMessage extends ContentMessageNoProfile {
  private readonly author: string;
  private readonly referencedMessageTimestamp: UnsendMessageParams['referencedMessageTimestamp'];

  constructor(params: UnsendMessageParams) {
    super({
      createAtNetworkTimestamp: params.createAtNetworkTimestamp,
      author: params.author,
    } as MessageParams);
    this.author = params.author;
    if (
      !params.referencedMessageTimestamp ||
      !isFinite(params.referencedMessageTimestamp) ||
      params.referencedMessageTimestamp < 0
    ) {
      throw new Error('expected referencedMessageTimestamp to be a finite >=0 number');
    }
    this.referencedMessageTimestamp = params.referencedMessageTimestamp;
  }

  public override contentProto(): SignalService.Content {
    // Note: unsend messages are not disappearing messages
    const content = super.makeNonDisappearingContentProto();

    content.unsendRequest = new SignalService.UnsendRequest({
      timestamp: this.referencedMessageTimestamp,
      author: this.author,
    });

    return content;
  }
}
