import { type Database, type StatementParameters } from '@signalapp/sqlcipher';
import { MESSAGES_TABLE } from '../database_utility';
import { assertGlobalInstanceOrInstance } from '../sqlInstance';
import {
  UNSUPPORTED_MESSAGE_MAX_RETAINED_BYTES,
  UNSUPPORTED_MESSAGE_TABLE,
  type UnsupportedMessageDataNode,
  type UnsupportedMessageInsert,
  type UnsupportedMessageRow,
} from '../../session/unsupported_messages/types';

/**
 * Remove rows past their own expiry, then evict the oldest rows until the retained data fits the budget.
 *
 * `newerFormat` rows go before `unknownType` ones: anyone can deposit data with the newer-format prefix
 * into a 1o1 namespace, whereas an `unknownType` message came from an authenticated sender.
 */
export function enforceUnsupportedMessageLimitsWith(db: Database, nowMs: number, maxBytes: number) {
  db.prepare(
    `DELETE FROM ${UNSUPPORTED_MESSAGE_TABLE} WHERE expires_at_ms IS NOT NULL AND expires_at_ms <= $nowMs;`
  ).run({ nowMs });

  let totalBytes =
    db
      .prepare(`SELECT IFNULL(SUM(length(data)), 0) AS total FROM ${UNSUPPORTED_MESSAGE_TABLE};`)
      .get<{ total: number }>()?.total ?? 0;

  if (totalBytes <= maxBytes) {
    return;
  }

  const candidates = db
    .prepare(
      `SELECT id, length(data) AS size FROM ${UNSUPPORTED_MESSAGE_TABLE}
       ORDER BY (kind = 'newerFormat') DESC, received_at_ms ASC, id ASC;`
    )
    .all<{ id: number; size: number }>();

  const idsToRemove: Array<number> = [];
  for (const candidate of candidates) {
    if (totalBytes <= maxBytes) {
      break;
    }
    idsToRemove.push(candidate.id);
    totalBytes -= candidate.size;
  }

  if (idsToRemove.length) {
    db.prepare(
      `DELETE FROM ${UNSUPPORTED_MESSAGE_TABLE} WHERE id IN ( ${idsToRemove.map(() => '?').join(', ')} );`
    ).run(idsToRemove);
  }
  console.info(`unsupported_message: evicted ${idsToRemove.length} row(s) to fit the byte budget`);
}

export function insertUnsupportedMessage(
  record: UnsupportedMessageInsert,
  nowMs: number,
  instance?: Database
): boolean {
  const db = assertGlobalInstanceOrInstance(instance);
  const result = db
    .prepare(
      `INSERT OR IGNORE INTO ${UNSUPPORTED_MESSAGE_TABLE} (
        kind,
        swarm_public_key,
        namespace,
        hash,
        server_timestamp_ms,
        server_expiry_ms,
        data,
        placeholder_message_id,
        expires_at_ms,
        received_at_ms,
        last_attempt_version
      ) VALUES (
        $kind,
        $swarm_public_key,
        $namespace,
        $hash,
        $server_timestamp_ms,
        $server_expiry_ms,
        $data,
        $placeholder_message_id,
        $expires_at_ms,
        $received_at_ms,
        $last_attempt_version
      );`
    )
    .run(record);

  enforceUnsupportedMessageLimitsWith(db, nowMs, UNSUPPORTED_MESSAGE_MAX_RETAINED_BYTES);
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
  enforceUnsupportedMessageLimitsWith(
    assertGlobalInstanceOrInstance(instance),
    nowMs,
    UNSUPPORTED_MESSAGE_MAX_RETAINED_BYTES
  );
}

export function getUnsupportedMessagesToReprocess(
  currentVersion: string,
  instance?: Database
): Array<UnsupportedMessageRow> {
  return assertGlobalInstanceOrInstance(instance)
    .prepare(
      `SELECT * FROM ${UNSUPPORTED_MESSAGE_TABLE} WHERE last_attempt_version != $currentVersion ORDER BY id ASC;`
    )
    .all<UnsupportedMessageRow>({ currentVersion });
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
  getUnsupportedMessagesToReprocess,
  setUnsupportedMessageAttemptVersion,
  removeUnsupportedMessageById,
  removeUnsupportedMessagesByPlaceholderIds,
};
