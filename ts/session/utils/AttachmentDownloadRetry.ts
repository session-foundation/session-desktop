import type { AttachmentDownloadMessageDetails } from '../../types/sqlSharedTypes';
import { was404Error } from '../apis/snode_api/onions';
import * as Constants from '../constants';

type AttachmentDownloadJobType = AttachmentDownloadMessageDetails['type'];

const RETRY_BACKOFF_BY_ATTEMPT = new Map<number, number>([
  [1, Constants.DURATION.SECONDS * 30],
  [2, Constants.DURATION.MINUTES * 30],
  [3, Constants.DURATION.HOURS * 6],
]);

const MAX_RETRY_BACKOFF = Constants.DURATION.HOURS * 6;
const MAX_RETRYABLE_ATTACHMENT_ATTEMPT = 10;
const MAX_RETRYABLE_PREVIEW_ATTEMPT = 2;

const TERMINAL_ERROR_MESSAGES = [
  'DownloadFromFileServer: fileId is empty or not a file server url',
  'Attachment is not raw but we do not have a key to decode it',
  'Attachment expected size is 0',
];

export function getAttachmentDownloadRetryBackoff(attempt: number): number {
  return RETRY_BACKOFF_BY_ATTEMPT.get(attempt) || MAX_RETRY_BACKOFF;
}

export function isAttachmentDownload404Error(error: unknown): boolean {
  if ((error as any)?.code === 404) {
    return true;
  }

  const message = (error as any)?.message;
  if (typeof message !== 'string') {
    return false;
  }

  return was404Error({ message } as Error);
}

export function isAttachmentDownloadTerminalError(error: unknown): boolean {
  if (isAttachmentDownload404Error(error)) {
    return true;
  }

  const message = (error as any)?.message;
  if (typeof message !== 'string') {
    return false;
  }

  return TERMINAL_ERROR_MESSAGES.some(terminalMessage => message.includes(terminalMessage));
}

export function hasAttachmentDownloadRetriesRemaining(
  attempt: number,
  type: AttachmentDownloadJobType = 'attachment'
): boolean {
  return (
    attempt <=
    (type === 'attachment' ? MAX_RETRYABLE_ATTACHMENT_ATTEMPT : MAX_RETRYABLE_PREVIEW_ATTEMPT)
  );
}

export function shouldShowAttachmentDownloadRetryFailed(attempt: number): boolean {
  return attempt >= 3;
}

export function getAttachmentDownloadRetryDecision({
  error,
  previousAttempts,
  type,
}: {
  error: unknown;
  previousAttempts: number;
  type: AttachmentDownloadJobType;
}) {
  const attempt = (previousAttempts || 0) + 1;
  const shouldRetry =
    !isAttachmentDownloadTerminalError(error) &&
    hasAttachmentDownloadRetriesRemaining(attempt, type);

  return {
    attempt,
    retryBackoff: getAttachmentDownloadRetryBackoff(attempt),
    shouldRetry,
    shouldMarkAttachmentFailed:
      shouldRetry && type === 'attachment' && shouldShowAttachmentDownloadRetryFailed(attempt),
  };
}

export function buildAttachmentDownloadRetryJob(
  job: any,
  attempt: number,
  retryBackoff: number,
  now = Date.now()
) {
  return {
    ...job,
    pending: 0,
    attempts: attempt,
    timestamp: now + retryBackoff,
  };
}

export function markAttachmentDownloadFailed(attachment: any) {
  return {
    ...attachment,
    error: true,
    pending: false,
    downloadJobId: undefined,
  };
}
