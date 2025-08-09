import { afterEach, beforeEach, describe } from 'mocha';
import Sinon from 'sinon';
import { expect } from 'chai';
import { Data } from '../../data/data';
import { channels } from '../../data/channels';
import * as dataInit from '../../data/dataInit';
import { GuardNode } from '../../data/types';
import { Storage } from '../../util/storage';
import * as cryptoUtils from '../../session/crypto';

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
});
