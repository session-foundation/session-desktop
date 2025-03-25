/* eslint-disable no-unused-expressions */
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import Sinon from 'sinon';

import { PubKey } from '../../../../session/types';
import { MessageUtils } from '../../../../session/utils';
import { TestUtils } from '../../../test-utils';

import { SignalService } from '../../../../protobuf';
import { SnodeNamespaces } from '../../../../session/apis/snode_api/namespaces';

chai.use(chaiAsPromised as any);

const { expect } = chai;

describe('Message Utils', () => {
  afterEach(() => {
    Sinon.restore();
  });

  describe('toRawMessage', () => {
    it('can convert to raw message', async () => {
      const device = TestUtils.generateFakePubKey();
      const message = TestUtils.generateVisibleMessage();

      const rawMessage = await MessageUtils.toRawMessage(
        device,
        message,
        SnodeNamespaces.UserContacts
      );

      expect(Object.keys(rawMessage)).to.have.length(7);

      expect(rawMessage.identifier).to.exist;
      expect(rawMessage.namespace).to.exist;
      expect(rawMessage.device).to.exist;
      expect(rawMessage.encryption).to.exist;
      expect(rawMessage.plainTextBuffer).to.exist;
      expect(rawMessage.ttl).to.exist;
      expect(rawMessage.networkTimestampCreated).to.exist;

      expect(rawMessage.identifier).to.equal(message.identifier);
      expect(rawMessage.device).to.equal(device.key);
      expect(rawMessage.plainTextBuffer).to.deep.equal(message.plainTextBuffer());
      expect(rawMessage.ttl).to.equal(message.ttl());
      expect(rawMessage.namespace).to.equal(3);
      expect(rawMessage.networkTimestampCreated).to.eq(message.createAtNetworkTimestamp);
    });

    it('should generate valid plainTextBuffer', async () => {
      const device = TestUtils.generateFakePubKey();
      const message = TestUtils.generateVisibleMessage();

      const rawMessage = await MessageUtils.toRawMessage(device, message, SnodeNamespaces.Default);

      const rawBuffer = rawMessage.plainTextBuffer;
      const rawBufferJSON = JSON.stringify(rawBuffer);
      const messageBufferJSON = JSON.stringify(message.plainTextBuffer());

      expect(rawBuffer instanceof Uint8Array).to.equal(
        true,
        'raw message did not contain a plainTextBuffer'
      );
      expect(rawBufferJSON).to.equal(
        messageBufferJSON,
        'plainTextBuffer was not converted correctly'
      );
    });

    it('should maintain pubkey', async () => {
      const device = TestUtils.generateFakePubKey();
      const message = TestUtils.generateVisibleMessage();

      const rawMessage = await MessageUtils.toRawMessage(device, message, SnodeNamespaces.Default);
      const derivedPubKey = PubKey.from(rawMessage.device);

      expect(derivedPubKey).to.not.be.eq(undefined, 'should maintain pubkey');
      expect(derivedPubKey?.isEqual(device)).to.equal(
        true,
        'pubkey of message was not converted correctly'
      );
    });

    it('should set encryption to Fallback on other messages', async () => {
      const device = TestUtils.generateFakePubKey();
      const message = TestUtils.generateVisibleMessage();
      const rawMessage = await MessageUtils.toRawMessage(device, message, SnodeNamespaces.Default);

      expect(rawMessage.encryption).to.equal(SignalService.Envelope.Type.SESSION_MESSAGE);
    });
  });
});
