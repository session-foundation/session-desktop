import { expect } from 'chai';
import Sinon from 'sinon';
// eslint-disable-next-line import/order

import { SignalService } from '../../../../protobuf';
import { Constants } from '../../../../session';
import {
  AttachmentPointerWithUrl,
  PreviewWithAttachmentUrl,
  Quote,
  VisibleMessage,
} from '../../../../session/messages/outgoing/visibleMessage/VisibleMessage';
import { DisappearingMessageMode } from '../../../../session/disappearing_messages/types';
import { TestUtils } from '../../../test-utils';
import { longOrNumberToNumber } from '../../../../types/long/longOrNumberToNumber';
import { uuidV4 } from '../../../../util/uuid';

const sharedNoExpire = {
  expirationType: DisappearingMessageMode[0],
  expireTimer: 0,
  outgoingProMessageDetails: null,
  dbMessageIdentifier: uuidV4(),
};

describe('VisibleMessage', () => {
  afterEach(() => {
    Sinon.restore();
  });
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

  it('can create message with a quote without attachments', () => {
    const quote: Quote = { timestamp: 1234, author: 'author' };
    const message = new VisibleMessage({
      createAtNetworkTimestamp: Date.now(),
      quote,
      ...sharedNoExpire,
      userProfile: null,
    });
    const plainText = message.plainTextBuffer();
    const decoded = SignalService.Content.decode(plainText);
    const decodedID = longOrNumberToNumber(decoded.dataMessage?.quote?.id ?? 0);
    expect(decodedID).to.be.equal(1234);
    expect(decoded.dataMessage?.quote).to.have.deep.property('author', 'author');
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
    TestUtils.stubWindowFeatureFlags();
    TestUtils.stubURLCanParse();

    const attachment: AttachmentPointerWithUrl = {
      url: 'http://thisisaareal/url/1234',
      contentType: 'contentType',
    };
    const attachments = new Array<AttachmentPointerWithUrl>();
    attachments.push(attachment);

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
    const decodedID = longOrNumberToNumber(firstAttachment?.deprecatedId ?? 0);
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

  it('has a dbMessageIdentifier', () => {
    const message = new VisibleMessage({
      createAtNetworkTimestamp: Date.now(),
      ...sharedNoExpire,
      userProfile: null,
    });
    expect(message.dbMessageIdentifier).to.not.equal(null, 'dbMessageIdentifier cannot be null');
    expect(message.dbMessageIdentifier).to.not.equal(
      undefined,
      'dbMessageIdentifier cannot be undefined'
    );
  });
});
