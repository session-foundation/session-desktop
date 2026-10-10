import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import Sinon from 'sinon';

import { TestUtils } from '../test-utils';
import { DecryptedAttachmentsManager } from '../../session/crypto/DecryptedAttachmentsManager';
import * as DataExtractionNotification from '../../session/messages/outgoing/controlMessage/DataExtractionNotificationMessage';
import * as Attachment from '../../types/Attachment';
import * as MessageAttachment from '../../types/MessageAttachment';
import { saveAttachmentToDisk } from '../../util/attachment/attachmentsUtil';

use(chaiAsPromised);

describe('saveAttachmentToDisk', () => {
  const relativePath = 'ab/cached-attachment';
  const absolutePath = '/attachments/ab/cached-attachment';
  const decryptedUrl = 'blob:decrypted-attachment';
  const remoteUrl = 'https://example.com/expired-attachment';
  const context = {
    conversationId: 'conversation-id',
    messageSender: 'sender-id',
    messageTimestamp: 1700000000000,
    index: 2,
  };
  let resolvePath: Sinon.SinonStub;
  let decrypt: Sinon.SinonStub;
  let save: Sinon.SinonStub;
  let notify: Sinon.SinonStub;

  const makeAttachment = (): Attachment.AttachmentType => ({
    url: remoteUrl,
    contentType: 'image/png',
    fileName: 'image.png',
    fileSize: '1 kB',
    screenshot: null,
    thumbnail: null,
  });

  beforeEach(() => {
    TestUtils.stubWindowLog();
    resolvePath = Sinon.stub(MessageAttachment, 'getAbsoluteAttachmentPath').returns(absolutePath);
    decrypt = Sinon.stub(DecryptedAttachmentsManager, 'getDecryptedMediaUrl').resolves(
      decryptedUrl
    );
    save = Sinon.stub(Attachment, 'save').resolves();
    notify = Sinon.stub(DataExtractionNotification, 'sendDataExtractionNotification').resolves();
  });

  afterEach(() => {
    Sinon.restore();
  });

  it('saves a cached gallery image using its local path instead of the remote URL', async () => {
    const attachment = { ...makeAttachment(), path: relativePath };

    await saveAttachmentToDisk({ ...context, attachment });

    expect(resolvePath.calledOnceWithExactly(relativePath)).to.equal(true);
    expect(decrypt.calledOnceWithExactly(absolutePath, 'image/png', false)).to.equal(true);
    expect(save.firstCall.args[0]).to.deep.equal({
      attachment: { ...attachment, url: decryptedUrl },
      getAbsolutePath: MessageAttachment.getAbsoluteAttachmentPath,
      timestamp: context.messageTimestamp,
      index: context.index,
    });
    expect(attachment.url).to.equal(remoteUrl);
    expect(
      notify.calledOnceWithExactly(
        context.conversationId,
        context.messageSender,
        context.messageTimestamp
      )
    ).to.equal(true);
    expect(notify.calledAfter(save)).to.equal(true);
  });

  it('preserves blob URLs when no local path is available', async () => {
    const attachment = { ...makeAttachment(), url: 'blob:existing-attachment' };

    await saveAttachmentToDisk({ ...context, attachment });

    expect(resolvePath.called).to.equal(false);
    expect(decrypt.calledOnceWithExactly(attachment.url, 'image/png', false)).to.equal(true);
    expect(save.firstCall.args[0].attachment.url).to.equal(decryptedUrl);
  });

  it('preserves an existing absolute URL when no relative path is available', async () => {
    const attachment = { ...makeAttachment(), url: absolutePath };

    await saveAttachmentToDisk({ ...context, attachment });

    expect(resolvePath.called).to.equal(false);
    expect(decrypt.calledOnceWithExactly(absolutePath, 'image/png', false)).to.equal(true);
  });

  it('also uses the local path for files from the Documents tab', async () => {
    const attachment = {
      ...makeAttachment(),
      path: relativePath,
      contentType: 'application/pdf',
      fileName: 'document.pdf',
    };

    await saveAttachmentToDisk({ ...context, attachment });

    expect(decrypt.calledOnceWithExactly(absolutePath, 'application/pdf', false)).to.equal(true);
    expect(save.firstCall.args[0].attachment).to.deep.equal({ ...attachment, url: decryptedUrl });
  });

  it('does not send a media-saved notification if saving fails', async () => {
    const error = new Error('Disk full');
    save.rejects(error);

    await expect(
      saveAttachmentToDisk({ ...context, attachment: makeAttachment() })
    ).to.be.rejectedWith(error);

    expect(notify.called).to.equal(false);
  });

  it('does not send a media-saved notification when the save picker is cancelled', async () => {
    const error = new Error('Save cancelled');
    error.name = 'AbortError';
    save.rejects(error);

    await expect(
      saveAttachmentToDisk({ ...context, attachment: makeAttachment() })
    ).to.be.rejectedWith(error);

    expect(notify.called).to.equal(false);
  });
});
