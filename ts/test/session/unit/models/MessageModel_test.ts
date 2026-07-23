import { expect } from 'chai';
import Sinon from 'sinon';

import { MessageModel } from '../../../../models/message';
import * as MessageAttachment from '../../../../types/MessageAttachment';

describe('MessageModel', () => {
  afterEach(() => {
    Sinon.restore();
  });

  describe('getPropsForAttachment', () => {
    it('propagates failed attachment state without exposing retry metadata', () => {
      Sinon.stub(MessageAttachment, 'getAbsoluteAttachmentPath').returns('/attachment/path');

      const message = new MessageModel({
        conversationId: 'conversation-id',
        source: 'source-id',
        type: 'incoming',
      });
      const props = message.getPropsForAttachment({
        contentType: 'image/png',
        digest: 'digest',
        error: true,
        fileName: 'image.png',
        key: 'key',
        path: '',
        pending: false,
        screenshot: null,
        thumbnail: null,
        url: 'https://file.getsession.org/file/123',
      } as any);

      expect(props).to.deep.equal({
        contentType: 'image/png',
        caption: undefined,
        size: 0,
        width: 0,
        height: 0,
        path: '',
        fileName: 'image.png',
        fileSize: null,
        isVoiceMessage: false,
        pending: false,
        error: true,
        url: '',
        screenshot: null,
        thumbnail: null,
      });
      expect(props).to.not.have.property('key');
      expect(props).to.not.have.property('digest');
    });
  });
});
