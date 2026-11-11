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
  const originalMessage = generateFakeIncomingPrivateMessage();

  beforeEach(() => {
    Sinon.stub(ConvoHub.use(), 'get').returns({ isOpenGroupV2: () => true } as any);
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
      '👍': { index: 1, count: 1, you: true, senders: [] },
    });
  });
});
