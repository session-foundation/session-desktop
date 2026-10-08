import { expect } from 'chai';
import type { GroupPubkeyType } from 'libsession_util_nodejs';
import SQL, { type Database } from '@signalapp/sqlcipher';
import Sinon from 'sinon';
import { SignalService } from '../../../../protobuf';
import {
  containsUnknownContentType,
  isNewerFormatData,
  isUnknownTypeContent,
  topLevelFieldNumbers,
} from '../../../../session/unsupported_messages/detection';
import {
  retainedExpiryMs,
  unknownTypePlacement,
} from '../../../../session/unsupported_messages/UnsupportedMessages';
import {
  UNSUPPORTED_BANNER_REAPPEAR_AFTER_DISMISSAL_MS,
  unsupportedBannerState,
} from '../../../../session/unsupported_messages/banner';
import { createUnsupportedMessageTableV58 } from '../../../../node/migration/sessionMigrations';
import {
  enforceUnsupportedMessageBudgetWith,
  enforceUnsupportedMessageLimitsWith,
  getUnknownTypeUnsupportedMessagesToReprocess,
  insertUnsupportedMessage,
  markNewerFormatUnsupportedMessagesAttempted,
  removeUnsupportedMessagesByPlaceholderIds,
  removeUnsupportedMessagesBySenderAndSentTimestamp,
  setUnsupportedMessageExpiry,
} from '../../../../node/sql_calls/unsupported_message';
import { sqlNode } from '../../../../node/sql';
import {
  UNSUPPORTED_MESSAGE_ROW_OVERHEAD_BYTES,
  type UnsupportedMessageInsert,
  type UnsupportedMessageRow,
} from '../../../../session/unsupported_messages/types';
import { reprocessRow } from '../../../../session/unsupported_messages/reprocess';
import { UnsupportedMessageData } from '../../../../data/unsupportedMessage/unsupportedMessage';
import * as ContentMessage from '../../../../receiver/contentMessage';
import {
  MetaGroupWrapperActions,
  MultiEncryptWrapperActions,
} from '../../../../webworker/workers/browser/libsession_worker_interface';
import ProBackendAPI from '../../../../session/apis/pro_backend_api/ProBackendAPI';
import { SnodeNamespaces } from '../../../../session/apis/snode_api/namespaces';
import { ConvoHub } from '../../../../session/conversations';
import type { SwarmDecodedEnvelope } from '../../../../receiver/types';
import { DURATION } from '../../../../session/constants';
import { TestUtils } from '../../../test-utils';

// field 19, length-delimited, one byte: a top-level type newer than anything this client knows
const UNKNOWN_FIELD_19 = [0x9a, 0x01, 0x01, 0x2a];
// field 18 (2.0's msgId), varint
const MSG_ID_FIELD_18 = [0x90, 0x01, 0x05];

function contentBytes(content: SignalService.IContent, extra: Array<number> = []) {
  const encoded = SignalService.Content.encode(SignalService.Content.create(content)).finish();
  return new Uint8Array([...encoded, ...extra]);
}

function isUnknownType(content: SignalService.IContent, extra: Array<number>) {
  const bytes = contentBytes(content, extra);
  return isUnknownTypeContent(SignalService.Content.decode(bytes), bytes);
}

const ourPk = TestUtils.generateFakePubKeyStr();
const otherPk = TestUtils.generateFakePubKeyStr();
const groupPk = `03${'a'.repeat(64)}` as GroupPubkeyType;

describe('UnsupportedMessages', () => {
  beforeEach(() => {
    TestUtils.stubWindowLog();
  });

  afterEach(() => {
    Sinon.restore();
  });

  describe('topLevelFieldNumbers', () => {
    it('returns the field numbers in order', () => {
      // field 1 varint, field 3 length-delimited (2 bytes), field 15 fixed64, field 2 fixed32
      const bytes = new Uint8Array([
        0x08,
        0x96,
        0x01,
        0x1a,
        0x02,
        0x41,
        0x42,
        0x79,
        ...new Array(8).fill(0),
        0x15,
        ...new Array(4).fill(0),
      ]);
      expect(topLevelFieldNumbers(bytes)).to.deep.eq([1, 3, 15, 2]);
    });

    it('returns an empty list for empty data', () => {
      expect(topLevelFieldNumbers(new Uint8Array())).to.deep.eq([]);
    });

    it('returns null for a truncated length-delimited field', () => {
      expect(topLevelFieldNumbers(new Uint8Array([0x1a, 0x05, 0x41]))).to.eq(null);
    });

    it('returns null for a truncated fixed64 field', () => {
      expect(topLevelFieldNumbers(new Uint8Array([0x79, 0x00, 0x00]))).to.eq(null);
    });

    it('returns null for a group wire type', () => {
      expect(topLevelFieldNumbers(new Uint8Array([0x0b, 0x0c]))).to.eq(null);
    });

    it('returns null for field number 0', () => {
      expect(topLevelFieldNumbers(new Uint8Array([0x00, 0x01]))).to.eq(null);
    });

    it('treats fields up to 18 as known', () => {
      expect(containsUnknownContentType(new Uint8Array(MSG_ID_FIELD_18))).to.eq(false);
      expect(containsUnknownContentType(new Uint8Array(UNKNOWN_FIELD_19))).to.eq(true);
    });

    it('does not report an unknown type for malformed data', () => {
      expect(containsUnknownContentType(new Uint8Array([...UNKNOWN_FIELD_19, 0x1a, 0x09]))).to.eq(
        false
      );
    });
  });

  describe('isNewerFormatData', () => {
    it('is true only for data starting with a zero byte', () => {
      expect(isNewerFormatData(new Uint8Array([0x00, 0x02, 0x10]))).to.eq(true);
      expect(isNewerFormatData(new Uint8Array([0x0a, 0x00]))).to.eq(false);
      expect(isNewerFormatData(new Uint8Array())).to.eq(false);
    });
  });

  describe('isUnknownTypeContent', () => {
    it('is true for an unknown field with no known content', () => {
      expect(isUnknownType({ sigTimestamp: 1234 }, UNKNOWN_FIELD_19)).to.eq(true);
    });

    it('is false for known content with an unknown field', () => {
      expect(isUnknownType({ dataMessage: { body: 'hi' } }, UNKNOWN_FIELD_19)).to.eq(false);
      expect(
        isUnknownType(
          { receiptMessage: { type: SignalService.ReceiptMessage.Type.READ, timestamp: [1] } },
          UNKNOWN_FIELD_19
        )
      ).to.eq(false);
    });

    it('is false without an unknown field, even with no known content', () => {
      expect(isUnknownType({ sigTimestamp: 1234 }, [])).to.eq(false);
    });

    it('does not treat field 18 as an unknown type', () => {
      expect(isUnknownType({ sigTimestamp: 1234 }, MSG_ID_FIELD_18)).to.eq(false);
    });

    it('is true for a sync copy whose DataMessage only holds a syncTarget', () => {
      expect(isUnknownType({ dataMessage: { syncTarget: otherPk } }, UNKNOWN_FIELD_19)).to.eq(true);
    });
  });

  describe('unknownTypePlacement', () => {
    const base = { author: otherPk, groupPk, syncTarget: null };

    it('places a message from someone else as incoming in their conversation', () => {
      expect(unknownTypePlacement({ ...base, isGroupMessage: false, isFromUs: false })).to.deep.eq({
        placement: 'incoming',
        threadId: otherPk,
      });
    });

    it('places a sync from our own device in its sync target as outgoing', () => {
      expect(
        unknownTypePlacement({
          ...base,
          author: ourPk,
          isGroupMessage: false,
          isFromUs: true,
          syncTarget: otherPk,
        })
      ).to.deep.eq({ placement: 'outgoing', threadId: otherPk });
    });

    it('does not place a sync from our own device without a valid sync target', () => {
      expect(
        unknownTypePlacement({ ...base, author: ourPk, isGroupMessage: false, isFromUs: true })
      ).to.deep.eq({ placement: 'none', threadId: null });
      expect(
        unknownTypePlacement({
          ...base,
          author: ourPk,
          isGroupMessage: false,
          isFromUs: true,
          syncTarget: groupPk,
        })
      ).to.deep.eq({ placement: 'none', threadId: null });
    });

    it('places a group message in the group, outgoing if it is ours', () => {
      expect(unknownTypePlacement({ ...base, isGroupMessage: true, isFromUs: false })).to.deep.eq({
        placement: 'incoming',
        threadId: groupPk,
      });
      expect(unknownTypePlacement({ ...base, isGroupMessage: true, isFromUs: true })).to.deep.eq({
        placement: 'outgoing',
        threadId: groupPk,
      });
    });
  });

  describe('retainedExpiryMs', () => {
    const serverTimestampMs = 1_000_000;

    it('uses a disappear after send expiry when there is one', () => {
      expect(
        retainedExpiryMs({
          afterSendExpiresAtMs: 5_000,
          serverTimestampMs,
          serverExpiryMs: serverTimestampMs + 14 * DURATION.DAYS,
        })
      ).to.eq(5_000);
    });

    it('uses a swarm expiry shorter than the default TTL', () => {
      const serverExpiryMs = serverTimestampMs + DURATION.DAYS;
      expect(
        retainedExpiryMs({ afterSendExpiresAtMs: null, serverTimestampMs, serverExpiryMs })
      ).to.eq(serverExpiryMs);
    });

    it('keeps the record when the swarm expiry is the default TTL', () => {
      expect(
        retainedExpiryMs({
          afterSendExpiresAtMs: null,
          serverTimestampMs,
          serverExpiryMs: serverTimestampMs + 14 * DURATION.DAYS,
        })
      ).to.eq(null);
      expect(
        retainedExpiryMs({ afterSendExpiresAtMs: null, serverTimestampMs, serverExpiryMs: null })
      ).to.eq(null);
    });
  });

  describe('unsupportedBannerState', () => {
    const t = 10 * DURATION.DAYS;
    const week = UNSUPPORTED_BANNER_REAPPEAR_AFTER_DISMISSAL_MS;

    it('is hidden until triggered', () => {
      expect(
        unsupportedBannerState({
          triggeredAtMs: null,
          otherDeviceTriggeredAtMs: null,
          dismissedAtMs: null,
        })
      ).to.eq('hidden');
    });

    it('uses the general text when never dismissed and no other device triggered it', () => {
      expect(
        unsupportedBannerState({
          triggeredAtMs: t,
          otherDeviceTriggeredAtMs: null,
          dismissedAtMs: null,
        })
      ).to.eq('general');
    });

    it('uses the other device text when that was a trigger', () => {
      expect(
        unsupportedBannerState({
          triggeredAtMs: t,
          otherDeviceTriggeredAtMs: t,
          dismissedAtMs: null,
        })
      ).to.eq('otherDevice');
    });

    it('only reappears for a trigger at least a week after dismissal', () => {
      expect(
        unsupportedBannerState({
          triggeredAtMs: t + week - 1,
          otherDeviceTriggeredAtMs: null,
          dismissedAtMs: t,
        })
      ).to.eq('hidden');
      expect(
        unsupportedBannerState({
          triggeredAtMs: t + week,
          otherDeviceTriggeredAtMs: null,
          dismissedAtMs: t,
        })
      ).to.eq('general');
    });

    it('ignores an other device trigger from before the dismissal threshold', () => {
      expect(
        unsupportedBannerState({
          triggeredAtMs: t + week,
          otherDeviceTriggeredAtMs: t - 1,
          dismissedAtMs: t,
        })
      ).to.eq('general');
      expect(
        unsupportedBannerState({
          triggeredAtMs: t + week,
          otherDeviceTriggeredAtMs: t + week,
          dismissedAtMs: t,
        })
      ).to.eq('otherDevice');
    });
  });

  describe('unsupported_message table', () => {
    let db: Database;
    let nextHash = 0;

    function record(overrides: Partial<UnsupportedMessageInsert> = {}): UnsupportedMessageInsert {
      nextHash++;
      return {
        kind: 'unknownType',
        swarm_public_key: ourPk,
        namespace: 0,
        hash: `hash-${nextHash}`,
        sender: otherPk,
        sent_timestamp_ms: 900,
        server_timestamp_ms: 1000,
        server_expiry_ms: null,
        data: new Uint8Array(10).fill(nextHash),
        placeholder_message_id: null,
        expires_at_ms: null,
        received_at_ms: nextHash,
        last_attempt_version: '1.0.0',
        ...overrides,
      };
    }

    function addMessage(id: string, conversationId: string, sentAt = 1000) {
      db.prepare(
        'INSERT INTO messages (id, json, conversationId, sent_at) VALUES ($id, $json, $conversationId, $sentAt);'
      ).run({ id, json: '{}', conversationId, sentAt });
    }

    function remainingHashes() {
      return db
        .prepare('SELECT hash FROM unsupported_message ORDER BY id;')
        .all<{ hash: string }>()
        .map(r => r.hash);
    }

    beforeEach(() => {
      db = new SQL(':memory:');
      db.exec(
        'CREATE TABLE messages (id STRING PRIMARY KEY ASC, json TEXT, conversationId STRING, sent_at INTEGER);'
      );
      createUnsupportedMessageTableV58(db);
    });

    afterEach(() => {
      db.close();
    });

    it('keeps the hash unique', () => {
      const first = record();
      expect(insertUnsupportedMessage(first, db)).to.eq(true);
      expect(insertUnsupportedMessage({ ...first }, db)).to.eq(false);
      expect(remainingHashes()).to.deep.eq([first.hash]);
    });

    it('keeps the id of a re-retained record so it keeps its place in the eviction order', () => {
      const oldest = record();
      insertUnsupportedMessage(oldest, db);
      insertUnsupportedMessage(record(), db);
      const oldestId = db
        .prepare('SELECT id FROM unsupported_message WHERE hash = $hash;')
        .get<{ id: number }>({ hash: oldest.hash })?.id;
      db.prepare('DELETE FROM unsupported_message WHERE hash = $hash;').run({ hash: oldest.hash });

      expect(insertUnsupportedMessage({ ...oldest, id: oldestId }, db)).to.eq(true);
      expect(remainingHashes()[0]).to.eq(oldest.hash);
    });

    it('round-trips the raw data and a uuid placeholder id', () => {
      const placeholderId = '0e9c4e46-7b9f-4b4e-9b3c-6c4b1c1a2f00';
      insertUnsupportedMessage(record({ placeholder_message_id: placeholderId }), db);
      const row = db.prepare('SELECT * FROM unsupported_message;').get<any>();
      expect(row.placeholder_message_id).to.eq(placeholderId);
      expect(Array.from(row.data)).to.deep.eq(new Array(10).fill(nextHash));
    });

    it('removes the record when its placeholder is removed', () => {
      addMessage('msg-1', otherPk);
      addMessage('msg-2', otherPk);
      const kept = record({ placeholder_message_id: 'msg-2' });
      insertUnsupportedMessage(record({ placeholder_message_id: 'msg-1' }), db);
      insertUnsupportedMessage(kept, db);

      sqlNode.removeMessage('msg-1', db);
      expect(remainingHashes()).to.deep.eq([kept.hash]);

      sqlNode.removeMessagesByIds(['msg-2'], db);
      expect(remainingHashes()).to.deep.eq([]);
    });

    it('removes the records of a deleted conversation and keeps the rest', () => {
      addMessage('msg-1', otherPk);
      addMessage('msg-2', otherPk);
      addMessage('msg-3', groupPk);
      const elsewhere = record({ placeholder_message_id: 'msg-3' });
      const noPlaceholder = record();
      insertUnsupportedMessage(record({ placeholder_message_id: 'msg-1' }), db);
      insertUnsupportedMessage(record({ placeholder_message_id: 'msg-2' }), db);
      insertUnsupportedMessage(elsewhere, db);
      insertUnsupportedMessage(noPlaceholder, db);

      sqlNode.removeAllMessagesInConversation(otherPk, db);
      expect(remainingHashes()).to.deep.eq([elsewhere.hash, noPlaceholder.hash]);
    });

    it('removes the records of messages deleted before a group cutoff', () => {
      addMessage('msg-old', groupPk, 1000);
      addMessage('msg-new', groupPk, 5000);
      const newer = record({ placeholder_message_id: 'msg-new' });
      insertUnsupportedMessage(record({ placeholder_message_id: 'msg-old' }), db);
      insertUnsupportedMessage(newer, db);

      sqlNode.removeAllMessagesInConversationSentBefore(
        { conversationId: groupPk, deleteBeforeSeconds: 2 },
        db
      );
      expect(remainingHashes()).to.deep.eq([newer.hash]);
    });

    it('round-trips the sender and sent timestamp, and allows them to be null', () => {
      insertUnsupportedMessage(record(), db);
      insertUnsupportedMessage(
        record({ kind: 'newerFormat', sender: null, sent_timestamp_ms: null }),
        db
      );
      const rows = db
        .prepare('SELECT sender, sent_timestamp_ms FROM unsupported_message ORDER BY id;')
        .all<{ sender: string | null; sent_timestamp_ms: number | null }>();
      expect(rows).to.deep.eq([
        { sender: otherPk, sent_timestamp_ms: 900 },
        { sender: null, sent_timestamp_ms: null },
      ]);
    });

    it('removes only the records matching both the sender and sent timestamp of an unsend', () => {
      const unsent = record({ sender: otherPk, sent_timestamp_ms: 900 });
      const otherTimestamp = record({ sender: otherPk, sent_timestamp_ms: 901 });
      const otherSender = record({ sender: ourPk, sent_timestamp_ms: 900 });
      const newerFormat = record({ kind: 'newerFormat', sender: null, sent_timestamp_ms: null });
      [unsent, otherTimestamp, otherSender, newerFormat].forEach(r =>
        insertUnsupportedMessage(r, db)
      );

      removeUnsupportedMessagesBySenderAndSentTimestamp(otherPk, 900, db);
      expect(remainingHashes()).to.deep.eq([
        otherTimestamp.hash,
        otherSender.hash,
        newerFormat.hash,
      ]);
    });

    it('gives a record an expiry once it is known it will have no placeholder', () => {
      const unplaced = record();
      insertUnsupportedMessage(unplaced, db);
      setUnsupportedMessageExpiry(unplaced.hash, 1000, db);

      enforceUnsupportedMessageLimitsWith(db, 1000);
      expect(remainingHashes()).to.deep.eq([]);
    });

    it('removes the record of a placeholder marked as deleted', () => {
      insertUnsupportedMessage(record({ placeholder_message_id: 'msg-1' }), db);
      removeUnsupportedMessagesByPlaceholderIds(['msg-1'], db);
      expect(remainingHashes()).to.deep.eq([]);
    });

    it('removes expired records', () => {
      const kept = record({ expires_at_ms: 2000 });
      const neverExpires = record();
      insertUnsupportedMessage(record({ expires_at_ms: 1000 }), db);
      insertUnsupportedMessage(kept, db);
      insertUnsupportedMessage(neverExpires, db);

      enforceUnsupportedMessageLimitsWith(db, 1000);
      expect(remainingHashes()).to.deep.eq([kept.hash, neverExpires.hash]);
    });

    function stats() {
      return db
        .prepare('SELECT total_bytes, newer_format_count FROM unsupported_message_stats;')
        .all<{ total_bytes: number; newer_format_count: number }>();
    }

    function recount() {
      return db
        .prepare(
          `SELECT IFNULL(SUM(length(data) + ${UNSUPPORTED_MESSAGE_ROW_OVERHEAD_BYTES}), 0) AS total_bytes,
             IFNULL(SUM(kind = 'newerFormat'), 0) AS newer_format_count
           FROM unsupported_message;`
        )
        .all<{ total_bytes: number; newer_format_count: number }>();
    }

    // each record() row holds 10 bytes of data
    const ROW_COST = 10 + UNSUPPORTED_MESSAGE_ROW_OVERHEAD_BYTES;

    it('starts with a single zeroed stats row', () => {
      expect(stats()).to.deep.eq([{ total_bytes: 0, newer_format_count: 0 }]);
    });

    it('keeps the stats exact across inserts, ignored duplicates, updates and deletes', () => {
      const first = record({ kind: 'newerFormat' });
      insertUnsupportedMessage(first, db);
      insertUnsupportedMessage(record({ data: new Uint8Array(1) }), db);
      insertUnsupportedMessage({ ...first }, db);
      insertUnsupportedMessage(record({ kind: 'newerFormat', data: new Uint8Array(300) }), db);
      expect(stats()).to.deep.eq([
        {
          total_bytes: 10 + 1 + 300 + 3 * UNSUPPORTED_MESSAGE_ROW_OVERHEAD_BYTES,
          newer_format_count: 2,
        },
      ]);
      expect(stats()).to.deep.eq(recount());

      db.prepare(
        "UPDATE unsupported_message SET kind = 'unknownType', data = $data WHERE hash = $hash;"
      ).run({ hash: first.hash, data: new Uint8Array(42) });
      expect(stats()).to.deep.eq(recount());

      db.prepare('DELETE FROM unsupported_message WHERE hash = $hash;').run({ hash: first.hash });
      expect(stats()).to.deep.eq(recount());

      db.exec('DELETE FROM unsupported_message;');
      expect(stats()).to.deep.eq([{ total_bytes: 0, newer_format_count: 0 }]);
    });

    it('counts the per row overhead against the byte budget', () => {
      const tiny = [record(), record(), record()].map(r => ({ ...r, data: new Uint8Array(1) }));
      tiny.forEach(r => insertUnsupportedMessage(r, db));

      // 3 bytes of data, but 3 rows of overhead
      enforceUnsupportedMessageBudgetWith(db, {
        maxBytes: 2 * (1 + UNSUPPORTED_MESSAGE_ROW_OVERHEAD_BYTES),
        evictionBatchSize: 1,
      });
      expect(remainingHashes()).to.deep.eq([tiny[1].hash, tiny[2].hash]);
    });

    it('evicts the oldest newer format records first to fit the byte budget', () => {
      const oldUnknown = record({ kind: 'unknownType' });
      const oldNewer = record({ kind: 'newerFormat' });
      const newUnknown = record({ kind: 'unknownType' });
      const newNewer = record({ kind: 'newerFormat' });
      [oldUnknown, oldNewer, newUnknown, newNewer].forEach(r => insertUnsupportedMessage(r, db));

      enforceUnsupportedMessageBudgetWith(db, { maxBytes: 3 * ROW_COST, evictionBatchSize: 1 });
      expect(remainingHashes()).to.deep.eq([oldUnknown.hash, newUnknown.hash, newNewer.hash]);

      enforceUnsupportedMessageBudgetWith(db, { maxBytes: 1.5 * ROW_COST, evictionBatchSize: 1 });
      expect(remainingHashes()).to.deep.eq([newUnknown.hash]);
      expect(stats()).to.deep.eq([{ total_bytes: ROW_COST, newer_format_count: 0 }]);
    });

    it('evicts in batches, re-reading the total between them', () => {
      const unknown = [record(), record(), record()];
      const newer = [record({ kind: 'newerFormat' }), record({ kind: 'newerFormat' })];
      [...unknown, ...newer].forEach(r => insertUnsupportedMessage(r, db));

      // one batch takes every newer format row, which is enough
      enforceUnsupportedMessageBudgetWith(db, { maxBytes: 4 * ROW_COST, evictionBatchSize: 2 });
      expect(remainingHashes()).to.deep.eq(unknown.map(r => r.hash));

      // a second batch of unknown type rows is needed
      enforceUnsupportedMessageBudgetWith(db, { maxBytes: ROW_COST, evictionBatchSize: 2 });
      expect(remainingHashes()).to.deep.eq([unknown[2].hash]);
    });

    it('caps the number of newer format records, evicting the oldest', () => {
      const newer = [
        record({ kind: 'newerFormat' }),
        record({ kind: 'newerFormat' }),
        record({ kind: 'newerFormat' }),
      ];
      const unknown = record();
      [newer[0], unknown, newer[1], newer[2]].forEach(r => insertUnsupportedMessage(r, db));

      enforceUnsupportedMessageBudgetWith(db, { maxNewerFormatRows: 2 });
      expect(remainingHashes()).to.deep.eq([unknown.hash, newer[1].hash, newer[2].hash]);
      expect(stats()).to.deep.eq([{ total_bytes: 3 * ROW_COST, newer_format_count: 2 }]);
    });

    it('stamps newer format records without returning them, and pages unknown type ones by id', () => {
      const newerToStamp = record({ kind: 'newerFormat', last_attempt_version: '1.0.0' });
      const newerDone = record({ kind: 'newerFormat', last_attempt_version: '2.0.0' });
      const unknownDone = record({ last_attempt_version: '2.0.0' });
      const unknown = [record(), record(), record()];
      [newerToStamp, unknown[0], newerDone, unknownDone, unknown[1], unknown[2]].forEach(r =>
        insertUnsupportedMessage(r, db)
      );

      expect(markNewerFormatUnsupportedMessagesAttempted('2.0.0', db)).to.eq(1);
      expect(
        db
          .prepare(
            "SELECT last_attempt_version FROM unsupported_message WHERE kind = 'newerFormat';"
          )
          .all<{ last_attempt_version: string }>()
          .map(r => r.last_attempt_version)
      ).to.deep.eq(['2.0.0', '2.0.0']);

      const firstPage = getUnknownTypeUnsupportedMessagesToReprocess('2.0.0', 0, 2, db);
      expect(firstPage.map(r => r.hash)).to.deep.eq([unknown[0].hash, unknown[1].hash]);
      const secondPage = getUnknownTypeUnsupportedMessagesToReprocess(
        '2.0.0',
        firstPage[1].id,
        2,
        db
      );
      expect(secondPage.map(r => r.hash)).to.deep.eq([unknown[2].hash]);
    });
  });

  describe('reprocessRow', () => {
    const version = '2.0.0';
    const senderPk = TestUtils.generateFakePubKeyStr();
    const sentAtMs = 1_700_000_000_000;

    function groupRow(data: Uint8Array): UnsupportedMessageRow {
      return {
        id: 7,
        kind: 'unknownType',
        swarm_public_key: groupPk,
        namespace: SnodeNamespaces.ClosedGroupMessages,
        hash: 'group-hash',
        sender: senderPk,
        sent_timestamp_ms: sentAtMs,
        server_timestamp_ms: sentAtMs,
        server_expiry_ms: null,
        data,
        placeholder_message_id: null,
        expires_at_ms: null,
        received_at_ms: sentAtMs,
        last_attempt_version: '1.0.0',
      };
    }

    it('replays a group unknown type record whose data starts with a zero byte', async () => {
      // group data starts with a random nonce, so 1 in 256 begins with the newer-format prefix
      const row = groupRow(new Uint8Array([0x00, 0x5a, 0x5a, 0x5a]));
      const plaintext = contentBytes({ dataMessage: { body: 'now supported' } });

      Sinon.stub(ProBackendAPI, 'getServer').returns({ server: { edPkHex: 'aa' } } as any);
      Sinon.stub(MetaGroupWrapperActions, 'keyGetAll').resolves([new Uint8Array(32)]);
      const decrypt = Sinon.stub(MultiEncryptWrapperActions, 'decryptForGroup').resolves([
        {
          messageHash: row.hash,
          decodedEnvelope: {
            sessionId: senderPk,
            contentPlaintextUnpadded: plaintext,
            envelope: { timestampMs: sentAtMs },
            decodedPro: null,
          },
        },
      ] as any);
      const attempted = Sinon.stub(UnsupportedMessageData, 'setUnsupportedMessageAttemptVersion');
      const removed = Sinon.stub(UnsupportedMessageData, 'removeUnsupportedMessageById').resolves();
      const reinserted = Sinon.stub(UnsupportedMessageData, 'insertUnsupportedMessage');
      const handle = Sinon.stub(ContentMessage, 'innerHandleSwarmContentMessage').resolves();
      Sinon.stub(ConvoHub.use(), 'get').returns(undefined as any);
      TestUtils.stubData('getMessagesBySenderAndSentAt').resolves([{}]);

      expect(await reprocessRow(row, version)).to.eq('replaced');

      expect(decrypt.calledOnce).to.eq(true);
      expect(decrypt.firstCall.args[0]).to.deep.eq([
        { envelopePayload: row.data, messageHash: row.hash },
      ]);
      expect(handle.calledOnce).to.eq(true);
      const { decodedEnvelope } = handle.firstCall.args[0];
      expect(decodedEnvelope.source).to.eq(groupPk);
      expect(decodedEnvelope.senderIdentity).to.eq(senderPk);
      expect((decodedEnvelope as SwarmDecodedEnvelope).replayedPlaceholder).to.deep.eq({
        wasRead: false,
      });
      expect(removed.calledOnceWith(row.id)).to.eq(true);
      expect(attempted.called).to.eq(false);
      expect(reinserted.called).to.eq(false);
    });
  });
});
