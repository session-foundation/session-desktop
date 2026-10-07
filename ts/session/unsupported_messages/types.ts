/**
 * Shared between the renderer and the node (sql) side, so this file must only hold types and constants.
 */

export const UNSUPPORTED_MESSAGE_TABLE = 'unsupported_message';

/**
 * Single-row running totals over `unsupported_message`, kept exact by triggers so enforcing the limits
 * after an insert never has to scan the table.
 */
export const UNSUPPORTED_MESSAGE_STATS_TABLE = 'unsupported_message_stats';

/**
 * What a row counts for against the byte budget on top of its `data`, so that many tiny rows (which
 * anyone can deposit as `newerFormat`) still use up the budget.
 */
export const UNSUPPORTED_MESSAGE_ROW_OVERHEAD_BYTES = 256;

/**
 * Upper bound on the total cost of all rows, each counting `length(data)` plus
 * `UNSUPPORTED_MESSAGE_ROW_OVERHEAD_BYTES`.
 */
export const UNSUPPORTED_MESSAGE_MAX_RETAINED_BYTES = 256 * 1024 * 1024;

/**
 * Upper bound on the number of `newerFormat` rows, which have no authenticated sender.
 */
export const UNSUPPORTED_MESSAGE_MAX_NEWER_FORMAT_ROWS = 10_000;

/**
 * Rows evicted per statement when over the byte budget. The total is only re-read between batches, so
 * eviction can stop up to a batch's worth of rows below the budget.
 */
export const UNSUPPORTED_MESSAGE_EVICTION_BATCH_SIZE = 100;

/**
 * `unknownType` rows fetched per IPC call when replaying.
 */
export const UNSUPPORTED_MESSAGE_REPLAY_PAGE_SIZE = 50;

// FIXME: move this to Crowdin once the design is settled
export const UNSUPPORTED_MESSAGE_PLACEHOLDER_TEXT =
  "This message can't be displayed. Update Session to view it.";

export type UnsupportedMessageKind = 'newerFormat' | 'unknownType';

/**
 * A row of the `unsupported_message` table.
 *
 * The column names are deliberately identical across the iOS, Android and Desktop clients so a future
 * import can read one shape from all of them, which is why they are snake_case.
 */
export type UnsupportedMessageRow = {
  id: number;
  kind: UnsupportedMessageKind;
  swarm_public_key: string;
  namespace: number;
  hash: string;
  /** the authenticated sender, `unknownType` only */
  sender: string | null;
  /** the sender's sent timestamp, `unknownType` only: with `sender`, what an unsend request matches */
  sent_timestamp_ms: number | null;
  server_timestamp_ms: number;
  server_expiry_ms: number | null;
  /** the raw swarm data, exactly as retrieved (base64-decoded) */
  data: Uint8Array;
  /**
   * The id of the placeholder row in the messages table. Desktop message ids are uuid strings, so this
   * holds TEXT even though the shared schema declares the column INTEGER: SQLite only coerces text that
   * looks like a number, and a uuid never does.
   */
  placeholder_message_id: string | null;
  expires_at_ms: number | null;
  received_at_ms: number;
  last_attempt_version: string;
};

export type UnsupportedMessageInsert = Omit<UnsupportedMessageRow, 'id'>;

export type UnsupportedMessageDataNode = {
  /**
   * Insert a record (ignored if its hash is already retained), then enforce the `newerFormat` row cap
   * and the byte budget. Expired rows are left to `enforceUnsupportedMessageLimits`.
   * Returns true if the record was inserted.
   */
  insertUnsupportedMessage: (record: UnsupportedMessageInsert) => boolean;
  setUnsupportedMessagePlaceholder: (hash: string, placeholderMessageId: string) => void;
  /**
   * Remove expired rows, then enforce the `newerFormat` row cap and the byte budget.
   */
  enforceUnsupportedMessageLimits: (nowMs: number) => void;
  /**
   * Stamp every `newerFormat` row not yet attempted by `currentVersion` as attempted, without loading
   * it: no legacy version can decrypt them. Returns the number of rows stamped.
   */
  markNewerFormatUnsupportedMessagesAttempted: (currentVersion: string) => number;
  /**
   * The next `limit` `unknownType` rows with an id above `afterId` not yet attempted by
   * `currentVersion`, in id order.
   */
  getUnknownTypeUnsupportedMessagesToReprocess: (
    currentVersion: string,
    afterId: number,
    limit: number
  ) => Array<UnsupportedMessageRow>;
  setUnsupportedMessageAttemptVersion: (id: number, version: string) => void;
  removeUnsupportedMessageById: (id: number) => void;
  removeUnsupportedMessagesByPlaceholderIds: (placeholderMessageIds: Array<string>) => void;
  removeUnsupportedMessagesBySenderAndSentTimestamp: (
    sender: string,
    sentTimestampMs: number
  ) => void;
  setUnsupportedMessageExpiry: (hash: string, expiresAtMs: number | null) => void;
};
