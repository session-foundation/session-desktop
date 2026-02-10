import { expect } from 'chai';

import { SignalService } from '../../../../protobuf';
import { Constants } from '../../../../session';
import { TypingMessage } from '../../../../session/messages/outgoing/controlMessage/TypingMessage';
import { longOrNumberToNumber } from '../../../../types/long/longOrNumberToNumber';
import { uuidV4 } from '../../../../util/uuid';

describe('TypingMessage', () => {
  it('has Action.STARTED if isTyping = true', () => {
    const message = new TypingMessage({
      createAtNetworkTimestamp: Date.now(),
      isTyping: true,
      dbMessageIdentifier: uuidV4(),
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);
    expect(decoded.typingMessage).to.have.property(
      'action',
      SignalService.TypingMessage.Action.STARTED
    );
  });

  it('has Action.STOPPED if isTyping = false', () => {
    const message = new TypingMessage({
      createAtNetworkTimestamp: Date.now(),
      isTyping: false,
      dbMessageIdentifier: uuidV4(),
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);
    expect(decoded.typingMessage).to.have.property(
      'action',
      SignalService.TypingMessage.Action.STOPPED
    );
  });

  it('has typingTimestamp set with Date.now() if value not passed', () => {
    const message = new TypingMessage({
      createAtNetworkTimestamp: Date.now(),
      isTyping: true,
      dbMessageIdentifier: uuidV4(),
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);
    const timestamp = longOrNumberToNumber(decoded?.typingMessage?.timestamp ?? 0);

    expect(timestamp).to.be.approximately(Date.now(), 10);
  });

  it('correct ttl', () => {
    const message = new TypingMessage({
      createAtNetworkTimestamp: Date.now(),
      isTyping: true,
      dbMessageIdentifier: uuidV4(),
    });
    expect(message.ttl()).to.equal(Constants.TTL_DEFAULT.TYPING_MESSAGE);
  });

  it('has a dbMessageIdentifier', () => {
    const message = new TypingMessage({
      createAtNetworkTimestamp: Date.now(),
      isTyping: true,
      dbMessageIdentifier: uuidV4(),
    });
    expect(message.dbMessageIdentifier).to.not.equal(null, 'dbMessageIdentifier cannot be null');
    expect(message.dbMessageIdentifier).to.not.equal(
      undefined,
      'dbMessageIdentifier cannot be undefined'
    );
  });
});
