import { expect } from 'chai';
// eslint-disable-next-line import/order
import { TextEncoder } from 'util';

import { toNumber } from 'lodash';
import { SignalService } from '../../../../protobuf';
import { Constants } from '../../../../session';
import {
  AttachmentPointerWithUrl,
  PreviewWithAttachmentUrl,
  Quote,
  VisibleMessage,
} from '../../../../session/messages/outgoing/visibleMessage/VisibleMessage';
import { DisappearingMessageMode } from '../../../../session/disappearing_messages/types';
import { OutgoingUserProfile } from '../../../../types/message';
import { TestUtils } from '../../../test-utils';

const sharedNoExpire = {
  expirationType: DisappearingMessageMode[0],
  expireTimer: 0,
};

describe('VisibleMessage', () => {
  it('can create empty message with just a timestamp', () => {
    const message = new VisibleMessage({
      createAtNetworkTimestamp: Date.now(),
      ...sharedNoExpire,
      userProfile: null,
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);
    expect(decoded).to.have.not.property('dataMessage', null);
    expect(decoded).to.have.not.property('dataMessage', undefined);
  });

  it('can create message with a body', () => {
    const message = new VisibleMessage({
      createAtNetworkTimestamp: Date.now(),
      body: 'body',
      ...sharedNoExpire,
      userProfile: null,
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);
    expect(decoded.dataMessage).to.have.deep.property('body', 'body');
  });

  it('can create a disappear after read message', () => {
    const message = new VisibleMessage({
      createAtNetworkTimestamp: Date.now(),
      ...sharedNoExpire,
      expirationType: 'deleteAfterRead',
      expireTimer: 300,
      userProfile: null,
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);
    expect(decoded, 'should have an expirationType of deleteAfterRead').to.have.deep.property(
      'expirationType',
      SignalService.Content.ExpirationType.DELETE_AFTER_READ
    );
    expect(decoded, 'should have an expirationTimer of 5 minutes').to.have.deep.property(
      'expirationTimer',
      300
    );
  });

  it('can create a disappear after send message', () => {
    const message = new VisibleMessage({
      createAtNetworkTimestamp: Date.now(),
      ...sharedNoExpire,
      expirationType: 'deleteAfterSend',
      expireTimer: 60,
      userProfile: null,
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);
    expect(decoded, 'should have an expirationType of deleteAfterSend').to.have.deep.property(
      'expirationType',
      SignalService.Content.ExpirationType.DELETE_AFTER_SEND
    );
    expect(decoded, 'should have an expirationTimer of 1 minute').to.have.deep.property(
      'expirationTimer',
      60
    );
  });

  it('can create message with a full loki profile', () => {
    const profileKey = new TextEncoder().encode('profileKey');

    const lokiProfile = {
      displayName: 'displayName',
      avatarPointer: 'avatarPointer',
      profileKey,
      updatedAtSeconds: 1,
    };
    const message = new VisibleMessage({
      createAtNetworkTimestamp: Date.now(),
      userProfile: new OutgoingUserProfile(lokiProfile),
      ...sharedNoExpire,
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);
    expect(decoded.dataMessage).to.have.deep.property('profile');

    expect(decoded.dataMessage)
      .to.have.property('profile')
      .to.have.deep.property('displayName', 'displayName');
    expect(decoded.dataMessage)
      .to.have.property('profile')
      .to.have.deep.property('profilePicture', 'avatarPointer');
    expect(decoded.dataMessage).to.have.deep.property('profileKey', profileKey);
  });

  it('can create message with a quote without attachments', () => {
    const quote: Quote = { id: 1234, author: 'author', text: 'text' };
    const message = new VisibleMessage({
      createAtNetworkTimestamp: Date.now(),
      quote,
      ...sharedNoExpire,
      userProfile: null,
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);
    const decodedID = toNumber(decoded.dataMessage?.quote?.id);
    expect(decodedID).to.be.equal(1234);
    expect(decoded.dataMessage?.quote).to.have.deep.property('author', 'author');
    expect(decoded.dataMessage?.quote).to.have.deep.property('text', 'text');
  });

  it('can create message with a preview', () => {
    const preview: PreviewWithAttachmentUrl = { url: 'url', title: 'title' };
    const previews = new Array<PreviewWithAttachmentUrl>();
    previews.push(preview);

    const message = new VisibleMessage({
      createAtNetworkTimestamp: Date.now(),
      preview: previews,
      userProfile: null,
      ...sharedNoExpire,
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);
    expect(decoded.dataMessage?.preview).to.have.lengthOf(1);
    expect(decoded.dataMessage).to.have.nested.property('preview[0].url').to.be.deep.equal('url');
    expect(decoded.dataMessage)
      .to.have.nested.property('preview[0].title')
      .to.be.deep.equal('title');
  });

  it('can create message with an AttachmentPointer', () => {
    const attachment: AttachmentPointerWithUrl = {
      url: 'http://thisisaareal/url/1234',
      contentType: 'contentType',
    };
    const attachments = new Array<AttachmentPointerWithUrl>();
    attachments.push(attachment);

    TestUtils.stubURL({
      searchParams: { get: () => '' },
      origin: 'http://thisisaareal',
      pathname: '/url/1234',
    });

    const message = new VisibleMessage({
      createAtNetworkTimestamp: Date.now(),
      attachments,
      userProfile: null,
      ...sharedNoExpire,
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);
    expect(decoded.dataMessage?.attachments).to.have.lengthOf(1);
    const firstAttachment = decoded?.dataMessage?.attachments?.[0];
    const decodedID = toNumber(firstAttachment?.deprecatedId);
    expect(decodedID).to.be.equal(1234);
    expect(firstAttachment?.contentType).to.be.deep.equal('contentType');
    expect(firstAttachment?.url).to.be.deep.equal('http://thisisaareal/url/1234');
  });

  it('correct ttl', () => {
    const message = new VisibleMessage({
      createAtNetworkTimestamp: Date.now(),
      ...sharedNoExpire,
      userProfile: null,
    });
    expect(message.ttl()).to.equal(Constants.TTL_DEFAULT.CONTENT_MESSAGE);
  });

  it('has an identifier', () => {
    const message = new VisibleMessage({
      createAtNetworkTimestamp: Date.now(),
      ...sharedNoExpire,
      userProfile: null,
    });
    expect(message.identifier).to.not.equal(null, 'identifier cannot be null');
    expect(message.identifier).to.not.equal(undefined, 'identifier cannot be undefined');
  });
});
