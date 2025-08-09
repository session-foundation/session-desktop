import { afterEach, beforeEach, describe } from 'mocha';
import Sinon from 'sinon';
import { expect } from 'chai';
import { Data } from '../../data/data';
import { channels } from '../../data/channels';
import * as dataInit from '../../data/dataInit';
import { GuardNode } from '../../data/types';
import { Storage } from '../../util/storage';
import * as cryptoUtils from '../../session/crypto';
import { ConversationAttributes } from '../../models/conversationAttributes';
import { ConversationModel } from '../../models/conversation';
import { SaveConversationReturn } from '../../types/sqlSharedTypes';

describe('data', () => {
  beforeEach(() => {
    channels.close = () => {};
    channels.removeDB = () => {};
    channels.getPasswordHash = () => {};
    channels.getGuardNodes = () => {};
    channels.updateGuardNodes = () => {};
    channels.getItemById = () => {};
    channels.createOrUpdateItem = () => {};
    channels.getSwarmNodesForPubkey = () => {};
    channels.updateSwarmNodesForPubkey = () => {};
    channels.clearOutAllSnodesNotInPool = () => {};
    channels.saveConversation = () => {};
    channels.fetchConvoMemoryDetails = () => {};
    channels.getConversationById = () => {};
    channels.removeConversation = () => {};
    channels.getAllConversations = () => {};
  });

  afterEach(() => {
    Sinon.restore();
  });

  describe('shutdown', () => {
    it('shuts down the data service', async () => {
      const shutdownStub = Sinon.stub(dataInit, 'shutdown');
      const closeStub = Sinon.stub(channels, 'close');

      await Data.shutdown();

      expect(closeStub.calledOnce).to.be.true;
      expect(shutdownStub.calledOnce).to.be.true;
    });
  });

  describe('close', () => {
    it('closes the data service', async () => {
      const closeStub = Sinon.stub(channels, 'close');

      await Data.close();

      expect(closeStub.calledOnce).to.be.true;
    });
  });

  describe('removeDB', () => {
    it('removes the database', async () => {
      const removeStub = Sinon.stub(channels, 'removeDB');

      await Data.removeDB();

      expect(removeStub.calledOnce).to.be.true;
    });
  });

  describe('getPasswordHash', () => {
    it('returns the password hash', async () => {
      const expectedPasswordHash = 'passwordHash';
      const getPasswordHashStub = Sinon.stub(channels, 'getPasswordHash').resolves(
        expectedPasswordHash
      );

      const actualPasswordHash = await Data.getPasswordHash();

      expect(getPasswordHashStub.calledOnce).to.be.true;
      expect(expectedPasswordHash).to.equal(actualPasswordHash);
    });
  });

  describe('getGuardNodes', () => {
    it('returns guard nodes', async () => {
      const expectedGuardNodes: Array<GuardNode> = [
        {
          ed25519PubKey: 'foobar',
        },
      ];

      const getGuardNodesStub = Sinon.stub(channels, 'getGuardNodes').resolves(expectedGuardNodes);
      const actualGuardNodes = await Data.getGuardNodes();

      expect(getGuardNodesStub.calledOnce).to.be.true;
      expect(expectedGuardNodes).to.deep.equal(actualGuardNodes);
    });
  });

  describe('updateGuardNodes', () => {
    it('updates guard nodes', async () => {
      const updateGuardNodesStub = Sinon.stub(channels, 'updateGuardNodes');
      const expectedGuardNodes = ['foo'];

      const result = await Data.updateGuardNodes(expectedGuardNodes);

      expect(updateGuardNodesStub.calledOnce).to.be.true;
      expect(updateGuardNodesStub.calledWith(expectedGuardNodes)).to.be.true;
      expect(result).to.be.undefined;
    });
  });

  describe('getSwarmNodesForPubkey', () => {
    it('returns swarm nodes for pubkey', async () => {
      const expectedPubkey = 'test_pubkey_123';
      const expectedSwarmNodes = ['node1', 'node2', 'node3'];

      const getSwarmNodesForPubkeyStub = Sinon.stub(channels, 'getSwarmNodesForPubkey').resolves(
        expectedSwarmNodes
      );
      const actualSwarmNodes = await Data.getSwarmNodesForPubkey(expectedPubkey);

      expect(getSwarmNodesForPubkeyStub.calledOnce).to.be.true;
      expect(getSwarmNodesForPubkeyStub.calledWith(expectedPubkey)).to.be.true;
      expect(expectedSwarmNodes).to.deep.equal(actualSwarmNodes);
    });
  });

  describe('updateSwarmNodesForPubkey', () => {
    it('updates swarm nodes for pubkey', async () => {
      const updateSwarmNodesForPubkeyStub = Sinon.stub(channels, 'updateSwarmNodesForPubkey');
      const expectedPubkey = 'test_pubkey_123';
      const expectedSnodeEdKeys = ['node1', 'node2', 'node3'];

      const result = await Data.updateSwarmNodesForPubkey(expectedPubkey, expectedSnodeEdKeys);

      expect(updateSwarmNodesForPubkeyStub.calledOnce).to.be.true;
      expect(updateSwarmNodesForPubkeyStub.calledWith(expectedPubkey, expectedSnodeEdKeys)).to.be
        .true;
      expect(result).to.be.undefined;
    });
  });

  describe('clearOutAllSnodesNotInPool', () => {
    it('clears out all snodes not in pool', async () => {
      const clearOutAllSnodesNotInPoolStub = Sinon.stub(channels, 'clearOutAllSnodesNotInPool');
      const expectedEdKeysOfSnodePool = ['snode1', 'snode2', 'snode3'];

      const result = await Data.clearOutAllSnodesNotInPool(expectedEdKeysOfSnodePool);

      expect(clearOutAllSnodesNotInPoolStub.calledOnce).to.be.true;
      expect(clearOutAllSnodesNotInPoolStub.calledWith(expectedEdKeysOfSnodePool)).to.be.true;
      expect(result).to.be.undefined;
    });
  });

  describe('saveConversation', () => {
    it('saves conversation with normal data', async () => {
      const conversationData: ConversationAttributes = {
        id: 'test_convo_123',
        active_at: 1234567890,
        type: 'private',
      } as ConversationAttributes;

      const expectedReturn: SaveConversationReturn = {
        unreadCount: 0,
        mentionedUs: false,
        lastReadTimestampMessage: null,
      };

      const saveConversationStub = Sinon.stub(channels, 'saveConversation').resolves(
        expectedReturn
      );
      const result = await Data.saveConversation(conversationData);

      expect(saveConversationStub.calledOnce).to.be.true;
      expect(saveConversationStub.calledWith(conversationData)).to.be.true;
      expect(result).to.deep.equal(expectedReturn);
    });

    it('updates active_at when it is -Infinity', async () => {
      const mockNow = 9876543210;
      const dateNowStub = Sinon.stub(Date, 'now').returns(mockNow);

      const conversationData: ConversationAttributes = {
        id: 'test_convo_123',
        active_at: -Infinity,
        type: 'private',
      } as ConversationAttributes;

      const expectedCleanedData = {
        id: 'test_convo_123',
        active_at: mockNow,
        type: 'private',
      };

      const expectedReturn: SaveConversationReturn = {
        unreadCount: 0,
        mentionedUs: false,
        lastReadTimestampMessage: null,
      };

      const saveConversationStub = Sinon.stub(channels, 'saveConversation').resolves(
        expectedReturn
      );
      const result = await Data.saveConversation(conversationData);

      expect(saveConversationStub.calledOnce).to.be.true;
      expect(saveConversationStub.calledWith(expectedCleanedData)).to.be.true;
      expect(result).to.deep.equal(expectedReturn);
      expect(dateNowStub.calledOnce).to.be.true;
    });
  });

  describe('generateAttachmentKeyIfEmpty', () => {
    it('does not generate a new key when one already exists', async () => {
      const existingKey = { id: 'local_attachment_encrypted_key', value: 'existing_key' };
      const getItemByIdStub = Sinon.stub(channels, 'getItemById').resolves(existingKey);
      const createOrUpdateItemStub = Sinon.stub(channels, 'createOrUpdateItem');
      const storagePutStub = Sinon.stub(Storage, 'put');

      await Data.generateAttachmentKeyIfEmpty();

      expect(getItemByIdStub.calledOnce).to.be.true;
      expect(getItemByIdStub.calledWith('local_attachment_encrypted_key')).to.be.true;
      expect(createOrUpdateItemStub.called).to.be.false;
      expect(storagePutStub.called).to.be.false;
    });

    it('generates a new key when none exists', async () => {
      const getItemByIdStub = Sinon.stub(channels, 'getItemById').resolves(undefined);
      const createOrUpdateItemStub = Sinon.stub(channels, 'createOrUpdateItem');
      const storagePutStub = Sinon.stub(Storage, 'put');
      const mockSodium = {
        to_hex: Sinon.stub().returns('generated_hex_key'),
        randombytes_buf: Sinon.stub().returns(new Uint8Array(32)),
      } as any;

      const getSodiumRendererStub = Sinon.stub(cryptoUtils, 'getSodiumRenderer').resolves(
        mockSodium
      );

      await Data.generateAttachmentKeyIfEmpty();

      expect(getItemByIdStub.calledOnce).to.be.true;
      expect(getItemByIdStub.calledWith('local_attachment_encrypted_key')).to.be.true;
      expect(getSodiumRendererStub.calledOnce).to.be.true;
      expect(mockSodium.randombytes_buf.calledWith(32)).to.be.true;
      expect(mockSodium.to_hex.calledOnce).to.be.true;
      expect(createOrUpdateItemStub.calledOnce).to.be.true;
      expect(
        createOrUpdateItemStub.calledWith({
          id: 'local_attachment_encrypted_key',
          value: 'generated_hex_key',
        })
      ).to.be.true;
      expect(storagePutStub.calledOnce).to.be.true;
      expect(storagePutStub.calledWith('local_attachment_encrypted_key', 'generated_hex_key')).to.be
        .true;
    });
  });

  describe('fetchConvoMemoryDetails', () => {
    it('fetches conversation memory details', async () => {
      const expectedConvoId = 'test_convo_123';
      const expectedReturn: SaveConversationReturn = {
        unreadCount: 5,
        mentionedUs: true,
        lastReadTimestampMessage: 1234567890,
      };

      const fetchConvoMemoryDetailsStub = Sinon.stub(channels, 'fetchConvoMemoryDetails').resolves(expectedReturn);
      const result = await Data.fetchConvoMemoryDetails(expectedConvoId);

      expect(fetchConvoMemoryDetailsStub.calledOnce).to.be.true;
      expect(fetchConvoMemoryDetailsStub.calledWith(expectedConvoId)).to.be.true;
      expect(result).to.deep.equal(expectedReturn);
    });
  });

  describe('getConversationById', () => {
    it('returns conversation model when conversation exists', async () => {
      const expectedId = 'test_convo_123';
      const conversationData: ConversationAttributes = {
        id: expectedId,
        type: 'private',
        active_at: 1234567890,
      } as ConversationAttributes;

      const getConversationByIdStub = Sinon.stub(channels, 'getConversationById').resolves(conversationData);
      const result = await Data.getConversationById(expectedId);

      expect(getConversationByIdStub.calledOnce).to.be.true;
      expect(getConversationByIdStub.calledWith(expectedId)).to.be.true;
      expect(result).to.be.instanceOf(ConversationModel);
      expect(result?.get('id')).to.equal(expectedId);
    });

    it('returns undefined when conversation does not exist', async () => {
      const expectedId = 'non_existent_convo';

      const getConversationByIdStub = Sinon.stub(channels, 'getConversationById').resolves(undefined);
      const result = await Data.getConversationById(expectedId);

      expect(getConversationByIdStub.calledOnce).to.be.true;
      expect(getConversationByIdStub.calledWith(expectedId)).to.be.true;
      expect(result).to.be.undefined;
    });
  });

  describe('removeConversation', () => {
    it('removes conversation when it exists', async () => {
      const expectedId = 'test_convo_123';
      const conversationData: ConversationAttributes = {
        id: expectedId,
        type: 'private',
        active_at: 1234567890,
      } as ConversationAttributes;

      const getConversationByIdStub = Sinon.stub(channels, 'getConversationById').resolves(conversationData);
      const removeConversationStub = Sinon.stub(channels, 'removeConversation');

      const result = await Data.removeConversation(expectedId);

      expect(getConversationByIdStub.calledOnce).to.be.true;
      expect(getConversationByIdStub.calledWith(expectedId)).to.be.true;
      expect(removeConversationStub.calledOnce).to.be.true;
      expect(removeConversationStub.calledWith(expectedId)).to.be.true;
      expect(result).to.be.undefined;
    });

    it('does nothing when conversation does not exist', async () => {
      const expectedId = 'non_existent_convo';

      const getConversationByIdStub = Sinon.stub(channels, 'getConversationById').resolves(undefined);
      const removeConversationStub = Sinon.stub(channels, 'removeConversation');

      const result = await Data.removeConversation(expectedId);

      expect(getConversationByIdStub.calledOnce).to.be.true;
      expect(getConversationByIdStub.calledWith(expectedId)).to.be.true;
      expect(removeConversationStub.called).to.be.false;
      expect(result).to.be.undefined;
    });
  });

  describe('getAllConversations', () => {
    it('returns array of conversation models', async () => {
      const conversationsData: Array<ConversationAttributes> = [
        {
          id: 'convo_1',
          type: 'private',
          active_at: 1234567890,
        } as ConversationAttributes,
        {
          id: 'convo_2',
          type: 'group',
          active_at: 1234567891,
        } as ConversationAttributes,
      ];

      const getAllConversationsStub = Sinon.stub(channels, 'getAllConversations').resolves(conversationsData);
      const result = await Data.getAllConversations();

      expect(getAllConversationsStub.calledOnce).to.be.true;
      expect(result).to.have.length(2);
      expect(result[0]).to.be.instanceOf(ConversationModel);
      expect(result[1]).to.be.instanceOf(ConversationModel);
      expect(result[0].get('id')).to.equal('convo_1');
      expect(result[1].get('id')).to.equal('convo_2');
    });
  });
});
