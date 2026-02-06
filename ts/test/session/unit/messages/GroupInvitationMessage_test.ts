import { expect } from 'chai';
import { beforeEach } from 'mocha';

import { SignalService } from '../../../../protobuf';
import { Constants } from '../../../../session';
import { CommunityInvitationMessage } from '../../../../session/messages/outgoing/visibleMessage/CommunityInvitationMessage';
import { DisappearingMessageMode } from '../../../../session/disappearing_messages/types';
import { uuidV4 } from '../../../../util/uuid';

const sharedNoExpire = {
  expireTimer: 0,
  expirationType: DisappearingMessageMode[0],
  userProfile: null,
  outgoingProMessageDetails: null,
  dbMessageIdentifier: uuidV4(),
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

  it('has a dbMessageIdentifier', () => {
    expect(message.dbMessageIdentifier).to.not.equal(null, 'dbMessageIdentifier cannot be null');
    expect(message.dbMessageIdentifier).to.not.equal(
      undefined,
      'dbMessageIdentifier cannot be undefined'
    );
  });
});
