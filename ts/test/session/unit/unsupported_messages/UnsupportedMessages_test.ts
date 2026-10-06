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
  enforceUnsupportedMessageLimitsWith,
  insertUnsupportedMessage,
  removeUnsupportedMessagesByPlaceholderIds,
} from '../../../../node/sql_calls/unsupported_message';
import { sqlNode } from '../../../../node/sql';
import type { UnsupportedMessageInsert } from '../../../../session/unsupported_messages/types';
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
      expect(insertUnsupportedMessage(first, 0, db)).to.eq(true);
      expect(insertUnsupportedMessage({ ...first }, 0, db)).to.eq(false);
      expect(remainingHashes()).to.deep.eq([first.hash]);
    });

    it('round-trips the raw data and a uuid placeholder id', () => {
      const placeholderId = '0e9c4e46-7b9f-4b4e-9b3c-6c4b1c1a2f00';
      insertUnsupportedMessage(record({ placeholder_message_id: placeholderId }), 0, db);
      const row = db.prepare('SELECT * FROM unsupported_message;').get<any>();
      expect(row.placeholder_message_id).to.eq(placeholderId);
      expect(Array.from(row.data)).to.deep.eq(new Array(10).fill(nextHash));
    });

    it('removes the record when its placeholder is removed', () => {
      addMessage('msg-1', otherPk);
      addMessage('msg-2', otherPk);
      const kept = record({ placeholder_message_id: 'msg-2' });
      insertUnsupportedMessage(record({ placeholder_message_id: 'msg-1' }), 0, db);
      insertUnsupportedMessage(kept, 0, db);

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
      insertUnsupportedMessage(record({ placeholder_message_id: 'msg-1' }), 0, db);
      insertUnsupportedMessage(record({ placeholder_message_id: 'msg-2' }), 0, db);
      insertUnsupportedMessage(elsewhere, 0, db);
      insertUnsupportedMessage(noPlaceholder, 0, db);

      sqlNode.removeAllMessagesInConversation(otherPk, db);
      expect(remainingHashes()).to.deep.eq([elsewhere.hash, noPlaceholder.hash]);
    });

    it('removes the records of messages deleted before a group cutoff', () => {
      addMessage('msg-old', groupPk, 1000);
      addMessage('msg-new', groupPk, 5000);
      const newer = record({ placeholder_message_id: 'msg-new' });
      insertUnsupportedMessage(record({ placeholder_message_id: 'msg-old' }), 0, db);
      insertUnsupportedMessage(newer, 0, db);

      sqlNode.removeAllMessagesInConversationSentBefore(
        { conversationId: groupPk, deleteBeforeSeconds: 2 },
        db
      );
      expect(remainingHashes()).to.deep.eq([newer.hash]);
    });

    it('removes the record of a placeholder marked as deleted', () => {
      insertUnsupportedMessage(record({ placeholder_message_id: 'msg-1' }), 0, db);
      removeUnsupportedMessagesByPlaceholderIds(['msg-1'], db);
      expect(remainingHashes()).to.deep.eq([]);
    });

    it('removes expired records', () => {
      const kept = record({ expires_at_ms: 2000 });
      const neverExpires = record();
      insertUnsupportedMessage(record({ expires_at_ms: 1000 }), 0, db);
      insertUnsupportedMessage(kept, 0, db);
      insertUnsupportedMessage(neverExpires, 0, db);

      enforceUnsupportedMessageLimitsWith(db, 1000, Number.MAX_SAFE_INTEGER);
      expect(remainingHashes()).to.deep.eq([kept.hash, neverExpires.hash]);
    });

    it('evicts the oldest newer format records first to fit the byte budget', () => {
      const oldUnknown = record({ kind: 'unknownType' });
      const oldNewer = record({ kind: 'newerFormat' });
      const newUnknown = record({ kind: 'unknownType' });
      const newNewer = record({ kind: 'newerFormat' });
      [oldUnknown, oldNewer, newUnknown, newNewer].forEach(r => insertUnsupportedMessage(r, 0, db));

      // 4 rows of 10 bytes each
      enforceUnsupportedMessageLimitsWith(db, 0, 30);
      expect(remainingHashes()).to.deep.eq([oldUnknown.hash, newUnknown.hash, newNewer.hash]);

      enforceUnsupportedMessageLimitsWith(db, 0, 15);
      expect(remainingHashes()).to.deep.eq([newUnknown.hash]);
    });
  });
});
