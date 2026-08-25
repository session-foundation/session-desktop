import { expect } from 'chai';
import Sinon from 'sinon';

import { Data } from '../../../../data/data';
import type { ConversationModel } from '../../../../models/conversation';
import { SettingsKey } from '../../../../data/settings-key';
import { TestUtils } from '../../../test-utils';
import { UserUtils } from '../../../../session/utils';

describe('addProFeaturesToStats', () => {
  let increment: Sinon.SinonStub;

  beforeEach(() => {
    TestUtils.stubWindowLog();
    Sinon.stub(UserUtils, 'getOurPubKeyStrFromCache').returns(TestUtils.generateFakePubKeyStr());
    Sinon.stub(Data, 'saveMessage').resolves('fake-id');
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
});
