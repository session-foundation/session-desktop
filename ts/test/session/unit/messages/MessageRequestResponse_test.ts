import { expect } from 'chai';
import { from_hex } from 'libsodium-wrappers-sumo';
import { v4 } from 'uuid';
import Sinon from 'sinon';

import { SignalService } from '../../../../protobuf';
import { Constants } from '../../../../session';
import { MessageRequestResponse } from '../../../../session/messages/outgoing/controlMessage/MessageRequestResponse';
import { OutgoingUserProfile } from '../../../../types/message';
import { TestUtils } from '../../../test-utils';

describe('MessageRequestResponse', () => {
  let message: MessageRequestResponse | undefined;
  afterEach(() => {
    Sinon.restore();
  });
  it('correct ttl', () => {
    message = new MessageRequestResponse({
      createAtNetworkTimestamp: Date.now(),
      userProfile: null,
    });

    expect(message.ttl()).to.equal(Constants.TTL_DEFAULT.CONTENT_MESSAGE);
  });

  it('has an identifier', () => {
    message = new MessageRequestResponse({
      createAtNetworkTimestamp: Date.now(),
      userProfile: null,
    });

    expect(message.identifier).to.not.equal(null, 'identifier cannot be null');
    expect(message.identifier).to.not.equal(undefined, 'identifier cannot be undefined');
  });

  it('has an identifier matching if given', () => {
    const identifier = v4();
    message = new MessageRequestResponse({
      createAtNetworkTimestamp: Date.now(),
      identifier,
      userProfile: null,
    });

    expect(message.identifier).to.not.equal(identifier, 'identifier should match');
  });

  it('isApproved is always true', () => {
    message = new MessageRequestResponse({
      createAtNetworkTimestamp: Date.now(),
      userProfile: null,
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);
    expect(decoded.messageRequestResponse)
      .to.have.property('isApproved')
      .to.be.eq(true, 'isApproved is true');
  });

  it('can create response without lokiProfile', () => {
    message = new MessageRequestResponse({
      createAtNetworkTimestamp: Date.now(),
      userProfile: null,
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);
    expect(decoded.messageRequestResponse)
      .to.have.property('profile')
      .to.be.eq(null, 'no profile field if no profile given');
  });

  it('can create response with display name only', () => {
    message = new MessageRequestResponse({
      createAtNetworkTimestamp: Date.now(),
      userProfile: new OutgoingUserProfile({
        displayName: 'Jane',
        profilePic: { url: null, key: null },
        updatedAtSeconds: 1,
      }),
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);

    expect(decoded.messageRequestResponse?.profile?.displayName).to.be.deep.eq('Jane');
    expect(decoded.messageRequestResponse?.profile?.profilePicture).to.be.empty;
    expect(decoded.messageRequestResponse?.profileKey).to.be.empty;
  });

  it('empty profileKey does not get included', () => {
    message = new MessageRequestResponse({
      createAtNetworkTimestamp: Date.now(),
      userProfile: new OutgoingUserProfile({
        displayName: 'Jane',
        profilePic: null,
        updatedAtSeconds: 1,
      }),
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);

    expect(decoded.messageRequestResponse?.profile?.displayName).to.be.eq('Jane');

    expect(decoded.messageRequestResponse?.profile?.profilePicture).to.be.empty;
    expect(decoded.messageRequestResponse?.profileKey).to.be.empty;
  });

  it('can create response with display name and profileKey and profileImage', () => {
    TestUtils.stubURLCanParse();

    const userProfile = new OutgoingUserProfile({
      displayName: 'Jane',
      profilePic: {
        url: 'http://filev2.getsession.org/file/abcdefghijklmnop',
        key: from_hex('0102030405060102030405060102030401020304050601020304050601020304'),
      },
      updatedAtSeconds: 1,
    });
    message = new MessageRequestResponse({
      createAtNetworkTimestamp: Date.now(),
      userProfile,
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);

    expect(decoded.messageRequestResponse?.profile?.displayName).to.be.deep.eq('Jane');

    expect(decoded.messageRequestResponse?.profile?.profilePicture).to.be.eq(
      'http://filev2.getsession.org/file/abcdefghijklmnop'
    );
    // don't ask me why deep.eq ([1,2,3, ...]) gives nothing interesting but a 8192 buffer not matching
    expect(decoded.messageRequestResponse?.profileKey).to.be.deep.eq(
      from_hex('0102030405060102030405060102030401020304050601020304050601020304')
    );
  });

  it('profileKey not included if profileUrl not set', () => {
    message = new MessageRequestResponse({
      createAtNetworkTimestamp: Date.now(),
      userProfile: new OutgoingUserProfile({
        displayName: 'Jane',
        profilePic: { url: null, key: new Uint8Array([1, 2, 3, 4, 5, 6]) },
        updatedAtSeconds: 1,
      }),
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);

    expect(decoded.messageRequestResponse?.profile?.displayName).to.be.deep.eq('Jane');

    if (!decoded.messageRequestResponse?.profileKey?.buffer) {
      throw new Error('decoded.messageRequestResponse?.profileKey?.buffer should be set');
    }

    expect(decoded.messageRequestResponse?.profile?.profilePicture).to.be.empty;
    expect(decoded.messageRequestResponse?.profileKey).to.be.empty;
  });

  it('url not included if profileKey not set', () => {
    message = new MessageRequestResponse({
      createAtNetworkTimestamp: Date.now(),
      userProfile: new OutgoingUserProfile({
        displayName: 'Jane',
        profilePic: { url: 'https://somevalidurl.com', key: null },
        updatedAtSeconds: 1,
      }),
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);

    expect(decoded.messageRequestResponse?.profile?.displayName).to.be.deep.eq('Jane');

    if (!decoded.messageRequestResponse?.profileKey?.buffer) {
      throw new Error('decoded.messageRequestResponse?.profileKey?.buffer should be set');
    }

    expect(decoded.messageRequestResponse?.profile?.displayName).to.be.eq('Jane');
    expect(decoded.messageRequestResponse?.profile?.profilePicture).to.be.empty;
    expect(decoded.messageRequestResponse?.profileKey).to.be.empty;
  });
});
