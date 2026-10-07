/**
 * Shared between the renderer and the node (sql) side, so this file must only hold types and constants.
 */

export const UNSUPPORTED_MESSAGE_TABLE = 'unsupported_message';

/**
 * Upper bound on the total size of retained `data` across all rows.
 */
export const UNSUPPORTED_MESSAGE_MAX_RETAINED_BYTES = 256 * 1024 * 1024;

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
   * Insert a record (ignored if its hash is already retained), then enforce the expiry and byte budget.
   * Returns true if the record was inserted.
   */
  insertUnsupportedMessage: (record: UnsupportedMessageInsert, nowMs: number) => boolean;
  setUnsupportedMessagePlaceholder: (hash: string, placeholderMessageId: string) => void;
  enforceUnsupportedMessageLimits: (nowMs: number) => void;
  getUnsupportedMessagesToReprocess: (currentVersion: string) => Array<UnsupportedMessageRow>;
  setUnsupportedMessageAttemptVersion: (id: number, version: string) => void;
  removeUnsupportedMessageById: (id: number) => void;
  removeUnsupportedMessagesByPlaceholderIds: (placeholderMessageIds: Array<string>) => void;
  removeUnsupportedMessagesBySenderAndSentTimestamp: (
    sender: string,
    sentTimestampMs: number
  ) => void;
  setUnsupportedMessageExpiry: (hash: string, expiresAtMs: number | null) => void;
};
