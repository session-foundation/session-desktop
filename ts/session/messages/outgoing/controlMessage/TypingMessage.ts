import { ContentMessageNoProfile } from '..';
import { Constants } from '../../..';
import { SignalService } from '../../../../protobuf';
import { MessageParams } from '../Message';

type TypingMessageParams = MessageParams & {
  isTyping: boolean;
};

export class TypingMessage extends ContentMessageNoProfile {
  public readonly isTyping: boolean;

  constructor(params: TypingMessageParams) {
    super({
      createAtNetworkTimestamp: params.createAtNetworkTimestamp,
      identifier: params.identifier,
    });
    this.isTyping = params.isTyping;
  }

  public ttl(): number {
    return Constants.TTL_DEFAULT.TYPING_MESSAGE;
  }

  public override contentProto(): SignalService.Content {
    // Note: typing messages are not disappearing messages
    const content = super.makeNonDisappearingContentProto();

    const typingMessage = new SignalService.TypingMessage();
    typingMessage.action = this.isTyping
      ? SignalService.TypingMessage.Action.STARTED
      : SignalService.TypingMessage.Action.STOPPED;
    typingMessage.timestamp = this.createAtNetworkTimestamp;

    content.typingMessage = typingMessage;

    return content;
  }
}
