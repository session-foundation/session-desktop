import { expect } from 'chai';
import Sinon from 'sinon';

import { Data } from '../../../../data/data';
import type { ConversationModel } from '../../../../models/conversation';
import { SettingsKey } from '../../../../data/settings-key';
import { TestUtils } from '../../../test-utils';
import { UserUtils } from '../../../../session/utils';
import { OutgoingProMessageDetails } from '../../../../types/message/OutgoingProMessageDetails';

describe('addProFeaturesToStats', () => {
  let increment: Sinon.SinonStub;
  let saveMessage: Sinon.SinonStub;

  beforeEach(() => {
    TestUtils.stubWindowLog();
    Sinon.stub(UserUtils, 'getOurPubKeyStrFromCache').returns(TestUtils.generateFakePubKeyStr());
    saveMessage = Sinon.stub(Data, 'saveMessage').resolves('fake-id');
    increment = TestUtils.stubStorage('increment');
  });

  afterEach(() => {
    Sinon.restore();
  });

  function makeSentProMessage() {
    const message = TestUtils.generateFakeOutgoingPrivateMessage();
    // The mask for PRO_INCREASED_MESSAGE_LENGTH on a proMessage bitset, per getBitMaskForFeature.
    message.setProFeaturesUsed({ proMessageBitset: BigInt(1), proProfileBitset: null });
    Sinon.stub(message, 'getConversation').returns({
      updateLastMessage: Sinon.stub(),
    } as unknown as ConversationModel);

    return message;
  }

  it('counts a message once', async () => {
    const message = makeSentProMessage();

    await message.addProFeaturesToStats();

    expect(increment.calledOnceWith(SettingsKey.proLongerMessagesSent)).to.equal(true);
  });

  it('does not count the same message a second time', async () => {
    const message = makeSentProMessage();

    // A single success can be reported more than once — a 1:1 message reports again for its own sync
    // copy — so the second report must not add to the stats.
    await message.addProFeaturesToStats();
    await message.addProFeaturesToStats();

    expect(increment.callCount).to.equal(1);
  });

  it('counts nothing for a message that used no Pro features', async () => {
    const message = TestUtils.generateFakeOutgoingPrivateMessage();
    Sinon.stub(message, 'getConversation').returns({
      updateLastMessage: Sinon.stub(),
    } as unknown as ConversationModel);

    await message.addProFeaturesToStats();

    expect(increment.called).to.equal(false);
  });

  it('does not count while the message is only being composed', async () => {
    // The regression this exists to hold: the counters used to be incremented here, before the message
    // was ever sent, so anything that failed to send was counted anyway. Moving them back would pass
    // every other test in this file.
    const message = TestUtils.generateFakeOutgoingPrivateMessage();
    Sinon.stub(message, 'getConversation').returns({
      updateLastMessage: Sinon.stub(),
    } as unknown as ConversationModel);

    // toProtobufDetails() is stubbed rather than fed a real proof: this test is about whether composing
    // touches the counters, and building a valid proof would only add crypto helpers to the setup. The
    // bitset assertion below is what proves the store actually ran, so the test cannot pass vacuously.
    const details = new OutgoingProMessageDetails({ proMessageBitset: BigInt(1) });
    Sinon.stub(details, 'toProtobufDetails').returns({
      messageBitset: 1,
      profileBitset: 0,
    } as unknown as ReturnType<OutgoingProMessageDetails['toProtobufDetails']>);

    await message.applyProFeatures(details);

    expect(
      message.get('proMessageBitset'),
      'the bitset must still be stored at compose time'
    ).to.not.equal(undefined);
    expect(increment.called, 'composing a message must not touch the stats').to.equal(false);
  });

  it('persists the counted flag with the message', async () => {
    // The once-only guard is only worth anything if it survives a restart, so assert it reaches what
    // gets written rather than only the in-memory model.
    const message = makeSentProMessage();

    await message.addProFeaturesToStats();

    const saved = saveMessage.lastCall.args[0] as { proStatsCounted?: boolean };
    expect(
      saved.proStatsCounted,
      'proStatsCounted must be part of the persisted attributes'
    ).to.equal(true);
  });

  it('counts a copy of our own message synced from another device', async () => {
    // That copy is a different message record from the one the sending device counted, so it starts
    // uncounted — which is what lets a linked device stay level rather than the flag suppressing it.
    const synced = TestUtils.generateFakeOutgoingPrivateMessage();
    synced.setProFeaturesUsed({ proMessageBitset: BigInt(1), proProfileBitset: null });
    Sinon.stub(synced, 'getConversation').returns({
      updateLastMessage: Sinon.stub(),
    } as unknown as ConversationModel);

    expect(synced.get('proStatsCounted'), 'a freshly received copy must start uncounted').to.equal(
      undefined
    );

    await synced.addProFeaturesToStats();

    expect(increment.calledOnceWith(SettingsKey.proLongerMessagesSent)).to.equal(true);
  });
});
