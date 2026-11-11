import { expect } from 'chai';
import Sinon from 'sinon';

import { Data } from '../../../../data/data';
import { ConvoHub } from '../../../../session/conversations';
import { OpenGroupReactionList } from '../../../../types/Reaction';
import { Reactions } from '../../../../util/reactions';
import { TestUtils } from '../../../test-utils';
import { generateFakeIncomingPrivateMessage, stubWindowLog } from '../../../test-utils/utils';

describe('handleOpenGroupMessageReactions', () => {
  stubWindowLog();

  const conversationId = 'http://example.org/room';
  const reactor = TestUtils.generateFakePubKeyStr();
  const me = TestUtils.generateFakePubKeyStr();
  const originalMessage = generateFakeIncomingPrivateMessage();

  beforeEach(() => {
    const convo = { isOpenGroupV2: () => true, getUsInThatConversation: () => me } as any;
    Sinon.stub(ConvoHub.use(), 'get').returns(convo);
    Sinon.stub(originalMessage, 'getConversation').returns(convo);
    Sinon.stub(Data, 'getMessageByServerId').resolves(originalMessage);
    Sinon.stub(originalMessage, 'commit').resolves();
  });

  afterEach(Sinon.restore);

  it('keeps the reactors sent by the server', async () => {
    const reactions: OpenGroupReactionList = {
      '😄': { index: 0, count: 1, you: false, reactors: [reactor] },
    };

    const updated = await Reactions.handleOpenGroupMessageReactions(conversationId, 111, reactions);

    expect(updated?.get('reacts')).to.be.deep.equal({
      '😄': { index: 0, count: 1, you: false, senders: [reactor] },
    });
  });

  it('handles reactions without reactors', async () => {
    const reactions: OpenGroupReactionList = {
      '😄': { index: 0, count: 2, you: false },
      '👍': { index: 1, count: 1, you: true },
    };

    const updated = await Reactions.handleOpenGroupMessageReactions(conversationId, 111, reactions);

    expect(updated?.get('reacts')).to.be.deep.equal({
      '😄': { index: 0, count: 2, you: false, senders: [] },
      '👍': { index: 1, count: 1, you: true, senders: [me] },
    });
  });

  it('lists us first when we reacted, without changing its input', async () => {
    const reactions: OpenGroupReactionList = {
      '😄': { index: 0, count: 2, you: true, reactors: [reactor] },
    };

    const updated = await Reactions.handleOpenGroupMessageReactions(conversationId, 111, reactions);

    expect(updated?.get('reacts')).to.be.deep.equal({
      '😄': { index: 0, count: 2, you: true, senders: [me, reactor] },
    });
    expect(reactions['😄'].reactors).to.be.deep.equal([reactor]);
  });
});
