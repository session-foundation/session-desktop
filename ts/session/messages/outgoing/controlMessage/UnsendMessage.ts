import { isFinite } from 'lodash';
import { SignalService } from '../../../../protobuf';
import { ContentMessage } from '../ContentMessage';
import { MessageParams } from '../Message';

interface UnsendMessageParams extends MessageParams {
  author: string;
  referencedMessageTimestamp: number;
}

export class UnsendMessage extends ContentMessage {
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

  public contentProto(): SignalService.Content {
    return super.makeContentProto({ unsendMessage: this.unsendProto() });
  }

  public unsendProto(): SignalService.Unsend {
    return new SignalService.Unsend({
      timestamp: this.referencedMessageTimestamp,
      author: this.author,
    });
  }
}
