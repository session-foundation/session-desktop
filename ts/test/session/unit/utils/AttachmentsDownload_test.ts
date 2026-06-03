import { expect } from 'chai';
import Sinon from 'sinon';

import { Data } from '../../../../data/data';
import { MessageModel } from '../../../../models/message';
import * as ReceiverAttachments from '../../../../receiver/attachments';
import * as Constants from '../../../../session/constants';
import * as AttachmentsDownload from '../../../../session/utils/AttachmentsDownload';
import { waitUntil } from '../../../../session/utils/Promise';
import { TestUtils } from '../../../test-utils';

describe('AttachmentsDownload', () => {
  afterEach(() => {
    AttachmentsDownload.stop();
    Sinon.restore();
  });

  describe('start', () => {
    it('marks later transient attachment failures as visible failed while keeping the job queued', async () => {
      TestUtils.stubWindowLog();

      const now = 1000;
      const attachment = {
        url: 'https://file.getsession.org/file/123',
        key: 'key',
        digest: 'digest',
        id: 'attachment-id',
        size: 123,
        contentType: 'image/png',
        pending: true,
        downloadJobId: 'job-id',
      };
      const job = {
        id: 'job-id',
        messageId: 'message-id',
        type: 'attachment',
        index: 0,
        isOpenGroupV2: false,
        openGroupV2Details: undefined,
        pending: 0,
        attempts: 2,
        timestamp: 0,
        attachment,
      };
      const message = new MessageModel({
        id: 'message-id',
        conversationId: 'conversation-id',
        source: 'source-id',
        type: 'incoming',
        attachments: [attachment],
      });
      const logger = {
        debug: Sinon.stub(),
        error: Sinon.stub(),
        info: Sinon.stub(),
        warn: Sinon.stub(),
      };

      Sinon.stub(Date, 'now').returns(now);
      Sinon.stub(message, 'isTrustedForAttachmentDownload').returns(true);
      Sinon.stub(message, 'getConversation').returns({
        idForLogging: () => 'conversation-id',
      } as any);
      const commitStub = Sinon.stub(message, 'commit').resolves('message-id');
      Sinon.stub(ReceiverAttachments, 'downloadAttachmentFs').rejects(new Error('network timeout'));
      Sinon.stub(Data, 'resetAttachmentDownloadPending').resolves();
      Sinon.stub(Data, 'getMessageById').resolves(message);
      const setPendingStub = Sinon.stub(Data, 'setAttachmentDownloadJobPending').resolves();
      const saveJobStub = Sinon.stub(Data, 'saveAttachmentDownloadJob').resolves();
      const removeJobStub = Sinon.stub(Data, 'removeAttachmentDownloadJob').resolves();
      const getNextJobsStub = Sinon.stub(Data, 'getNextAttachmentDownloadJobs');
      getNextJobsStub.onFirstCall().resolves([job]);
      getNextJobsStub.resolves([]);

      await AttachmentsDownload.start({ logger });
      await waitUntil(() => saveJobStub.calledOnce, 1000);

      expect(setPendingStub.calledOnceWithExactly('job-id', true)).to.equal(true);
      expect(removeJobStub.called).to.equal(false);
      expect(commitStub.calledOnce).to.equal(true);
      expect(saveJobStub.firstCall.args[0]).to.deep.equal({
        ...job,
        pending: 0,
        attempts: 3,
        timestamp: now + Constants.DURATION.HOURS * 6,
      });
      expect(message.get('attachments')).to.deep.equal([
        {
          ...attachment,
          error: true,
          pending: false,
          downloadJobId: undefined,
        },
      ]);
    });
  });
});
