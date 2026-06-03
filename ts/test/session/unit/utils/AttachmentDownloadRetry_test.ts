import { expect } from 'chai';

import {
  buildAttachmentDownloadRetryJob,
  getAttachmentDownloadRetryBackoff,
  getAttachmentDownloadRetryDecision,
  hasAttachmentDownloadRetriesRemaining,
  isAttachmentDownloadTerminalError,
  isAttachmentDownload404Error,
  markAttachmentDownloadFailed,
  shouldShowAttachmentDownloadRetryFailed,
} from '../../../../session/utils/AttachmentDownloadRetry';
import * as Constants from '../../../../session/constants';

describe('AttachmentDownloadRetry', () => {
  describe('getAttachmentDownloadRetryBackoff', () => {
    it('uses the configured delayed retry schedule', () => {
      expect(getAttachmentDownloadRetryBackoff(1)).to.equal(Constants.DURATION.SECONDS * 30);
      expect(getAttachmentDownloadRetryBackoff(2)).to.equal(Constants.DURATION.MINUTES * 30);
      expect(getAttachmentDownloadRetryBackoff(3)).to.equal(Constants.DURATION.HOURS * 6);
    });

    it('clamps later retries to the maximum backoff', () => {
      expect(getAttachmentDownloadRetryBackoff(4)).to.equal(Constants.DURATION.HOURS * 6);
      expect(getAttachmentDownloadRetryBackoff(20)).to.equal(Constants.DURATION.HOURS * 6);
    });
  });

  describe('isAttachmentDownload404Error', () => {
    it('detects 404 errors by code', () => {
      expect(isAttachmentDownload404Error({ code: 404 })).to.equal(true);
    });

    it('detects 404 errors by onion error message', () => {
      expect(isAttachmentDownload404Error(new Error('download failed: 404 missing'))).to.equal(
        true
      );
    });

    it('does not classify transient errors as 404 errors', () => {
      expect(isAttachmentDownload404Error(new Error('network timeout'))).to.equal(false);
    });
  });

  describe('isAttachmentDownloadTerminalError', () => {
    it('keeps transient failures retryable', () => {
      expect(isAttachmentDownloadTerminalError(new Error('network timeout'))).to.equal(false);
    });

    it('stops retrying 404 failures immediately', () => {
      expect(isAttachmentDownloadTerminalError(new Error('download failed: 404 missing'))).to.equal(
        true
      );
    });

    it('stops retrying malformed attachment pointers', () => {
      expect(
        isAttachmentDownloadTerminalError(
          new Error('DownloadFromFileServer: fileId is empty or not a file server url')
        )
      ).to.equal(true);
    });
  });

  describe('shouldShowAttachmentDownloadRetryFailed', () => {
    it('keeps the existing pending state for early transient failures', () => {
      expect(shouldShowAttachmentDownloadRetryFailed(1)).to.equal(false);
      expect(shouldShowAttachmentDownloadRetryFailed(2)).to.equal(false);
    });

    it('allows later transient failures to show as failed while the job keeps retrying', () => {
      expect(shouldShowAttachmentDownloadRetryFailed(3)).to.equal(true);
      expect(shouldShowAttachmentDownloadRetryFailed(4)).to.equal(true);
    });
  });

  describe('getAttachmentDownloadRetryDecision', () => {
    it('keeps transient attachment failures retryable and visible after the display threshold', () => {
      expect(
        getAttachmentDownloadRetryDecision({
          error: new Error('network timeout'),
          previousAttempts: 2,
          type: 'attachment',
        })
      ).to.deep.equal({
        attempt: 3,
        retryBackoff: Constants.DURATION.HOURS * 6,
        shouldRetry: true,
        shouldMarkAttachmentFailed: true,
      });
    });

    it('keeps early transient preview failures retryable without marking the message attachment failed', () => {
      expect(
        getAttachmentDownloadRetryDecision({
          error: new Error('network timeout'),
          previousAttempts: 1,
          type: 'preview',
        })
      ).to.deep.equal({
        attempt: 2,
        retryBackoff: Constants.DURATION.MINUTES * 30,
        shouldRetry: true,
        shouldMarkAttachmentFailed: false,
      });
    });

    it('keeps transient preview failures terminal at the old retry boundary', () => {
      expect(
        getAttachmentDownloadRetryDecision({
          error: new Error('network timeout'),
          previousAttempts: 2,
          type: 'preview',
        })
      ).to.deep.equal({
        attempt: 3,
        retryBackoff: Constants.DURATION.HOURS * 6,
        shouldRetry: false,
        shouldMarkAttachmentFailed: false,
      });
    });

    it('does not retry terminal server failures', () => {
      expect(
        getAttachmentDownloadRetryDecision({
          error: { code: 404 },
          previousAttempts: 0,
          type: 'attachment',
        })
      ).to.deep.equal({
        attempt: 1,
        retryBackoff: Constants.DURATION.SECONDS * 30,
        shouldRetry: false,
        shouldMarkAttachmentFailed: false,
      });
    });

    it('stops retrying transient failures after the capped retry window', () => {
      expect(
        getAttachmentDownloadRetryDecision({
          error: new Error('network timeout'),
          previousAttempts: 10,
          type: 'attachment',
        })
      ).to.deep.equal({
        attempt: 11,
        retryBackoff: Constants.DURATION.HOURS * 6,
        shouldRetry: false,
        shouldMarkAttachmentFailed: false,
      });
    });
  });

  describe('hasAttachmentDownloadRetriesRemaining', () => {
    it('keeps transient failures retryable through the capped retry window', () => {
      expect(hasAttachmentDownloadRetriesRemaining(1)).to.equal(true);
      expect(hasAttachmentDownloadRetriesRemaining(10)).to.equal(true);
    });

    it('stops retrying after the capped retry window', () => {
      expect(hasAttachmentDownloadRetriesRemaining(11)).to.equal(false);
    });

    it('keeps preview retries at the original shorter retry window', () => {
      expect(hasAttachmentDownloadRetriesRemaining(2, 'preview')).to.equal(true);
      expect(hasAttachmentDownloadRetriesRemaining(3, 'preview')).to.equal(false);
    });
  });

  describe('buildAttachmentDownloadRetryJob', () => {
    it('clears pending state and schedules the next retry without dropping attachment metadata', () => {
      expect(
        buildAttachmentDownloadRetryJob(
          {
            id: 'job-id',
            messageId: 'message-id',
            type: 'attachment',
            index: 0,
            pending: 1,
            attempts: 2,
            timestamp: 100,
            attachment: {
              url: 'https://file.getsession.org/file/123',
              key: 'key',
              digest: 'digest',
            },
          },
          3,
          Constants.DURATION.HOURS * 6,
          1000
        )
      ).to.deep.equal({
        id: 'job-id',
        messageId: 'message-id',
        type: 'attachment',
        index: 0,
        pending: 0,
        attempts: 3,
        timestamp: 1000 + Constants.DURATION.HOURS * 6,
        attachment: {
          url: 'https://file.getsession.org/file/123',
          key: 'key',
          digest: 'digest',
        },
      });
    });
  });

  describe('markAttachmentDownloadFailed', () => {
    it('preserves retry metadata while clearing pending runtime state', () => {
      const failed = markAttachmentDownloadFailed({
        url: 'https://file.getsession.org/file/123',
        key: 'key',
        digest: 'digest',
        id: 'attachment-id',
        size: 123,
        contentType: 'image/png',
        pending: true,
        downloadJobId: 'job-id',
      });

      expect(failed).to.deep.equal({
        url: 'https://file.getsession.org/file/123',
        key: 'key',
        digest: 'digest',
        id: 'attachment-id',
        size: 123,
        contentType: 'image/png',
        pending: false,
        downloadJobId: undefined,
        error: true,
      });
    });
  });
});
