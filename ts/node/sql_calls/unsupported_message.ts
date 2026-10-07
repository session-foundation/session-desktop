import { type Database, type StatementParameters } from '@signalapp/sqlcipher';
import { MESSAGES_TABLE } from '../database_utility';
import { assertGlobalInstanceOrInstance } from '../sqlInstance';
import {
  UNSUPPORTED_MESSAGE_EVICTION_BATCH_SIZE,
  UNSUPPORTED_MESSAGE_MAX_NEWER_FORMAT_ROWS,
  UNSUPPORTED_MESSAGE_MAX_RETAINED_BYTES,
  UNSUPPORTED_MESSAGE_STATS_TABLE,
  UNSUPPORTED_MESSAGE_TABLE,
  type UnsupportedMessageDataNode,
  type UnsupportedMessageInsert,
  type UnsupportedMessageKind,
  type UnsupportedMessageRow,
} from '../../session/unsupported_messages/types';

export type UnsupportedMessageLimits = {
  maxBytes: number;
  maxNewerFormatRows: number;
  evictionBatchSize: number;
};

const DEFAULT_LIMITS: UnsupportedMessageLimits = {
  maxBytes: UNSUPPORTED_MESSAGE_MAX_RETAINED_BYTES,
  maxNewerFormatRows: UNSUPPORTED_MESSAGE_MAX_NEWER_FORMAT_ROWS,
  evictionBatchSize: UNSUPPORTED_MESSAGE_EVICTION_BATCH_SIZE,
};

// `newerFormat` rows go first: anyone can deposit data with the newer-format prefix into a 1o1
// namespace, whereas an `unknownType` message came from an authenticated sender.
const EVICTION_ORDER: Array<UnsupportedMessageKind> = ['newerFormat', 'unknownType'];

function readStats(db: Database) {
  const stats = db
    .prepare(
      `SELECT total_bytes, newer_format_count FROM ${UNSUPPORTED_MESSAGE_STATS_TABLE} WHERE id = 1;`
    )
    .get<{ total_bytes: number; newer_format_count: number }>();
  if (!stats) {
    throw new Error(`${UNSUPPORTED_MESSAGE_STATS_TABLE} has no row`);
  }
  return stats;
}

function evictOldestOfKind(db: Database, kind: UnsupportedMessageKind, count: number) {
  return db
    .prepare(
      `DELETE FROM ${UNSUPPORTED_MESSAGE_TABLE} WHERE id IN (
        SELECT id FROM ${UNSUPPORTED_MESSAGE_TABLE} WHERE kind = $kind ORDER BY id ASC LIMIT $count
      );`
    )
    .run({ kind, count }).changes;
}

/**
 * Cap the `newerFormat` rows, then evict the oldest rows (lowest id, so insertion order), `newerFormat`
 * first, until the total cost fits the byte budget.
 *
 * Runs after every insert, so it must stay O(1) when under the limits: it only reads the running
 * totals, and every eviction query is served by the `(kind, id)` index.
 */
export function enforceUnsupportedMessageBudgetWith(
  db: Database,
  limits: Partial<UnsupportedMessageLimits> = {}
) {
  const { maxBytes, maxNewerFormatRows, evictionBatchSize } = { ...DEFAULT_LIMITS, ...limits };
  let evicted = 0;

  const { newer_format_count: newerFormatCount } = readStats(db);
  if (newerFormatCount > maxNewerFormatRows) {
    evicted += evictOldestOfKind(db, 'newerFormat', newerFormatCount - maxNewerFormatRows);
  }

  let kindIndex = 0;
  while (kindIndex < EVICTION_ORDER.length && readStats(db).total_bytes > maxBytes) {
    const removed = evictOldestOfKind(db, EVICTION_ORDER[kindIndex], evictionBatchSize);
    if (removed === 0) {
      kindIndex++;
    }
    evicted += removed;
  }

  if (evicted) {
    console.info(`unsupported_message: evicted ${evicted} row(s) to fit the limits`);
  }
}

/**
 * Remove rows past their own expiry, then apply `enforceUnsupportedMessageBudgetWith`.
 */
export function enforceUnsupportedMessageLimitsWith(
  db: Database,
  nowMs: number,
  limits: Partial<UnsupportedMessageLimits> = {}
) {
  db.prepare(
    `DELETE FROM ${UNSUPPORTED_MESSAGE_TABLE} WHERE expires_at_ms IS NOT NULL AND expires_at_ms <= $nowMs;`
  ).run({ nowMs });
  enforceUnsupportedMessageBudgetWith(db, limits);
}

export function insertUnsupportedMessage(
  record: UnsupportedMessageInsert,
  instance?: Database
): boolean {
  const db = assertGlobalInstanceOrInstance(instance);
  const result = db
    .prepare(
      `INSERT OR IGNORE INTO ${UNSUPPORTED_MESSAGE_TABLE} (
        id,
        kind,
        swarm_public_key,
        namespace,
        hash,
        sender,
        sent_timestamp_ms,
        server_timestamp_ms,
        server_expiry_ms,
        data,
        placeholder_message_id,
        expires_at_ms,
        received_at_ms,
        last_attempt_version
      ) VALUES (
        $id,
        $kind,
        $swarm_public_key,
        $namespace,
        $hash,
        $sender,
        $sent_timestamp_ms,
        $server_timestamp_ms,
        $server_expiry_ms,
        $data,
        $placeholder_message_id,
        $expires_at_ms,
        $received_at_ms,
        $last_attempt_version
      );`
    )
    .run({ ...record, id: record.id ?? null });

  // a failure here must not undo or hide the insert: the next run catches up
  try {
    enforceUnsupportedMessageBudgetWith(db);
  } catch (e) {
    console.error(`unsupported_message: enforcing the limits after an insert failed: ${e.message}`);
  }
  return result.changes > 0;
}

export function setUnsupportedMessagePlaceholder(
  hash: string,
  placeholderMessageId: string,
  instance?: Database
) {
  assertGlobalInstanceOrInstance(instance)
    .prepare(
      `UPDATE ${UNSUPPORTED_MESSAGE_TABLE} SET placeholder_message_id = $placeholderMessageId WHERE hash = $hash;`
    )
    .run({ hash, placeholderMessageId });
}

export function enforceUnsupportedMessageLimits(nowMs: number, instance?: Database) {
  enforceUnsupportedMessageLimitsWith(assertGlobalInstanceOrInstance(instance), nowMs);
}

export function markNewerFormatUnsupportedMessagesAttempted(
  currentVersion: string,
  instance?: Database
): number {
  return assertGlobalInstanceOrInstance(instance)
    .prepare(
      `UPDATE ${UNSUPPORTED_MESSAGE_TABLE} SET last_attempt_version = $currentVersion
       WHERE kind = 'newerFormat' AND last_attempt_version != $currentVersion;`
    )
    .run({ currentVersion }).changes;
}

export function getUnknownTypeUnsupportedMessagesToReprocess(
  currentVersion: string,
  afterId: number,
  limit: number,
  instance?: Database
): Array<UnsupportedMessageRow> {
  return assertGlobalInstanceOrInstance(instance)
    .prepare(
      `SELECT * FROM ${UNSUPPORTED_MESSAGE_TABLE}
       WHERE kind = 'unknownType' AND id > $afterId AND last_attempt_version != $currentVersion
       ORDER BY id ASC LIMIT $limit;`
    )
    .all<UnsupportedMessageRow>({ currentVersion, afterId, limit });
}

export function setUnsupportedMessageAttemptVersion(
  id: number,
  version: string,
  instance?: Database
) {
  assertGlobalInstanceOrInstance(instance)
    .prepare(
      `UPDATE ${UNSUPPORTED_MESSAGE_TABLE} SET last_attempt_version = $version WHERE id = $id;`
    )
    .run({ id, version });
}

export function removeUnsupportedMessageById(id: number, instance?: Database) {
  assertGlobalInstanceOrInstance(instance)
    .prepare(`DELETE FROM ${UNSUPPORTED_MESSAGE_TABLE} WHERE id = $id;`)
    .run({ id });
}

export function removeUnsupportedMessagesByPlaceholderIds(
  placeholderMessageIds: Array<string>,
  instance?: Database
) {
  if (!placeholderMessageIds.length) {
    return;
  }
  assertGlobalInstanceOrInstance(instance)
    .prepare(
      `DELETE FROM ${UNSUPPORTED_MESSAGE_TABLE} WHERE placeholder_message_id IN ( ${placeholderMessageIds.map(() => '?').join(', ')} );`
    )
    .run(placeholderMessageIds);
}

/**
 * Only the sender can unsend their message, so the caller must have checked that the unsend request came
 * from `sender`.
 */
export function removeUnsupportedMessagesBySenderAndSentTimestamp(
  sender: string,
  sentTimestampMs: number,
  instance?: Database
) {
  assertGlobalInstanceOrInstance(instance)
    .prepare(
      `DELETE FROM ${UNSUPPORTED_MESSAGE_TABLE} WHERE sender = $sender AND sent_timestamp_ms = $sentTimestampMs;`
    )
    .run({ sender, sentTimestampMs });
}

export function setUnsupportedMessageExpiry(
  hash: string,
  expiresAtMs: number | null,
  instance?: Database
) {
  assertGlobalInstanceOrInstance(instance)
    .prepare(
      `UPDATE ${UNSUPPORTED_MESSAGE_TABLE} SET expires_at_ms = $expiresAtMs WHERE hash = $hash;`
    )
    .run({ hash, expiresAtMs });
}

/**
 * There is no foreign key from `unsupported_message` to `messages`, so every statement deleting from
 * `messages` has to call this first with the same WHERE clause, or the retained data of a deleted
 * placeholder would outlive it.
 */
export function removeUnsupportedMessagesForMessagesWhere(
  db: Database,
  messagesWhereClause: string,
  params: StatementParameters<object>
) {
  db.prepare(
    `DELETE FROM ${UNSUPPORTED_MESSAGE_TABLE} WHERE placeholder_message_id IN (
      SELECT id FROM ${MESSAGES_TABLE} WHERE ${messagesWhereClause}
    );`
  ).run(params);
}

export const unsupportedMessageData: UnsupportedMessageDataNode = {
  insertUnsupportedMessage,
  setUnsupportedMessagePlaceholder,
  enforceUnsupportedMessageLimits,
  markNewerFormatUnsupportedMessagesAttempted,
  getUnknownTypeUnsupportedMessagesToReprocess,
  setUnsupportedMessageAttemptVersion,
  removeUnsupportedMessageById,
  removeUnsupportedMessagesByPlaceholderIds,
  removeUnsupportedMessagesBySenderAndSentTimestamp,
  setUnsupportedMessageExpiry,
};
