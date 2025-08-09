import { afterEach, beforeEach, describe } from 'mocha';
import Sinon from 'sinon';
import { expect } from 'chai';
import { PubkeyType } from 'libsession_util_nodejs';
import { Data } from '../../data/data';
import { channels } from '../../data/channels';
import * as dataInit from '../../data/dataInit';
import { GuardNode } from '../../data/types';
import { Storage } from '../../util/storage';
import * as cryptoUtils from '../../session/crypto';
import { DisappearingMessages } from '../../session/disappearing_messages';
import { ConversationAttributes } from '../../models/conversationAttributes';
import { ConversationModel } from '../../models/conversation';
import { MessageModel } from '../../models/message';
import { MessageAttributes, MessageAttributesOptionals } from '../../models/messageType';
import {
  MsgDuplicateSearchOpenGroup,
  SaveConversationReturn,
  SaveSeenMessageHash,
  UpdateLastHashType,
} from '../../types/sqlSharedTypes';
import { UserUtils } from '../../session/utils';

describe('data', () => {
  beforeEach(() => {
    mockChannels();

    const pubkey: PubkeyType = '05foo';
    Sinon.stub(UserUtils, 'getOurPubKeyStrFromCache').returns(pubkey);
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

      const fetchConvoMemoryDetailsStub = Sinon.stub(channels, 'fetchConvoMemoryDetails').resolves(
        expectedReturn
      );
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

      const getConversationByIdStub = Sinon.stub(channels, 'getConversationById').resolves(
        conversationData
      );
      const result = await Data.getConversationById(expectedId);

      expect(getConversationByIdStub.calledOnce).to.be.true;
      expect(getConversationByIdStub.calledWith(expectedId)).to.be.true;
      expect(result).to.be.instanceOf(ConversationModel);
      expect(result?.get('id')).to.equal(expectedId);
    });

    it('returns undefined when conversation does not exist', async () => {
      const expectedId = 'non_existent_convo';

      const getConversationByIdStub = Sinon.stub(channels, 'getConversationById').resolves(
        undefined
      );
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

      const getConversationByIdStub = Sinon.stub(channels, 'getConversationById').resolves(
        conversationData
      );
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

      const getConversationByIdStub = Sinon.stub(channels, 'getConversationById').resolves(
        undefined
      );
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

      const getAllConversationsStub = Sinon.stub(channels, 'getAllConversations').resolves(
        conversationsData
      );
      const result = await Data.getAllConversations();

      expect(getAllConversationsStub.calledOnce).to.be.true;
      expect(result).to.have.length(2);
      expect(result[0]).to.be.instanceOf(ConversationModel);
      expect(result[1]).to.be.instanceOf(ConversationModel);
      expect(result[0].get('id')).to.equal('convo_1');
      expect(result[1].get('id')).to.equal('convo_2');
    });
  });

  describe('getPubkeysInPublicConversation', () => {
    it('returns pubkeys for public conversation', async () => {
      const expectedId = 'public_convo_123';
      const expectedPubkeys = ['pubkey1', 'pubkey2', 'pubkey3'];

      const getPubkeysInPublicConversationStub = Sinon.stub(
        channels,
        'getPubkeysInPublicConversation'
      ).resolves(expectedPubkeys);
      const result = await Data.getPubkeysInPublicConversation(expectedId);

      expect(getPubkeysInPublicConversationStub.calledOnce).to.be.true;
      expect(getPubkeysInPublicConversationStub.calledWith(expectedId)).to.be.true;
      expect(result).to.deep.equal(expectedPubkeys);
    });
  });

  describe('searchConversations', () => {
    it('returns search results for conversations', async () => {
      const expectedQuery = 'test search';
      const expectedResults = [
        { id: 'convo_1', name: 'Test Conversation 1' },
        { id: 'convo_2', name: 'Test Search Result' },
      ];

      const searchConversationsStub = Sinon.stub(channels, 'searchConversations').resolves(
        expectedResults
      );
      const result = await Data.searchConversations(expectedQuery);

      expect(searchConversationsStub.calledOnce).to.be.true;
      expect(searchConversationsStub.calledWith(expectedQuery)).to.be.true;
      expect(result).to.deep.equal(expectedResults);
    });
  });

  describe('searchMessages', () => {
    it('returns unique search results for messages', async () => {
      const expectedQuery = 'test search';
      const expectedLimit = 10;
      const messagesWithDuplicates = [
        { id: 'msg_1', content: 'Test message 1' },
        { id: 'msg_2', content: 'Test search result' },
        { id: 'msg_1', content: 'Test message 1' }, // duplicate
        { id: 'msg_3', content: 'Another test message' },
      ];
      const expectedUniqueResults = [
        { id: 'msg_1', content: 'Test message 1' },
        { id: 'msg_2', content: 'Test search result' },
        { id: 'msg_3', content: 'Another test message' },
      ];

      const searchMessagesStub = Sinon.stub(channels, 'searchMessages').resolves(
        messagesWithDuplicates
      );
      const result = await Data.searchMessages(expectedQuery, expectedLimit);

      expect(searchMessagesStub.calledOnce).to.be.true;
      expect(searchMessagesStub.calledWith(expectedQuery, expectedLimit)).to.be.true;
      expect(result).to.deep.equal(expectedUniqueResults);
      expect(result).to.have.length(3); // Verify duplicates were removed
    });
  });

  describe('searchMessagesInConversation', () => {
    it('returns search results for messages in conversation', async () => {
      const expectedQuery = 'test search';
      const expectedConversationId = 'convo_123';
      const expectedLimit = 5;
      const expectedMessages = [
        { id: 'msg_1', content: 'Test message in conversation', conversationId: 'convo_123' },
        { id: 'msg_2', content: 'Another test search result', conversationId: 'convo_123' },
      ];

      const searchMessagesInConversationStub = Sinon.stub(
        channels,
        'searchMessagesInConversation'
      ).resolves(expectedMessages);
      const result = await Data.searchMessagesInConversation(
        expectedQuery,
        expectedConversationId,
        expectedLimit
      );

      expect(searchMessagesInConversationStub.calledOnce).to.be.true;
      expect(
        searchMessagesInConversationStub.calledWith(
          expectedQuery,
          expectedConversationId,
          expectedLimit
        )
      ).to.be.true;
      expect(result).to.deep.equal(expectedMessages);
    });
  });

  describe('cleanSeenMessages', () => {
    it('cleans seen messages', async () => {
      const cleanSeenMessagesStub = Sinon.stub(channels, 'cleanSeenMessages');

      const result = await Data.cleanSeenMessages();

      expect(cleanSeenMessagesStub.calledOnce).to.be.true;
      expect(result).to.be.undefined;
    });
  });

  describe('cleanLastHashes', () => {
    it('cleans last hashes', async () => {
      const cleanLastHashesStub = Sinon.stub(channels, 'cleanLastHashes');

      const result = await Data.cleanLastHashes();

      expect(cleanLastHashesStub.calledOnce).to.be.true;
      expect(result).to.be.undefined;
    });
  });

  describe('saveSeenMessageHashes', () => {
    it('saves seen message hashes', async () => {
      const expectedData: Array<SaveSeenMessageHash> = [
        { hash: 'hash1', conversationId: 'convo1', expiresAt: 123 },
        { hash: 'hash2', conversationId: 'convo2', expiresAt: 123 },
      ];

      const saveSeenMessageHashesStub = Sinon.stub(channels, 'saveSeenMessageHashes');
      const result = await Data.saveSeenMessageHashes(expectedData);

      expect(saveSeenMessageHashesStub.calledOnce).to.be.true;
      expect(saveSeenMessageHashesStub.calledWith(expectedData)).to.be.true;
      expect(result).to.be.undefined;
    });
  });

  describe('clearLastHashesForConvoId', () => {
    it('clears last hashes for conversation id', async () => {
      const expectedConversationId = 'test_convo_123';

      const clearLastHashesForConvoIdStub = Sinon.stub(channels, 'clearLastHashesForConvoId');
      const result = await Data.clearLastHashesForConvoId(expectedConversationId);

      expect(clearLastHashesForConvoIdStub.calledOnce).to.be.true;
      expect(clearLastHashesForConvoIdStub.calledWith(expectedConversationId)).to.be.true;
      expect(result).to.be.undefined;
    });
  });

  describe('emptySeenMessageHashesForConversation', () => {
    it('empties seen message hashes for conversation', async () => {
      const expectedConversationId = 'test_convo_123';

      const emptySeenMessageHashesForConversationStub = Sinon.stub(
        channels,
        'emptySeenMessageHashesForConversation'
      );
      const result = await Data.emptySeenMessageHashesForConversation(expectedConversationId);

      expect(emptySeenMessageHashesForConversationStub.calledOnce).to.be.true;
      expect(emptySeenMessageHashesForConversationStub.calledWith(expectedConversationId)).to.be
        .true;
      expect(result).to.be.undefined;
    });
  });

  describe('updateLastHash', () => {
    it('updates last hash', async () => {
      const expectedData: UpdateLastHashType = {
        convoId: 'test_convo_123',
        snode: 'test_snode_ed25519',
        hash: 'test_hash_value',
        expiresAt: 1234567890,
        namespace: 321,
      };

      const updateLastHashStub = Sinon.stub(channels, 'updateLastHash');
      const result = await Data.updateLastHash(expectedData);

      expect(updateLastHashStub.calledOnce).to.be.true;
      expect(updateLastHashStub.calledWith(expectedData)).to.be.true;
      expect(result).to.be.undefined;
    });
  });

  describe('saveMessage', () => {
    it('saves message and updates expiring messages check', async () => {
      const expectedMessageId = 'msg_123';
      const messageData: MessageAttributes = {
        id: expectedMessageId,
        body: 'Test message body',
        conversationId: 'convo_123',
        sent_at: 1234567890,
      } as MessageAttributes;

      const saveMessageStub = Sinon.stub(channels, 'saveMessage').resolves(expectedMessageId);
      const updateExpiringMessagesCheckStub = Sinon.stub(
        DisappearingMessages,
        'updateExpiringMessagesCheck'
      );

      const result = await Data.saveMessage(messageData);

      expect(saveMessageStub.calledOnce).to.be.true;
      expect(saveMessageStub.calledWith(messageData)).to.be.true;
      expect(updateExpiringMessagesCheckStub.calledOnce).to.be.true;
      expect(result).to.equal(expectedMessageId);
    });
  });

  describe('saveMessages', () => {
    it('saves array of messages', async () => {
      const messagesData: Array<MessageAttributes> = [
        {
          id: 'msg_1',
          body: 'First test message',
          conversationId: 'convo_123',
          sent_at: 1234567890,
        } as MessageAttributes,
        {
          id: 'msg_2',
          body: 'Second test message',
          conversationId: 'convo_456',
          sent_at: 1234567891,
        } as MessageAttributes,
      ];

      const saveMessagesStub = Sinon.stub(channels, 'saveMessages');
      const result = await Data.saveMessages(messagesData);

      expect(saveMessagesStub.calledOnce).to.be.true;
      expect(saveMessagesStub.calledWith(messagesData)).to.be.true;
      expect(result).to.be.undefined;
    });
  });

  describe('cleanUpExpirationTimerUpdateHistory', () => {
    it('cleans up expiration timer update history for private conversation', async () => {
      const expectedConversationId = 'private_convo_123';
      const expectedIsPrivate = true;
      const expectedRemovedIds = ['timer_msg_1', 'timer_msg_2'];

      const cleanUpExpirationTimerUpdateHistoryStub = Sinon.stub(
        channels,
        'cleanUpExpirationTimerUpdateHistory'
      ).resolves(expectedRemovedIds);

      const result = await Data.cleanUpExpirationTimerUpdateHistory(
        expectedConversationId,
        expectedIsPrivate
      );

      expect(cleanUpExpirationTimerUpdateHistoryStub.calledOnce).to.be.true;
      expect(
        cleanUpExpirationTimerUpdateHistoryStub.calledWith(
          expectedConversationId,
          expectedIsPrivate
        )
      ).to.be.true;
      expect(result).to.deep.equal(expectedRemovedIds);
    });

    it('cleans up expiration timer update history for group conversation', async () => {
      const expectedConversationId = 'group_convo_456';
      const expectedIsPrivate = false;
      const expectedRemovedIds = ['timer_msg_3'];

      const cleanUpExpirationTimerUpdateHistoryStub = Sinon.stub(
        channels,
        'cleanUpExpirationTimerUpdateHistory'
      ).resolves(expectedRemovedIds);

      const result = await Data.cleanUpExpirationTimerUpdateHistory(
        expectedConversationId,
        expectedIsPrivate
      );

      expect(cleanUpExpirationTimerUpdateHistoryStub.calledOnce).to.be.true;
      expect(
        cleanUpExpirationTimerUpdateHistoryStub.calledWith(
          expectedConversationId,
          expectedIsPrivate
        )
      ).to.be.true;
      expect(result).to.deep.equal(expectedRemovedIds);
    });
  });

  describe('removeMessage', () => {
    it('removes message when it exists', async () => {
      const expectedMessageId = 'msg_123';
      const message: MessageAttributesOptionals = {
        id: expectedMessageId,
        body: 'Test message',
        source: 'source',
        type: 'incoming',
        conversationId: '321',
      };

      const mockMessage = new MessageModel(message);
      mockMessage.cleanup = Sinon.stub();

      const getMessageByIdStub = Sinon.stub(channels, 'getMessageById').resolves(message);
      const removeMessageStub = Sinon.stub(channels, 'removeMessage');

      const result = await Data.removeMessage(expectedMessageId);

      expect(getMessageByIdStub.calledOnce).to.be.true;
      expect(getMessageByIdStub.calledWith(expectedMessageId)).to.be.true;
      expect(removeMessageStub.calledOnce).to.be.true;
      expect(removeMessageStub.calledWith(expectedMessageId)).to.be.true;
      expect(result).to.be.undefined;
    });

    it('does nothing when message does not exist', async () => {
      const expectedMessageId = 'non_existent_msg';

      const getMessageByIdStub = Sinon.stub(channels, 'getMessageById').resolves(null);
      const removeMessageStub = Sinon.stub(channels, 'removeMessage');

      const result = await Data.removeMessage(expectedMessageId);

      expect(getMessageByIdStub.calledOnce).to.be.true;
      expect(getMessageByIdStub.calledWith(expectedMessageId)).to.be.true;
      expect(removeMessageStub.called).to.be.false;
      expect(result).to.be.undefined;
    });
  });

  describe('removeMessagesByIds', () => {
    it('removes multiple messages by IDs without cleanup', async () => {
      const expectedMessageIds = ['msg_1', 'msg_2', 'msg_3'];

      const removeMessagesByIdsStub = Sinon.stub(channels, 'removeMessagesByIds');
      const result = await Data.removeMessagesByIds(expectedMessageIds);

      expect(removeMessagesByIdsStub.calledOnce).to.be.true;
      expect(removeMessagesByIdsStub.calledWith(expectedMessageIds)).to.be.true;
      expect(result).to.be.undefined;
    });
  });

  describe('removeAllMessagesInConversationSentBefore', () => {
    it('removes messages sent before specified timestamp', async () => {
      const expectedArgs = {
        deleteBeforeSeconds: 1640995200,
        conversationId: 'convo_123' as any,
      };
      const expectedRemovedIds = ['msg_1', 'msg_2', 'msg_3'];

      const removeAllMessagesInConversationSentBeforeStub = Sinon.stub(
        channels,
        'removeAllMessagesInConversationSentBefore'
      ).resolves(expectedRemovedIds);

      const result = await Data.removeAllMessagesInConversationSentBefore(expectedArgs);

      expect(removeAllMessagesInConversationSentBeforeStub.calledOnce).to.be.true;
      expect(removeAllMessagesInConversationSentBeforeStub.calledWith(expectedArgs)).to.be.true;
      expect(result).to.deep.equal(expectedRemovedIds);
    });
  });

  describe('getAllMessagesWithAttachmentsInConversationSentBefore', () => {
    it('returns message models with attachments sent before timestamp', async () => {
      const expectedArgs = {
        deleteAttachBeforeSeconds: 1640995200,
        conversationId: 'convo_456' as any,
      };
      const mockMessageAttrs: Array<MessageAttributesOptionals> = [
        {
          id: 'msg_with_attach_1',
          body: 'Message with attachment',
          conversationId: 'convo_456',
          attachments: [{ fileName: 'test.jpg' }],
          source: 'foo',
          type: 'incoming',
        },
        {
          id: 'msg_with_attach_2',
          body: 'Another message with attachment',
          conversationId: 'convo_456',
          attachments: [{ fileName: 'document.pdf' }],
          source: 'bar',
          type: 'outgoing',
        },
      ];

      const getAllMessagesWithAttachmentsInConversationSentBeforeStub = Sinon.stub(
        channels,
        'getAllMessagesWithAttachmentsInConversationSentBefore'
      ).resolves(mockMessageAttrs);

      const result = await Data.getAllMessagesWithAttachmentsInConversationSentBefore(expectedArgs);

      expect(getAllMessagesWithAttachmentsInConversationSentBeforeStub.calledOnce).to.be.true;
      expect(getAllMessagesWithAttachmentsInConversationSentBeforeStub.calledWith(expectedArgs)).to
        .be.true;
      expect(result).to.have.length(2);
      expect(result[0]).to.be.instanceOf(MessageModel);
      expect(result[1]).to.be.instanceOf(MessageModel);
      expect(result[0].get('id')).to.equal('msg_with_attach_1');
      expect(result[1].get('id')).to.equal('msg_with_attach_2');
    });

    it('returns empty array when no messages found', async () => {
      const expectedArgs = {
        deleteAttachBeforeSeconds: 1640995200,
        conversationId: 'empty_convo' as any,
      };

      const getAllMessagesWithAttachmentsInConversationSentBeforeStub = Sinon.stub(
        channels,
        'getAllMessagesWithAttachmentsInConversationSentBefore'
      ).resolves(null);

      const result = await Data.getAllMessagesWithAttachmentsInConversationSentBefore(expectedArgs);

      expect(getAllMessagesWithAttachmentsInConversationSentBeforeStub.calledOnce).to.be.true;
      expect(getAllMessagesWithAttachmentsInConversationSentBeforeStub.calledWith(expectedArgs)).to
        .be.true;
      expect(result).to.deep.equal([]);
    });

    it('returns empty array when empty array is returned', async () => {
      const expectedArgs = {
        deleteAttachBeforeSeconds: 1640995200,
        conversationId: 'empty_convo' as any,
      };

      const getAllMessagesWithAttachmentsInConversationSentBeforeStub = Sinon.stub(
        channels,
        'getAllMessagesWithAttachmentsInConversationSentBefore'
      ).resolves([]);

      const result = await Data.getAllMessagesWithAttachmentsInConversationSentBefore(expectedArgs);

      expect(getAllMessagesWithAttachmentsInConversationSentBeforeStub.calledOnce).to.be.true;
      expect(getAllMessagesWithAttachmentsInConversationSentBeforeStub.calledWith(expectedArgs)).to
        .be.true;
      expect(result).to.deep.equal([]);
    });
  });

  describe('getMessageIdsFromServerIds', () => {
    it('returns message IDs from server IDs', async () => {
      const expectedServerIds = ['server_1', 'server_2', 'server_3'];
      const expectedConversationId = 'convo_123';
      const expectedMessageIds = ['msg_1', 'msg_2', 'msg_3'];

      const getMessageIdsFromServerIdsStub = Sinon.stub(
        channels,
        'getMessageIdsFromServerIds'
      ).resolves(expectedMessageIds);
      const result = await Data.getMessageIdsFromServerIds(
        expectedServerIds,
        expectedConversationId
      );

      expect(getMessageIdsFromServerIdsStub.calledOnce).to.be.true;
      expect(getMessageIdsFromServerIdsStub.calledWith(expectedServerIds, expectedConversationId))
        .to.be.true;
      expect(result).to.deep.equal(expectedMessageIds);
    });

    it('returns undefined when no messages found', async () => {
      const expectedServerIds = [123, 456];
      const expectedConversationId = 'empty_convo';

      const getMessageIdsFromServerIdsStub = Sinon.stub(
        channels,
        'getMessageIdsFromServerIds'
      ).resolves(undefined);
      const result = await Data.getMessageIdsFromServerIds(
        expectedServerIds,
        expectedConversationId
      );

      expect(getMessageIdsFromServerIdsStub.calledOnce).to.be.true;
      expect(getMessageIdsFromServerIdsStub.calledWith(expectedServerIds, expectedConversationId))
        .to.be.true;
      expect(result).to.be.undefined;
    });
  });

  describe('getMessageById', () => {
    it('returns message model when message exists', async () => {
      const expectedMessageId = 'msg_123';
      const messageData: MessageAttributesOptionals = {
        id: expectedMessageId,
        body: 'Test message body',
        conversationId: 'convo_123',
        source: 'source_123',
        type: 'incoming',
      };

      const getMessageByIdStub = Sinon.stub(channels, 'getMessageById').resolves(messageData);
      const result = await Data.getMessageById(expectedMessageId);

      expect(getMessageByIdStub.calledOnce).to.be.true;
      expect(getMessageByIdStub.calledWith(expectedMessageId)).to.be.true;
      expect(result).to.be.instanceOf(MessageModel);
      expect(result?.get('id')).to.equal(expectedMessageId);
    });

    it('returns null when message does not exist', async () => {
      const expectedMessageId = 'non_existent_msg';

      const getMessageByIdStub = Sinon.stub(channels, 'getMessageById').resolves(null);
      const result = await Data.getMessageById(expectedMessageId);

      expect(getMessageByIdStub.calledOnce).to.be.true;
      expect(getMessageByIdStub.calledWith(expectedMessageId)).to.be.true;
      expect(result).to.be.null;
    });

    it('sets skipTimerInit when parameter is true', async () => {
      const expectedMessageId = 'msg_123';
      const messageData: MessageAttributesOptionals = {
        id: expectedMessageId,
        body: 'Test message body',
        conversationId: 'convo_123',
        source: 'source_123',
        type: 'incoming',
      };

      const getMessageByIdStub = Sinon.stub(channels, 'getMessageById').resolves(messageData);
      const result = await Data.getMessageById(expectedMessageId, true);

      expect(getMessageByIdStub.calledOnce).to.be.true;
      expect(getMessageByIdStub.calledWith(expectedMessageId)).to.be.true;
      expect(result).to.be.instanceOf(MessageModel);
      expect(result?.get('id')).to.equal(expectedMessageId);
    });
  });

  describe('getMessagesById', () => {
    it('returns array of message models', async () => {
      const expectedMessageIds = ['msg_1', 'msg_2', 'msg_3'];
      const messagesData: Array<MessageAttributesOptionals> = [
        {
          id: 'msg_1',
          body: 'First message',
          conversationId: 'convo_123',
          source: 'source_1',
          type: 'incoming',
        },
        {
          id: 'msg_2',
          body: 'Second message',
          conversationId: 'convo_123',
          source: 'source_2',
          type: 'outgoing',
        },
        {
          id: 'msg_3',
          body: 'Third message',
          conversationId: 'convo_456',
          source: 'source_3',
          type: 'incoming',
        },
      ];

      const getMessagesByIdStub = Sinon.stub(channels, 'getMessagesById').resolves(messagesData);
      const result = await Data.getMessagesById(expectedMessageIds);

      expect(getMessagesByIdStub.calledOnce).to.be.true;
      expect(getMessagesByIdStub.calledWith(expectedMessageIds)).to.be.true;
      expect(result).to.have.length(3);
      expect(result[0]).to.be.instanceOf(MessageModel);
      expect(result[1]).to.be.instanceOf(MessageModel);
      expect(result[2]).to.be.instanceOf(MessageModel);
      expect(result[0].get('id')).to.equal('msg_1');
      expect(result[1].get('id')).to.equal('msg_2');
      expect(result[2].get('id')).to.equal('msg_3');
    });

    it('returns empty array when no messages found', async () => {
      const expectedMessageIds = ['non_existent_1', 'non_existent_2'];

      const getMessagesByIdStub = Sinon.stub(channels, 'getMessagesById').resolves(null);
      const result = await Data.getMessagesById(expectedMessageIds);

      expect(getMessagesByIdStub.calledOnce).to.be.true;
      expect(getMessagesByIdStub.calledWith(expectedMessageIds)).to.be.true;
      expect(result).to.deep.equal([]);
    });

    it('returns empty array when empty array is returned', async () => {
      const expectedMessageIds = ['msg_1', 'msg_2'];

      const getMessagesByIdStub = Sinon.stub(channels, 'getMessagesById').resolves([]);
      const result = await Data.getMessagesById(expectedMessageIds);

      expect(getMessagesByIdStub.calledOnce).to.be.true;
      expect(getMessagesByIdStub.calledWith(expectedMessageIds)).to.be.true;
      expect(result).to.deep.equal([]);
    });
  });

  describe('getMessageByServerId', () => {
    it('returns message model when message exists', async () => {
      const expectedConversationId = 'convo_123';
      const expectedServerId = 456;
      const messageData: MessageAttributesOptionals = {
        id: 'msg_123',
        body: 'Message by server ID',
        conversationId: expectedConversationId,
        serverId: expectedServerId,
        source: 'source_123',
        type: 'incoming',
      };

      const getMessageByServerIdStub = Sinon.stub(channels, 'getMessageByServerId').resolves(
        messageData
      );
      const result = await Data.getMessageByServerId(expectedConversationId, expectedServerId);

      expect(getMessageByServerIdStub.calledOnce).to.be.true;
      expect(getMessageByServerIdStub.calledWith(expectedConversationId, expectedServerId)).to.be
        .true;
      expect(result).to.be.instanceOf(MessageModel);
      expect(result?.get('id')).to.equal('msg_123');
      expect(result?.get('serverId')).to.equal(expectedServerId);
    });

    it('returns null when message does not exist', async () => {
      const expectedConversationId = 'empty_convo';
      const expectedServerId = 999;

      const getMessageByServerIdStub = Sinon.stub(channels, 'getMessageByServerId').resolves(null);
      const result = await Data.getMessageByServerId(expectedConversationId, expectedServerId);

      expect(getMessageByServerIdStub.calledOnce).to.be.true;
      expect(getMessageByServerIdStub.calledWith(expectedConversationId, expectedServerId)).to.be
        .true;
      expect(result).to.be.null;
    });

    it('sets skipTimerInit when parameter is true', async () => {
      const expectedConversationId = 'convo_123';
      const expectedServerId = 789;
      const messageData: MessageAttributesOptionals = {
        id: 'msg_456',
        body: 'Message with skip timer',
        conversationId: expectedConversationId,
        serverId: expectedServerId,
        source: 'source_456',
        type: 'outgoing',
      };

      const getMessageByServerIdStub = Sinon.stub(channels, 'getMessageByServerId').resolves(
        messageData
      );
      const result = await Data.getMessageByServerId(
        expectedConversationId,
        expectedServerId,
        true
      );

      expect(getMessageByServerIdStub.calledOnce).to.be.true;
      expect(getMessageByServerIdStub.calledWith(expectedConversationId, expectedServerId)).to.be
        .true;
      expect(result).to.be.instanceOf(MessageModel);
      expect(result?.get('id')).to.equal('msg_456');
    });
  });

  describe('filterAlreadyFetchedOpengroupMessage', () => {
    it('filters already fetched opengroup messages', async () => {
      const inputMsgDetails: MsgDuplicateSearchOpenGroup = [
        {
          sender: 'sender_1',
          serverTimestamp: 1234567800,
        },
        {
          sender: 'sender_2',
          serverTimestamp: 1234567800,
        },
      ];

      const filteredMsgDetails: MsgDuplicateSearchOpenGroup = [
        {
          sender: 'sender_2',
          serverTimestamp: 1234567800,
        },
      ];

      const filterAlreadyFetchedOpengroupMessageStub = Sinon.stub(
        channels,
        'filterAlreadyFetchedOpengroupMessage'
      ).resolves(filteredMsgDetails);

      const result = await Data.filterAlreadyFetchedOpengroupMessage(inputMsgDetails);

      expect(filterAlreadyFetchedOpengroupMessageStub.calledOnce).to.be.true;
      expect(filterAlreadyFetchedOpengroupMessageStub.calledWith(inputMsgDetails)).to.be.true;
      expect(result).to.deep.equal(filteredMsgDetails);
      expect(result).to.have.length(1);
    });

    it('returns empty array when all messages are already fetched', async () => {
      const inputMsgDetails: MsgDuplicateSearchOpenGroup = [
        {
          sender: 'sender_old',
          serverTimestamp: 1234567800,
        },
      ];

      const filterAlreadyFetchedOpengroupMessageStub = Sinon.stub(
        channels,
        'filterAlreadyFetchedOpengroupMessage'
      ).resolves(null);

      const result = await Data.filterAlreadyFetchedOpengroupMessage(inputMsgDetails);

      expect(filterAlreadyFetchedOpengroupMessageStub.calledOnce).to.be.true;
      expect(filterAlreadyFetchedOpengroupMessageStub.calledWith(inputMsgDetails)).to.be.true;
      expect(result).to.deep.equal([]);
    });
  });

  describe('getMessagesBySenderAndSentAt', () => {
    it('returns message models for sender and timestamp matches', async () => {
      const propsList = [
        {
          source: 'sender_1',
          timestamp: 1234567890,
        },
        {
          source: 'sender_2',
          timestamp: 1234567891,
        },
      ];

      const messagesData: Array<MessageAttributesOptionals> = [
        {
          id: 'msg_1',
          body: 'Message from sender 1',
          conversationId: 'convo_123',
          source: 'sender_1',
          sent_at: 1234567890,
          type: 'incoming',
        },
        {
          id: 'msg_2',
          body: 'Message from sender 2',
          conversationId: 'convo_456',
          source: 'sender_2',
          sent_at: 1234567891,
          type: 'incoming',
        },
      ];

      const getMessagesBySenderAndSentAtStub = Sinon.stub(
        channels,
        'getMessagesBySenderAndSentAt'
      ).resolves(messagesData);

      const result = await Data.getMessagesBySenderAndSentAt(propsList);

      expect(getMessagesBySenderAndSentAtStub.calledOnce).to.be.true;
      expect(getMessagesBySenderAndSentAtStub.calledWith(propsList)).to.be.true;
      expect(result).to.have.length(2);
      expect(result?.[0]).to.be.instanceOf(MessageModel);
      expect(result?.[1]).to.be.instanceOf(MessageModel);
      expect(result?.[0].get('id')).to.equal('msg_1');
      expect(result?.[1].get('id')).to.equal('msg_2');
    });

    it('returns null when no messages match', async () => {
      const propsList = [
        {
          source: 'unknown_sender',
          timestamp: 9999999999,
        },
      ];

      const getMessagesBySenderAndSentAtStub = Sinon.stub(
        channels,
        'getMessagesBySenderAndSentAt'
      ).resolves([]);

      const result = await Data.getMessagesBySenderAndSentAt(propsList);

      expect(getMessagesBySenderAndSentAtStub.calledOnce).to.be.true;
      expect(getMessagesBySenderAndSentAtStub.calledWith(propsList)).to.be.true;
      expect(result).to.be.null;
    });

    it('returns null when result is not an array', async () => {
      const propsList = [
        {
          source: 'sender_test',
          timestamp: 1111111111,
        },
      ];

      const getMessagesBySenderAndSentAtStub = Sinon.stub(
        channels,
        'getMessagesBySenderAndSentAt'
      ).resolves(null);

      const result = await Data.getMessagesBySenderAndSentAt(propsList);

      expect(getMessagesBySenderAndSentAtStub.calledOnce).to.be.true;
      expect(getMessagesBySenderAndSentAtStub.calledWith(propsList)).to.be.true;
      expect(result).to.be.null;
    });
  });
});

function mockChannels(): void {
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
  channels.getPubkeysInPublicConversation = () => {};
  channels.searchConversations = () => {};
  channels.searchMessages = () => {};
  channels.searchMessagesInConversation = () => {};
  channels.cleanSeenMessages = () => {};
  channels.cleanLastHashes = () => {};
  channels.saveSeenMessageHashes = () => {};
  channels.clearLastHashesForConvoId = () => {};
  channels.emptySeenMessageHashesForConversation = () => {};
  channels.updateLastHash = () => {};
  channels.saveMessage = () => {};
  channels.saveMessages = () => {};
  channels.cleanUpExpirationTimerUpdateHistory = () => {};
  channels.removeMessage = () => {};
  channels.removeMessagesByIds = () => {};
  channels.removeAllMessagesInConversationSentBefore = () => {};
  channels.getAllMessagesWithAttachmentsInConversationSentBefore = () => {};
  channels.getMessageById = () => {};
  channels.getMessageIdsFromServerIds = () => {};
  channels.getMessagesById = () => {};
  channels.getMessageByServerId = () => {};
  channels.filterAlreadyFetchedOpengroupMessage = () => {};
  channels.getMessagesBySenderAndSentAt = () => {};
}
