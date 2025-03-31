import { expect } from 'chai';
import { beforeEach } from 'mocha';

import { SignalService } from '../../../../protobuf';
import { Constants } from '../../../../session';
import { CommunityInvitationMessage } from '../../../../session/messages/outgoing/visibleMessage/CommunityInvitationMessage';
import { DisappearingMessageMode } from '../../../../session/disappearing_messages/types';

const sharedNoExpire = {
  expireTimer: 0,
  expirationType: DisappearingMessageMode[0],
};

describe('CommunityInvitationMessage', () => {
  let message: CommunityInvitationMessage;
  const createAtNetworkTimestamp = Date.now();
  const url = 'http://localhost';
  const name = 'test';

  beforeEach(() => {
    message = new CommunityInvitationMessage({
      createAtNetworkTimestamp,
      url,
      name,
      ...sharedNoExpire,
    });
  });

  it('dataMessage.groupInvitation has url, and serverName set', () => {
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);

    expect(decoded.dataMessage?.openGroupInvitation).to.have.property('url', url);
    expect(decoded.dataMessage?.openGroupInvitation).to.have.property('name', name);
  });

  it('correct ttl', () => {
    expect(message.ttl()).to.equal(Constants.TTL_DEFAULT.CONTENT_MESSAGE);
  });

  it('has an identifier', () => {
    expect(message.identifier).to.not.equal(null, 'identifier cannot be null');
    expect(message.identifier).to.not.equal(undefined, 'identifier cannot be undefined');
  });
});
