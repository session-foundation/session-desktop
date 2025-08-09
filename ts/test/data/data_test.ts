import { afterEach, beforeEach, describe } from 'mocha';
import Sinon from 'sinon';
import { expect } from 'chai';
import { Data } from '../../data/data';
import { ConversationModel } from '../../models/conversation';
import { channels } from '../../data/channels';

describe('data', () => {
  afterEach(() => {
    Sinon.restore();
  });

  describe('getAllConversations', () => {
    let getAllConversationsStub: Record<string, any>;
    beforeEach(() => {
      channels.getAllConversations = () => {};

      getAllConversationsStub = Sinon.stub(channels, 'getAllConversations');
    });

    it('returns empty array when channels.getAllConversations yields invalid conversations', async () => {
      getAllConversationsStub.resolves([{} as any, { id: 123 } as any]);

      const conversations = await Data.getAllConversations();

      expect(conversations).to.be.an('array');
      expect(conversations).to.deep.equal([]);
      expect(getAllConversationsStub.calledOnce).to.eq(true);
    });

    it('returns array of ConversationModel for valid conversations', async () => {
      const attrs = [{ id: 'abc' } as any, { id: 'def' } as any];
      const stub = getAllConversationsStub.resolves(attrs);

      const conversations = await Data.getAllConversations();

      expect(conversations).to.be.an('array');
      expect(conversations).to.have.length(2);
      expect(conversations[0]).to.be.instanceOf(ConversationModel);
      expect(conversations[1]).to.be.instanceOf(ConversationModel);
      expect(stub.calledOnce).to.eq(true);
    });

    it('filters out invalid and keeps valid when mixed', async () => {
      const stub = getAllConversationsStub.resolves([
        { id: 'ok' } as any,
        {} as any,
        { id: null } as any,
        { id: 'ok2' } as any,
      ]);

      const conversations = await Data.getAllConversations();

      expect(conversations).to.be.an('array');
      expect(conversations).to.have.length(2);
      expect(conversations.every(c => c instanceof ConversationModel)).to.eq(true);
      expect(stub.calledOnce).to.eq(true);
    });
  });
});
