import type { AsyncObjectWrapper } from '../../types/sqlSharedTypes';
import type {
  UnsupportedMessageDataNode,
  UnsupportedMessageInsert,
} from '../../session/unsupported_messages/types';
import { channels } from '../channels';

// Not passed through cleanData: it would turn the raw `data` bytes into a plain object.
export const UnsupportedMessageData: AsyncObjectWrapper<UnsupportedMessageDataNode> = {
  insertUnsupportedMessage: (record: UnsupportedMessageInsert) => {
    return channels.insertUnsupportedMessage(record);
  },
  setUnsupportedMessagePlaceholder: (hash: string, placeholderMessageId: string) => {
    return channels.setUnsupportedMessagePlaceholder(hash, placeholderMessageId);
  },
  enforceUnsupportedMessageLimits: (nowMs: number) => {
    return channels.enforceUnsupportedMessageLimits(nowMs);
  },
  markNewerFormatUnsupportedMessagesAttempted: (currentVersion: string) => {
    return channels.markNewerFormatUnsupportedMessagesAttempted(currentVersion);
  },
  getUnknownTypeUnsupportedMessagesToReprocess: (
    currentVersion: string,
    afterId: number,
    limit: number
  ) => {
    return channels.getUnknownTypeUnsupportedMessagesToReprocess(currentVersion, afterId, limit);
  },
  setUnsupportedMessageAttemptVersion: (id: number, version: string) => {
    return channels.setUnsupportedMessageAttemptVersion(id, version);
  },
  removeUnsupportedMessageById: (id: number) => {
    return channels.removeUnsupportedMessageById(id);
  },
  removeUnsupportedMessagesByPlaceholderIds: (placeholderMessageIds: Array<string>) => {
    return channels.removeUnsupportedMessagesByPlaceholderIds(placeholderMessageIds);
  },
  removeUnsupportedMessagesBySenderAndSentTimestamp: (sender: string, sentTimestampMs: number) => {
    return channels.removeUnsupportedMessagesBySenderAndSentTimestamp(sender, sentTimestampMs);
  },
  setUnsupportedMessageExpiry: (hash: string, expiresAtMs: number | null) => {
    return channels.setUnsupportedMessageExpiry(hash, expiresAtMs);
  },
};
