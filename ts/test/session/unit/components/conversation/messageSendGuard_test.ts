import chai from 'chai';

import { createMessageSendGuard } from '../../../../../components/conversation/composition/messageSendGuard';

const { expect } = chai;

describe('createMessageSendGuard', () => {
  it('ignores another send to the same conversation while one is in progress', async () => {
    const sendMessage = createMessageSendGuard();
    let resolveFirstSend!: () => void;
    let sendCount = 0;

    const firstSend = sendMessage(
      'conversation-a',
      () =>
        new Promise<void>(resolve => {
          sendCount += 1;
          resolveFirstSend = resolve;
        })
    );
    await sendMessage('conversation-a', async () => {
      sendCount += 1;
    });

    expect(sendCount).to.equal(1);

    resolveFirstSend();
    await firstSend;
    await sendMessage('conversation-a', async () => {
      sendCount += 1;
    });

    expect(sendCount).to.equal(2);
  });

  it('allows sends to different conversations at the same time', async () => {
    const sendMessage = createMessageSendGuard();
    let resolveFirstSend!: () => void;
    let secondSendCompleted = false;

    const firstSend = sendMessage(
      'conversation-a',
      () =>
        new Promise<void>(resolve => {
          resolveFirstSend = resolve;
        })
    );
    await sendMessage('conversation-b', async () => {
      secondSendCompleted = true;
    });

    expect(secondSendCompleted).to.equal(true);

    resolveFirstSend();
    await firstSend;
  });

  it('allows another send after a failure', async () => {
    const sendMessage = createMessageSendGuard();
    const failure = new Error('send failed');
    let caught: unknown;

    try {
      await sendMessage('conversation-a', async () => {
        throw failure;
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).to.equal(failure);

    let didRetry = false;
    await sendMessage('conversation-a', async () => {
      didRetry = true;
    });

    expect(didRetry).to.equal(true);
  });
});
