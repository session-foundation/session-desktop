import { expect } from 'chai';
import Sinon from 'sinon';

import { Data } from '../../../../data/data';
import type { ConversationModel } from '../../../../models/conversation';
import { SignalService } from '../../../../protobuf';
import { MessageSentHandler } from '../../../../session/sending/MessageSentHandler';
import { UserUtils } from '../../../../session/utils';
import { TestUtils } from '../../../test-utils';

/**
 * The composing device must not count its own message twice.
 *
 * `dataMessage.ts` counts an outgoing message arriving synced from another of our devices, and argues
 * it is safe on the device that composed it because "its own copy is dropped as a duplicate above".
 * That dedup is `WHERE source = $source AND sent_at = $sentAt`, so it can only match once this handler
 * has PERSISTED the `sent_at` the message went out under.
 *
 * The sync copy is dispatched first and `sent_at` is committed after, so between those two points the
 * stored row still carries its compose-time `sent_at`. A copy returning inside that window does not
 * match, is stored as a second record, and both records get counted — which is the +2 the Pro stats
 * spec sees for a single send.
 */
describe('handleSwarmMessageSentSuccess / Pro stats double counting', () => {
  const SENT_AT = 1_700_000_000_000;
  const COMPOSED_AT = SENT_AT - 250;

  beforeEach(() => {
    TestUtils.stubWindowLog();
    Sinon.stub(UserUtils, 'getOurPubKeyStrFromCache').returns(TestUtils.generateFakePubKeyStr());
    Sinon.stub(UserUtils, 'isUsFromCache').returns(false);
  });

  afterEach(() => {
    Sinon.restore();
  });

  it('commits the sent_at it sent under before dispatching the sync copy', async () => {
    const message = TestUtils.generateFakeOutgoingPrivateMessage();
    message.set({ sent_at: COMPOSED_AT });
    Sinon.stub(message, 'getConversation').returns({
      updateLastMessage: Sinon.stub(),
      // `checkForExpiringOutgoingMessage` runs between the sync dispatch and the commit, so the stub
      // has to survive it for the ordering assertion to be reached at all.
      isClosedGroup: () => false,
    } as unknown as ConversationModel);

    const sendSyncMessage = Sinon.stub(message, 'sendSyncMessage').resolves();
    const commit = Sinon.stub(message, 'commit').resolves('fake-id');
    Sinon.stub(message, 'addProFeaturesToStats').resolves();
    Sinon.stub(message, 'updateMessageHash');
    Sinon.stub(Data, 'getMessageById').resolves(message);

    await MessageSentHandler.handleSwarmMessageSentSuccess({
      device: TestUtils.generateFakePubKeyStr(),
      dbMessageIdentifier: message.id,
      isDestinationClosedGroup: false,
      // Required for the sync branch: the handler decodes this to re-encrypt for our linked devices.
      plainTextBuffer: SignalService.Content.encode({
        dataMessage: { body: 'a message that used a Pro feature' },
      }).finish(),
      sentAtMs: SENT_AT,
      storedAtServerMs: SENT_AT,
      storedHash: null,
    });

    // Not an assertion about the bug — a guard, so a setup that stops short of the sync branch fails
    // loudly rather than passing on an ordering it never exercised.
    expect(
      sendSyncMessage.called,
      'the sync path did not run, so this test asserted nothing'
    ).to.equal(true);

    expect(
      commit.calledBefore(sendSyncMessage),
      'the sync copy went out before sent_at was persisted, so the composing device cannot recognise ' +
        'its own copy as a duplicate and counts the message twice'
    ).to.equal(true);
  });
});
