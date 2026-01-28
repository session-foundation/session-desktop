import { v4 } from 'uuid';
/* eslint-disable no-restricted-syntax */
import { type Database, type StatementParameters } from '@signalapp/sqlcipher';
import { app, clipboard, dialog, Notification } from 'electron';
import fs from 'fs';
import path from 'path';
import { rimrafSync } from 'rimraf';

import { base64_variants, from_base64, to_hex } from 'libsodium-wrappers-sumo';
import {
  chunk,
  compact,
  difference,
  differenceBy,
  forEach,
  intersection,
  isArray,
  isEmpty,
  isFinite,
  isNumber,
  isObject,
  isString,
  isUndefined,
  map,
  omit,
  some,
  toNumber,
  uniq,
} from 'lodash';

import { GroupPubkeyType } from 'libsession_util_nodejs';
import { ConversationAttributes } from '../models/conversationAttributes';
import { redactAll } from '../util/privacy';
import {
  analyzeQuery,
  arrayStrToJson,
  assertValidConversationAttributes,
  ATTACHMENT_DOWNLOADS_TABLE,
  CONVERSATIONS_TABLE,
  devAssertValidSQLPayload,
  formatRowOfConversation,
  GUARD_NODE_TABLE,
  HEX_KEY,
  IDENTITY_KEYS_TABLE,
  ITEMS_TABLE,
  jsonToObject,
  LAST_HASHES_TABLE,
  MessageColumns,
  MESSAGES_FTS_TABLE,
  MESSAGES_TABLE,
  NODES_FOR_PUBKEY_TABLE,
  objectToJSON,
  OPEN_GROUP_ROOMS_V2_TABLE,
  parseJsonRows,
  SEEN_MESSAGE_TABLE,
  toSqliteBoolean,
} from './database_utility';
import { StorageItem } from './storage_item';

import {
  CONFIG_DUMP_TABLE,
  CountRow,
  JSONRow,
  JSONRows,
  MsgDuplicateSearchOpenGroup,
  roomHasBlindEnabled,
  SaveConversationReturn,
  SaveSeenMessageHash,
  SQLConversationAttributes,
  SQLInsertable,
  SQLMessageAttributes,
  SQLSeenMessageAttributes,
  UpdateLastHashType,
} from '../types/sqlSharedTypes';

import { KNOWN_BLINDED_KEYS_ITEM, SettingsKey } from '../data/settings-key';
import {
  FindAllMessageFromSendersInConversationTypeArgs,
  FindAllMessageHashesInConversationMatchingAuthorTypeArgs,
  FindAllMessageHashesInConversationTypeArgs,
} from '../data/sharedDataTypes';
import { MessageAttributes } from '../models/messageType';
import { SignalService } from '../protobuf';
import { DURATION } from '../session/constants';
import { createDeleter, getAttachmentsPath } from '../shared/attachments/shared_attachments';
import { ed25519Str } from '../session/utils/String';
import {
  getSQLCipherIntegrityCheck,
  openAndMigrateDatabase,
  updateSchema,
} from './migration/signalMigrations';
import { configDumpData } from './sql_calls/config_dump';
import {
  assertGlobalInstance,
  assertGlobalInstanceOrInstance,
  closeDbInstance,
  initDbInstanceWith,
  isInstanceInitialized,
} from './sqlInstance';
import { OpenGroupV2Room } from '../data/types';
import { tr } from '../localization/localeTools';
import { getFileCreationTimestampMs } from './fs_utility';
import { isDebugMode } from '../shared/env_vars';
import { DBVacuumManager } from './dbVacuumManager';
import type { FetchMessageSharedResult } from '../state/ducks/types';
import { generateBulkText } from './seeding/message_seeding';
import { getLoggedInUserConvoDuringMigration } from './migration/utils';

// eslint:disable: function-name non-literal-fs-path

const MAX_PUBKEYS_MEMBERS = 300;

function lastShutdownWasGraceful(db: Database) {
  const parsed = getItemById(SettingsKey.lastShutdownWasGraceful, db);
  if (!parsed) {
    return false;
  }
  if (isDebugMode()) {
    console.info(`lastShutdownWasGraceful: ${parsed?.value}`);
  }
  if (parsed?.value) {
    return true;
  }
  return false;
}

function setGracefulLastShutdown(db: Database, graceful: boolean) {
  if (isDebugMode()) {
    console.info(`setGracefulLastShutdown with ${graceful}`);
  }
  createOrUpdateItem({ id: SettingsKey.lastShutdownWasGraceful, value: graceful }, db);
}

/**
 * On start, we check if the last shutdown was graceful.
 * If it was, we don't run the quick check pragma.
 * If it wasn't graceful (i.e. a crash happened and the flag couldn't be reset), we run the quick check pragma.
 */
function getSQLIntegrityCheck(db: Database) {
  if (lastShutdownWasGraceful(db)) {
    console.info(`last shutdown was graceful, not running quick_check`);

    return undefined;
  }
  const start = Date.now();
  console.info(`last shutdown was not graceful, running quick_check...`);

  const checkResult = db.pragma('quick_check', { simple: true });
  console.info(`quick_check done in ${Date.now() - start}ms`);
  if (checkResult !== 'ok') {
    return checkResult;
  }

  return undefined;
}

function openAndSetUpSQLCipher(filePath: string, { key }: { key: string }) {
  return openAndMigrateDatabase(filePath, key);
}

function setSQLPassword(password: string) {
  if (!assertGlobalInstance()) {
    throw new Error('setSQLPassword: db is not initialized');
  }

  // If the password isn't hex then we need to derive a key from it
  const deriveKey = HEX_KEY.test(password);
  const value = deriveKey ? `'${password}'` : `"x'${password}'"`;
  assertGlobalInstance().pragma(`rekey = ${value}`);
}

let databaseFilePath: string | undefined;
let dbVacuumManager: DBVacuumManager | undefined;

function _initializePaths(configDir: string) {
  const dbDir = path.join(configDir, 'sql');
  fs.mkdirSync(dbDir, { recursive: true });
  console.info('Made sure db folder exists at:', dbDir);
  databaseFilePath = path.join(dbDir, 'db.sqlite');
}

function showFailedToStart() {
  const notification = new Notification({
    title: 'Session failed to start',
    body: 'Please start from terminal and open a github issue',
  });
  notification.show();
}

async function initializeSql({
  configDir,
  key,
  passwordAttempt,
}: {
  configDir: string;
  key: string;
  passwordAttempt: boolean;
}) {
  console.info('initializeSql sql node');
  if (isInstanceInitialized()) {
    throw new Error('Cannot initialize more than once!');
  }

  if (!isString(configDir)) {
    throw new Error('initialize: configDir is required!');
  }
  if (!isString(key)) {
    throw new Error('initialize: key is required!');
  }

  _initializePaths(configDir);

  let db;
  try {
    if (!databaseFilePath) {
      throw new Error('databaseFilePath is not set');
    }
    db = openAndSetUpSQLCipher(databaseFilePath, { key });
    if (!db) {
      throw new Error('db is not set');
    }
    await updateSchema(db);

    // test database

    const cipherIntegrityResult = getSQLCipherIntegrityCheck(db);
    if (cipherIntegrityResult) {
      console.log('Database cipher integrity check failed:', cipherIntegrityResult);
      throw new Error(`Cipher integrity check failed: ${cipherIntegrityResult}`);
    }
    const integrityResult = getSQLIntegrityCheck(db);
    if (integrityResult) {
      console.log('Database integrity check failed:', integrityResult);
      throw new Error(`Integrity check failed: ${integrityResult}`);
    }

    // At this point we can allow general access to the database
    initDbInstanceWith(db);
    // Now that we've did our checks, mark the DB last shutdown as being not graceful.
    // When we do exit the app gracefully, this flag will be reset to true.
    setGracefulLastShutdown(db, false);

    console.info('total message count before cleaning: ', getMessageCount());
    console.info('total conversation count before cleaning: ', getConversationCount());
    cleanUpInvalidConversationIds();
    cleanUpOldOpengroupsOnStart();
    cleanUpUnusedNodeForKeyEntriesOnStart();
    cleanUpUnreadExpiredDaRMessages();
    printDbStats();

    console.info('total message count after cleaning: ', getMessageCount());
    console.info('total conversation count after cleaning: ', getConversationCount());
    dbVacuumManager = new DBVacuumManager(db);
  } catch (error) {
    try {
      dbVacuumManager?.cleanup();
      dbVacuumManager = undefined;
    } catch (e) {
      // nothing to do
    }
    console.error('error', error);
    if (passwordAttempt) {
      throw error;
    }
    console.log('Database startup error:', error.stack);
    const button = await dialog.showMessageBox({
      buttons: [tr('errorCopyAndQuit'), tr('clearDataAll')],
      defaultId: 0,
      detail: redactAll(error.stack),
      message: tr('errorDatabase'),
      noLink: true,
      type: 'error',
    });

    if (button.response === 0) {
      clipboard.writeText(`Database startup error:\n\n${redactAll(error.stack)}`);
    } else {
      closeDbInstance();
      showFailedToStart();
    }

    app.exit(1);
    return false;
  }

  return true;
}

function removeDB(configDir: string | null = null) {
  if (isInstanceInitialized()) {
    throw new Error('removeDB: Cannot erase database when it is open!');
  }

  if (!databaseFilePath && configDir) {
    _initializePaths(configDir);
  }

  if (databaseFilePath) {
    rimrafSync(databaseFilePath);
    rimrafSync(`${databaseFilePath}-shm`);
    rimrafSync(`${databaseFilePath}-wal`);
  }
}

// Password hash
const PASS_HASH_ID = 'passHash';

function getPasswordHash() {
  const item = getItemById(PASS_HASH_ID);
  return item && item.value;
}

function savePasswordHash(hash: string) {
  if (isEmpty(hash)) {
    removePasswordHash();
    return;
  }

  const data = { id: PASS_HASH_ID, value: hash };
  createOrUpdateItem(data);
}

function removePasswordHash() {
  removeItemById(PASS_HASH_ID);
}

function getDBCreationTimestampMs(): number | null {
  if (!databaseFilePath) {
    return null;
  }
  if (process.env.DB_CREATION_TIMESTAMP_MS) {
    return Number.parseInt(process.env.DB_CREATION_TIMESTAMP_MS, 10);
  }
  return getFileCreationTimestampMs(databaseFilePath);
}

function getIdentityKeyById(id: string, instance: Database) {
  return getById(IDENTITY_KEYS_TABLE, id, instance);
}

function getGuardNodes() {
  const sql = `SELECT ed25519PubKey FROM ${GUARD_NODE_TABLE};`;
  const params: StatementParameters<object> = [];
  const nodes = analyzeQuery(assertGlobalInstance(), sql, params).all<{ ed25519PubKey: string }>();

  if (!nodes) {
    return null;
  }

  return nodes;
}

function updateGuardNodes(nodes: Array<string>) {
  assertGlobalInstance().transaction(() => {
    assertGlobalInstance().exec(`DELETE FROM ${GUARD_NODE_TABLE}`);

    nodes.map(edKey =>
      assertGlobalInstance()
        .prepare(
          `INSERT INTO ${GUARD_NODE_TABLE} (
        ed25519PubKey
      ) values ($ed25519PubKey)`
        )
        .run({
          ed25519PubKey: edKey,
        })
    );
  })();
}

function createOrUpdateItem(data: StorageItem, instance?: Database) {
  createOrUpdate(ITEMS_TABLE, data, instance);
}

function getItemById(id: string, instance?: Database) {
  return getById(ITEMS_TABLE, id, instance);
}

function getAllItems() {
  const sql = `SELECT json FROM ${ITEMS_TABLE} ORDER BY id ASC;`;
  const params: StatementParameters<object> = [];

  const rows: JSONRows = analyzeQuery(assertGlobalInstance(), sql, params).all<JSONRow>();

  return parseJsonRows(rows);
}

function removeItemById(id: string) {
  removeById(ITEMS_TABLE, id);
}

function createOrUpdate(table: string, data: StorageItem, instance?: Database) {
  const { id } = data;
  if (!id) {
    throw new Error('createOrUpdate: Provided data did not have a truthy id');
  }

  const sql = `INSERT OR REPLACE INTO ${table} (
      id,
      json
    ) values (
      $id,
      $json
    )`;
  const params = { id, json: objectToJSON(data) };
  analyzeQuery(assertGlobalInstanceOrInstance(instance), sql, params).run();
}

function getById(table: string, id: string, instance?: Database) {
  const sql = `SELECT * FROM ${table} WHERE id = $id;`;
  const params = { id };
  const row = analyzeQuery(assertGlobalInstanceOrInstance(instance), sql, params).get<JSONRow>();

  if (!row) {
    return null;
  }

  return jsonToObject(row.json);
}

function removeById(table: string, id: string) {
  if (Array.isArray(id)) {
    throw new Error('removeById unexpected array');
  }
  const sql = `DELETE FROM ${table} WHERE id = $id;`;
  const params = { id };
  analyzeQuery(assertGlobalInstance(), sql, params).run();
}

// Conversations

function getSwarmNodesForPubkey(pubkey: string) {
  const sql = `SELECT * FROM ${NODES_FOR_PUBKEY_TABLE} WHERE pubkey = $pubkey;`;
  const params = { pubkey };
  const row = analyzeQuery(assertGlobalInstance(), sql, params).get<JSONRow>();

  if (!row) {
    return [];
  }

  return jsonToObject(row.json);
}

function updateSwarmNodesForPubkey(pubkey: string, snodeEdKeys: Array<string>) {
  assertGlobalInstance()
    .prepare(
      `INSERT OR REPLACE INTO ${NODES_FOR_PUBKEY_TABLE} (
        pubkey,
        json
        ) values (
          $pubkey,
          $json
          );`
    )
    .run({
      pubkey,
      json: objectToJSON(snodeEdKeys),
    });
}

function clearOutAllSnodesNotInPool(edKeysOfSnodePool: Array<string>) {
  const allSwarms = assertGlobalInstance()
    .prepare(`SELECT * FROM ${NODES_FOR_PUBKEY_TABLE};`)
    .all<JSONRow<{ pubkey: string }>>();

  allSwarms.forEach(row => {
    try {
      const json = jsonToObject(row.json);
      if (isArray(json)) {
        const intersect = intersection(json, edKeysOfSnodePool);
        if (intersect.length !== json.length) {
          updateSwarmNodesForPubkey(row.pubkey, intersect);
          console.info(
            `clearOutAllSnodesNotInPool: updating swarm of ${ed25519Str(row.pubkey)} to `,
            intersect
          );
        }
      }
    } catch (e) {
      console.warn(
        `Failed to parse swarm while iterating in clearOutAllSnodesNotInPool for pk: ${ed25519Str(row?.pubkey)}`
      );
    }
  });
}

function getConversationCount(db?: Database) {
  const row = assertGlobalInstanceOrInstance(db)
    .prepare(`SELECT count(*) from ${CONVERSATIONS_TABLE};`)
    .get();
  if (!row) {
    throw new Error(`getConversationCount: Unable to get count of ${CONVERSATIONS_TABLE}`);
  }

  return row['count(*)'];
}

/**
 * Because the argument list can change when saving a conversation (and actually doing a lot of other stuff),
 * it is not a good idea to try to use it to update a conversation while doing migrations.
 * Because every time you'll update the saveConversation with a new argument, the migration you wrote a month ago still relies on the old way.
 * Because of that, there is no `instance` argument here, and you should not add one as this is only needed during migrations (which will break if you do it)
 */

function saveConversation(data: ConversationAttributes): SaveConversationReturn {
  const formatted = assertValidConversationAttributes(data);

  const {
    id,
    active_at,
    type,
    members,
    nickname,
    profileKey,
    left,
    expirationMode,
    expireTimer,
    isExpired03Group,
    lastMessage,
    lastMessageStatus,
    lastMessageInteractionType,
    lastMessageInteractionStatus,
    lastJoinedTimestamp,
    groupAdmins,
    avatarPointer,
    triggerNotificationsFor,
    bitsetProFeatures,
    proGenIndexHashB64,
    proExpiryTsMs,
    profileUpdatedSeconds,
    isTrustedForAttachmentDownload,
    isApproved,
    didApproveMe,
    avatarInProfile,
    fallbackAvatarInProfile,
    displayNameInProfile,
    conversationIdOrigin,
    priority,
    markedAsUnread,
    blocksSogsMsgReqsTimestamp,
  } = formatted;

  const omitted = omit(formatted);
  const keys = Object.keys(omitted);
  const columnsCommaSeparated = keys.join(', ');
  const valuesArgs = keys.map(k => `$${k}`).join(', ');

  const maxLength = 300;
  // shorten the last message as we never need more than `maxLength` chars (and it bloats the redux/ipc calls uselessly.

  const shortenedLastMessage =
    isString(lastMessage) && lastMessage.length > maxLength
      ? lastMessage.substring(0, maxLength)
      : lastMessage;

  const payload = {
    id,
    active_at,
    type,
    members: members && members.length ? arrayStrToJson(members) : '[]',
    nickname: nickname || null,
    profileKey: profileKey || null,
    left: toSqliteBoolean(left),
    expirationMode,
    // TODO: find out why expireTimer can be undefined despite the type not allowing it
    expireTimer: expireTimer ?? null,
    isExpired03Group: toSqliteBoolean(isExpired03Group),
    lastMessageStatus: lastMessageStatus ?? null,
    lastMessage: shortenedLastMessage || null,
    // TODO: find out why lastMessageInteractionType can be undefined despite the type not allowing it
    lastMessageInteractionType: lastMessageInteractionType ?? null,
    lastMessageInteractionStatus: lastMessageInteractionStatus ?? null,
    lastJoinedTimestamp,
    groupAdmins: groupAdmins && groupAdmins.length ? arrayStrToJson(groupAdmins) : '[]',
    avatarPointer: avatarPointer || null,
    bitsetProFeatures: bitsetProFeatures || null,
    proGenIndexHashB64: proGenIndexHashB64 || null,
    proExpiryTsMs: proExpiryTsMs || null,
    triggerNotificationsFor,
    profileUpdatedSeconds: profileUpdatedSeconds || null,
    isTrustedForAttachmentDownload: toSqliteBoolean(isTrustedForAttachmentDownload),
    priority,
    isApproved: toSqliteBoolean(isApproved),
    didApproveMe: toSqliteBoolean(didApproveMe),
    avatarInProfile: avatarInProfile || null,
    fallbackAvatarInProfile: fallbackAvatarInProfile || null,
    displayNameInProfile: displayNameInProfile || null,
    conversationIdOrigin: conversationIdOrigin || null,
    markedAsUnread: toSqliteBoolean(markedAsUnread),
    blocksSogsMsgReqsTimestamp,
  } satisfies SQLInsertable;

  devAssertValidSQLPayload(CONVERSATIONS_TABLE, payload);

  assertGlobalInstance()
    .prepare(
      `INSERT OR REPLACE INTO ${CONVERSATIONS_TABLE} (
	${columnsCommaSeparated}
	) values (
	   ${valuesArgs}
      )`
    )
    .run(payload);

  return fetchConvoMemoryDetails(id);
}

function fetchConvoMemoryDetails(convoId: string): SaveConversationReturn {
  const hasMentionedUsUnread = !!getFirstUnreadMessageWithMention(convoId);
  const unreadCount = getUnreadCountByConversation(convoId);
  const lastReadTimestampMessageSentTimestamp = getLastMessageReadInConversation(convoId);

  return {
    mentionedUs: hasMentionedUsUnread,
    unreadCount,
    lastReadTimestampMessage: lastReadTimestampMessageSentTimestamp,
  };
}

function removeConversation(id: string | Array<string>) {
  if (!Array.isArray(id)) {
    assertGlobalInstance().prepare(`DELETE FROM ${CONVERSATIONS_TABLE} WHERE id = $id;`).run({
      id,
    });
    return;
  }

  if (!id.length) {
    throw new Error('removeConversation: No ids to delete!');
  }

  // Our node interface doesn't seem to allow you to replace one single ? with an array
  assertGlobalInstance()
    .prepare(`DELETE FROM ${CONVERSATIONS_TABLE} WHERE id IN ( ${id.map(() => '?').join(', ')} );`)
    .run(id);
}

export function getIdentityKeys(db: Database) {
  const row = db.prepare(`SELECT * FROM ${ITEMS_TABLE} WHERE id = $id;`).get<JSONRow>({
    id: 'identityKey',
  });

  if (!row) {
    return null;
  }
  try {
    const parsedIdentityKey = jsonToObject(row.json);
    if (
      !parsedIdentityKey?.value?.pubKey ||
      !parsedIdentityKey?.value?.ed25519KeyPair?.privateKey
    ) {
      return null;
    }
    const publicKeyBase64 = parsedIdentityKey?.value?.pubKey;
    const publicKeyHex = to_hex(from_base64(publicKeyBase64, base64_variants.ORIGINAL));

    const ed25519PrivateKeyUintArray = parsedIdentityKey?.value?.ed25519KeyPair?.privateKey;

    // TODO migrate the ed25519KeyPair for all the users already logged in to a base64 representation
    const privateEd25519 = new Uint8Array(Object.values(ed25519PrivateKeyUintArray));

    if (!privateEd25519 || isEmpty(privateEd25519)) {
      return null;
    }

    return {
      publicKeyHex,
      privateEd25519,
    };
  } catch (e) {
    return null;
  }
}

function getUsBlindedInThatServerIfNeeded(
  convoId: string,
  instance?: Database
): string | undefined {
  const usNaked = getIdentityKeys(assertGlobalInstanceOrInstance(instance))?.publicKeyHex;
  if (!usNaked) {
    return undefined;
  }
  const room = getV2OpenGroupRoom(convoId, instance) as OpenGroupV2Room | null;
  if (!room || !roomHasBlindEnabled(room) || !room.serverPublicKey) {
    return usNaked;
  }

  const blinded = getItemById(KNOWN_BLINDED_KEYS_ITEM, instance);
  // this is essentially a duplicate of getUsBlindedInThatServer made at a database level (with db from the DB directly and not cached on the renderer side)
  try {
    const allBlinded = JSON.parse(blinded?.value);
    const found = allBlinded.find(
      (m: any) => m.serverPublicKey === room.serverPublicKey && m.realSessionId === usNaked
    );

    const blindedId = found?.blindedId;
    return isString(blindedId) ? blindedId : usNaked;
  } catch (e) {
    console.error('getUsBlindedInThatServerIfNeeded failed with ', e.message);
  }

  return usNaked;
}

function getConversationById(id: string, instance?: Database) {
  const row = assertGlobalInstanceOrInstance(instance)
    .prepare(`SELECT * FROM ${CONVERSATIONS_TABLE} WHERE id = $id;`)
    .get<JSONRow<any>>({
      id,
    });

  const unreadCount = getUnreadCountByConversation(id, instance) || 0;
  const mentionedUsStillUnread = !!getFirstUnreadMessageWithMention(id, instance);

  return row
    ? formatRowOfConversation(row, 'getConversationById', unreadCount, mentionedUsStillUnread)
    : null;
}

function getAllConversations() {
  const sql = `SELECT * FROM ${CONVERSATIONS_TABLE} ORDER BY id ASC;`;
  const params: StatementParameters<object> = [];

  const rows = analyzeQuery(assertGlobalInstance(), sql, params).all<
    Pick<ConversationAttributes, 'id'>
  >();

  const formatted = compact(
    (rows || []).map(m => {
      const unreadCount = getUnreadCountByConversation(m.id) || 0;
      const mentionedUsStillUnread = !!getFirstUnreadMessageWithMention(m.id);
      return formatRowOfConversation(m, 'getAllConversations', unreadCount, mentionedUsStillUnread);
    })
  );

  const invalidOnLoad = formatted.filter(m => {
    return isString(m.id) && m.id.startsWith('05') && m.id.includes(' ');
  });

  if (!isEmpty(invalidOnLoad)) {
    const idsInvalid = invalidOnLoad.map(m => m.id);
    console.info(
      'getAllConversations removing those conversations with invalid ids before load',
      idsInvalid
    );
    removeConversation(idsInvalid);
  }

  return differenceBy(formatted, invalidOnLoad, c => c.id);
}

function getPubkeysInPublicConversation(conversationId: string) {
  const conversation = getV2OpenGroupRoom(conversationId);
  if (!conversation) {
    return [];
  }

  const hasBlindOn = Boolean(
    conversation.capabilities &&
      isArray(conversation.capabilities) &&
      conversation.capabilities?.includes('blind')
  );

  const whereClause = hasBlindOn ? "AND source LIKE '15%'" : ''; // the LIKE content has to be ' and not "

  const sql = `SELECT DISTINCT source FROM ${MESSAGES_TABLE} WHERE
    conversationId = $conversationId ${whereClause}
   ORDER BY ${MessageColumns.coalesceSentAndReceivedAt} DESC LIMIT ${MAX_PUBKEYS_MEMBERS};`;
  const params = { conversationId };
  const rows = analyzeQuery(assertGlobalInstance(), sql, params).all<{ source: string }>();

  return map(rows, row => row.source);
}

function searchMessages(query: string, limit: number) {
  if (!limit) {
    throw new Error('searchMessages limit must be set');
  }

  // JSONRow<{ snippet: string }>
  const params = { query, limit };

  /**
   * This is overly complex, but on a large DB the ORDER BY is very slow.
   * To avoid having to do full order by over the join, we fetch the top 1000 results matching the query and we then sort those by timestamp.
   */
  const sqlRank = `WITH fts_results AS (
        SELECT rowid
        FROM ${MESSAGES_FTS_TABLE}
        WHERE body MATCH $query
        ORDER BY rank
        LIMIT 1000
      )
      SELECT
        ${MESSAGES_TABLE}.rowid,
        ${MESSAGES_TABLE}.json
      FROM fts_results
      INNER JOIN ${MESSAGES_TABLE} ON fts_results.rowid = ${MESSAGES_TABLE}.rowid
      ORDER BY ${MESSAGES_TABLE}.${MessageColumns.coalesceSentAndReceivedAt} DESC
      LIMIT $limit;`;

  const rowsRank = analyzeQuery(assertGlobalInstance(), sqlRank, params).all<{ rowid: number }>();

  const rowIds = rowsRank.map(row => row.rowid);
  const placeholders = rowIds.map(() => '?').join(',');

  const snippetStmt = assertGlobalInstance().prepare(
    `SELECT rowid, snippet(${MESSAGES_FTS_TABLE}, -1, '<<left>>', '<<right>>', '...', 5) as snippet
   FROM ${MESSAGES_FTS_TABLE}
   WHERE body MATCH ? AND rowid IN (${placeholders})`
  );

  const snippets = snippetStmt.all([query, ...rowIds]);
  const snippetMap = new Map(snippets.map((s: any) => [s.rowid, s.snippet]));

  return rowsRank.map((row: any) => ({
    ...jsonToObject(row.json),
    snippet: snippetMap.get(row.rowid) || '',
  }));
}

function getMessageCount() {
  const row = assertGlobalInstance().prepare(`SELECT count(*) from ${MESSAGES_TABLE};`).get();

  if (!row) {
    throw new Error(`getMessageCount: Unable to get count of ${MESSAGES_TABLE}`);
  }
  return row['count(*)'];
}

function saveMessage(data: MessageAttributes): string {
  return saveMessages([data])[0];
}

function emptySeenMessageHashesForConversation(conversationId: string) {
  if (!isString(conversationId) || isEmpty(conversationId)) {
    throw new Error('emptySeenMessageHashesForConversation: conversationId is not a string');
  }
  const sql = `DELETE FROM ${SEEN_MESSAGE_TABLE} WHERE conversationId=$conversationId;`;
  const params = { conversationId };
  analyzeQuery(assertGlobalInstance(), sql, params).run();
}

function updateLastHash(data: UpdateLastHashType) {
  const { convoId, snode, hash, expiresAt, namespace } = data;
  if (!isNumber(namespace)) {
    throw new Error('updateLastHash: namespace must be set to a number');
  }

  const sql = `INSERT OR REPLACE INTO ${LAST_HASHES_TABLE} (
      id,
      snode,
      hash,
      expiresAt,
      namespace
    ) values (
      $id,
      $snode,
      $hash,
      $expiresAt,
      $namespace
    )`;
  const params = { id: convoId, snode, hash, expiresAt, namespace };
  analyzeQuery(assertGlobalInstance(), sql, params).run();
}

function clearLastHashesForConvoId(conversationId: string) {
  if (!isString(conversationId) || isEmpty(conversationId)) {
    throw new Error('clearLastHashesForConvoId: conversationId is not a string');
  }

  const sql = `DELETE FROM ${LAST_HASHES_TABLE} WHERE id=$conversationId;`;
  const params = { conversationId };
  analyzeQuery(assertGlobalInstance(), sql, params).run();
}

function saveSeenMessageHashes(dataArray: Array<SaveSeenMessageHash>) {
  if (!Array.isArray(dataArray) || dataArray.length === 0) {
    return;
  }

  // Validate all items first (fail fast before transaction)
  for (const data of dataArray) {
    const { expiresAt, hash, conversationId } = data;
    if (!isString(conversationId)) {
      throw new Error('saveSeenMessageHash conversationId must be a string');
    }
    if (!isString(hash)) {
      throw new Error('saveSeenMessageHash hash must be a string');
    }
    if (!isNumber(expiresAt)) {
      throw new Error('saveSeenMessageHash expiresAt must be a number');
    }
  }

  try {
    const db = assertGlobalInstance();
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO ${SEEN_MESSAGE_TABLE} (
        expiresAt,
        hash,
        conversationId
      ) VALUES (
        $expiresAt,
        $hash,
        $conversationId
      )`
    );

    // Wrap in transaction for bulk insert
    const insertMany = db.transaction(() => {
      for (const item of dataArray) {
        stmt.run(item);
      }
    });

    insertMany();
  } catch (e) {
    console.error('saveSeenMessageHashes failed:', e.message);
  }
}

function cleanLastHashes() {
  const sql = `DELETE FROM ${LAST_HASHES_TABLE} WHERE expiresAt <= $now;`;
  const params = { now: Date.now() };
  analyzeQuery(assertGlobalInstance(), sql, params).run();
}

function cleanSeenMessages() {
  const sql = `DELETE FROM ${SEEN_MESSAGE_TABLE} WHERE expiresAt <= $now;`;
  const params = { now: Date.now() };
  analyzeQuery(assertGlobalInstance(), sql, params).run();
}

function saveMessages(dataArray: Array<MessageAttributes>): Array<string> {
  // console.info('saveMessages count: ', dataArray.length);
  if (!Array.isArray(dataArray) || dataArray.length === 0) {
    return [];
  }

  // Validate all items first (fail fast before transaction)
  for (const data of dataArray) {
    if (!data.id) {
      throw new Error('id is required');
    }
    if (!data.conversationId) {
      throw new Error('conversationId is required');
    }
  }

  // Prepare payloads
  const payloads = dataArray.map(data => {
    const {
      body,
      conversationId,
      expires_at,
      hasAttachments,
      hasFileAttachments,
      hasVisualMediaAttachments,
      id,
      serverId,
      serverTimestamp,
      received_at,
      sent,
      sent_at,
      source,
      type,
      unread,
      expirationType,
      expireTimer,
      expirationStartTimestamp,
      messageHash,
      errors,
      expirationTimerUpdate,
    } = data;

    // Check if this message mentions us
    const ourBlindedId = getUsBlindedInThatServerIfNeeded(conversationId);
    // Note: should we also check the quotes author here?
    const mentionsUs = body?.includes(`@${ourBlindedId}`) ?? false;

    const flags = !isEmpty(expirationTimerUpdate)
      ? SignalService.DataMessage.Flags.EXPIRATION_TIMER_UPDATE
      : 0;

    const payload = {
      id,
      json: objectToJSON(data),
      serverId: serverId ?? null,
      serverTimestamp: serverTimestamp ?? null,
      body: body ?? null,
      conversationId,
      expirationStartTimestamp: expirationStartTimestamp ?? null,
      expires_at: expires_at ?? null,
      expirationType: expirationType ?? null,
      expireTimer,
      hasAttachments: isUndefined(hasAttachments) ? null : hasAttachments,
      hasFileAttachments: isUndefined(hasFileAttachments) ? null : hasFileAttachments,
      hasVisualMediaAttachments: isUndefined(hasVisualMediaAttachments)
        ? null
        : hasVisualMediaAttachments,
      received_at: received_at ?? null,
      sent: toSqliteBoolean(sent),
      sent_at: sent_at ?? null,
      source,
      type: type || '',
      unread,
      flags, // Note: we need to keep storing this as there are some indexed queries that rely on it (cleanUpExpirationTimerUpdateHistory)
      messageHash: messageHash ?? null,
      errors: errors ?? null,

      mentionsUs: toSqliteBoolean(mentionsUs),
    } satisfies SQLInsertable;
    devAssertValidSQLPayload(MESSAGES_TABLE, payload);
    return payload;
  });

  const db = assertGlobalInstance();
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO ${MESSAGES_TABLE} (
      id,
      json,
      serverId,
      serverTimestamp,
      body,
      conversationId,
      expirationStartTimestamp,
      expires_at,
      expirationType,
      expireTimer,
      hasAttachments,
      hasFileAttachments,
      hasVisualMediaAttachments,
      received_at,
      sent,
      sent_at,
      source,
      type,
      unread,
      flags,
      messageHash,
      errors,
      ${MessageColumns.mentionsUs}
    ) VALUES (
      $id,
      $json,
      $serverId,
      $serverTimestamp,
      $body,
      $conversationId,
      $expirationStartTimestamp,
      $expires_at,
      $expirationType,
      $expireTimer,
      $hasAttachments,
      $hasFileAttachments,
      $hasVisualMediaAttachments,
      $received_at,
      $sent,
      $sent_at,
      $source,
      $type,
      $unread,
      $flags,
      $messageHash,
      $errors,
      $mentionsUs
    )`
  );

  // Wrap in transaction for bulk insert
  const insertMany = db.transaction(() => {
    for (const item of payloads) {
      stmt.run(item);
    }
  });

  insertMany();

  return payloads.map(p => p.id);
}

function removeMessage(id: string, instance?: Database) {
  if (!isString(id)) {
    throw new Error('removeMessage: only takes single message to delete!');
  }

  assertGlobalInstanceOrInstance(instance)
    .prepare(`DELETE FROM ${MESSAGES_TABLE} WHERE id = $id;`)
    .run({ id });
}

function removeMessagesByIds(ids: Array<string>, instance?: Database) {
  if (!Array.isArray(ids)) {
    throw new Error('removeMessagesByIds only allowed an array of strings');
  }

  if (!ids.length) {
    throw new Error('removeMessagesByIds: No ids to delete!');
  }
  const start = Date.now();

  assertGlobalInstanceOrInstance(instance)
    .prepare(`DELETE FROM ${MESSAGES_TABLE} WHERE id IN ( ${ids.map(() => '?').join(', ')} );`)
    .run(ids);
  console.log(`removeMessagesByIds of length ${ids.length} took ${Date.now() - start}ms`);
}

function removeAllMessagesInConversationSentBefore(
  {
    deleteBeforeSeconds,
    conversationId,
  }: { deleteBeforeSeconds: number; conversationId: GroupPubkeyType },
  instance?: Database
) {
  const sqlSelect = `SELECT id FROM ${MESSAGES_TABLE} WHERE conversationId = $conversationId AND sent_at <= $beforeMs;`;
  const params = { conversationId, beforeMs: deleteBeforeSeconds * 1000 };
  const msgIds = analyzeQuery(assertGlobalInstanceOrInstance(instance), sqlSelect, params).all<{
    id: string;
  }>();

  const sqlDelete = `DELETE FROM ${MESSAGES_TABLE} WHERE conversationId = $conversationId AND sent_at <= $beforeMs;`;
  analyzeQuery(assertGlobalInstanceOrInstance(instance), sqlDelete, params).run();

  console.info('removeAllMessagesInConversationSentBefore deleted msgIds:', JSON.stringify(msgIds));
  return msgIds.map(m => m.id);
}

async function getAllMessagesWithAttachmentsInConversationSentBefore(
  {
    deleteAttachBeforeSeconds,
    conversationId,
  }: { deleteAttachBeforeSeconds: number; conversationId: GroupPubkeyType },
  instance?: Database
) {
  const rows = assertGlobalInstanceOrInstance(instance)
    .prepare(
      `SELECT json FROM ${MESSAGES_TABLE} WHERE conversationId = $conversationId AND sent_at <= $beforeMs;`
    )
    .all<JSONRow>({ conversationId, beforeMs: deleteAttachBeforeSeconds * 1000 });
  const messages = parseJsonRows(rows);
  const messagesWithAttachments = messages.filter(m => {
    return hasUserVisibleAttachments(m);
  });
  return messagesWithAttachments;
}

function removeAllMessagesInConversation(conversationId: string, instance?: Database) {
  if (!conversationId) {
    return;
  }
  const inst = assertGlobalInstanceOrInstance(instance);

  inst
    .prepare(`DELETE FROM ${MESSAGES_TABLE} WHERE conversationId = $conversationId`)
    .run({ conversationId });
}

function findAllMessageFromSendersInConversation(
  { groupPk, toRemove, signatureTimestamp }: FindAllMessageFromSendersInConversationTypeArgs,
  instance?: Database
) {
  if (!groupPk || !toRemove.length) {
    return { messageHashes: [] };
  }
  const rows = assertGlobalInstanceOrInstance(instance)
    .prepare(
      `SELECT json FROM ${MESSAGES_TABLE} WHERE conversationId = ? AND sent_at <= ? AND source IN ( ${toRemove.map(() => '?').join(', ')} )`
    )
    .all<JSONRow>([groupPk, signatureTimestamp, ...toRemove]);

  if (!rows || isEmpty(rows)) {
    return [];
  }
  return parseJsonRows(rows);
}

function findAllMessageHashesInConversation(
  { groupPk, messageHashes, signatureTimestamp }: FindAllMessageHashesInConversationTypeArgs,
  instance?: Database
) {
  if (!groupPk || !messageHashes.length) {
    return [];
  }
  const rows = compact(
    assertGlobalInstanceOrInstance(instance)
      .prepare(
        `SELECT json FROM ${MESSAGES_TABLE} WHERE conversationId = ? AND sent_at <= ? AND messageHash IN ( ${messageHashes.map(() => '?').join(', ')} )`
      )
      .all<JSONRow>([groupPk, signatureTimestamp, ...messageHashes])
  );

  if (!rows || isEmpty(rows)) {
    return [];
  }
  return parseJsonRows(rows);
}

function findAllMessageHashesInConversationMatchingAuthor(
  {
    author,
    groupPk,
    messageHashes,
    signatureTimestamp,
  }: FindAllMessageHashesInConversationMatchingAuthorTypeArgs,
  instance?: Database
) {
  if (!groupPk || !author || !messageHashes.length) {
    return { msgHashesDeleted: [], msgIdsDeleted: [] };
  }
  const rows = assertGlobalInstanceOrInstance(instance)
    .prepare(
      `SELECT json FROM ${MESSAGES_TABLE} WHERE conversationId = ? AND source = ? AND sent_at <= ? AND messageHash IN ( ${messageHashes.map(() => '?').join(', ')} );`
    )
    .all<JSONRow>([groupPk, author, signatureTimestamp, ...messageHashes]);

  if (!rows || isEmpty(rows)) {
    return null;
  }
  return parseJsonRows(rows);
}

function fetchAllGroupUpdateFailedMessage(groupPk: GroupPubkeyType, instance?: Database) {
  if (!groupPk) {
    return [];
  }
  const rows = assertGlobalInstanceOrInstance(instance)
    .prepare(
      `SELECT json FROM ${MESSAGES_TABLE} WHERE conversationId = ? AND (JSON_EXTRACT(json, '$.group_update') IS NOT NULL OR JSON_EXTRACT(json, '$.expirationTimerUpdate') IS NOT NULL) AND errors IS NOT NULL;`
    )
    .all<JSONRow>([groupPk]);

  if (!rows || isEmpty(rows)) {
    return [];
  }
  const objs = parseJsonRows(rows).filter(m => {
    return !isEmpty(m);
  });

  return objs;
}

function cleanUpExpirationTimerUpdateHistory(
  conversationId: string,
  isPrivate: boolean,
  db?: Database
) {
  if (isEmpty(conversationId)) {
    return [];
  }
  const rows = assertGlobalInstanceOrInstance(db)
    .prepare(
      `SELECT id, source FROM ${MESSAGES_TABLE} WHERE conversationId = $conversationId and flags = ${SignalService.DataMessage.Flags.EXPIRATION_TIMER_UPDATE} ${orderByClauseDESC}`
    )
    .all<SQLMessageAttributes>({ conversationId });

  // we keep at most one, so if we have <= 1, we can just return that nothing was removed.
  if (rows.length <= 1) {
    return [];
  }

  // we want to allow 1 message at most per sender for private chats only
  const bySender: Record<string, Array<string>> = {};
  // we keep the order, so the first message of each array should be kept, the other ones discarded
  rows.forEach(r => {
    const groupedById = isPrivate ? r.source : conversationId;
    if (!bySender[groupedById]) {
      bySender[groupedById] = [];
    }
    bySender[groupedById].push(r.id);
  });

  const allMsgIdsRemoved: Array<string> = [];
  Object.keys(bySender).forEach(k => {
    const idsToRemove = bySender[k].slice(1); // we keep the first one
    if (isEmpty(idsToRemove)) {
      return;
    }
    removeMessagesByIds(idsToRemove, db);
    allMsgIdsRemoved.push(...idsToRemove);
  });

  return allMsgIdsRemoved;
}

function getMessageIdsFromServerIds(serverIds: Array<string | number>, conversationId: string) {
  if (!Array.isArray(serverIds)) {
    return [];
  }

  // Sanitize the input as we're going to use it directly in the query
  const validServerIds = serverIds.map(Number).filter(n => !Number.isNaN(n));

  /*
    Sqlite3 doesn't have a good way to have `IN` query with another query.
    See: https://github.com/mapbox/node-sqlite3/issues/762.

    So we have to use string templates to insert the values.
  */
  const rows = assertGlobalInstance()
    .prepare(
      `SELECT id FROM ${MESSAGES_TABLE} WHERE
    serverId IN (${validServerIds.join(',')}) AND
    conversationId = $conversationId;`
    )
    .all({
      conversationId,
    });
  return rows.map(row => row.id);
}

function getMessageById(id: string) {
  const row = assertGlobalInstance()
    .prepare(`SELECT * FROM ${MESSAGES_TABLE} WHERE id = $id;`)
    .get<JSONRow>({
      id,
    });

  if (!row) {
    return null;
  }

  return jsonToObject(row.json);
}

function getMessagesById(ids: Array<string>) {
  if (!isArray(ids)) {
    throw new Error('getMessagesById expect an array of strings');
  }
  const rows = assertGlobalInstance()
    .prepare(`SELECT json FROM ${MESSAGES_TABLE} WHERE id IN ( ${ids.map(() => '?').join(', ')} );`)
    .all<JSONRow>(ids);
  if (!rows || isEmpty(rows)) {
    return null;
  }
  return parseJsonRows(rows);
}

// serverIds are not unique so we need the conversationId
function getMessageByServerId(conversationId: string, serverId: number) {
  const row = assertGlobalInstance()
    .prepare(
      `SELECT * FROM ${MESSAGES_TABLE} WHERE conversationId = $conversationId AND serverId = $serverId;`
    )
    .get<JSONRow>({
      conversationId,
      serverId,
    });

  if (!row) {
    return null;
  }

  return jsonToObject(row.json);
}

function getMessagesCountBySender({ source }: { source: string }) {
  if (!source) {
    throw new Error('source must be set');
  }
  const count = analyzeQuery(
    assertGlobalInstance(),
    `SELECT count(*) FROM ${MESSAGES_TABLE} WHERE source = $source;`,
    { source }
  ).get<CountRow>();

  if (!count) {
    return 0;
  }

  return count['count(*)'] || 0;
}

function getMessagesBySenderAndSentAt(
  propsList: Array<{
    source: string;
    timestamp: number;
  }>
) {
  const db = assertGlobalInstance();
  const rows = [];

  // eslint-disable-next-line no-restricted-syntax
  for (const msgProps of propsList) {
    const { source, timestamp } = msgProps;

    const _rows = db
      .prepare(
        `SELECT json FROM ${MESSAGES_TABLE} WHERE
      source = $source AND
      sent_at = $timestamp;`
      )
      .all<JSONRow>({
        source,
        timestamp,
      });
    rows.push(..._rows);
  }

  return uniq(parseJsonRows(rows));
}

function getMessagesByConvoIdAndSentAt(
  propsList: Array<{
    convoId: string;
    sentAt: number;
  }>
) {
  const db = assertGlobalInstance();
  const rows = [];

  // eslint-disable-next-line no-restricted-syntax
  for (const msgProps of propsList) {
    const { convoId, sentAt } = msgProps;

    const _rows = db
      .prepare(
        `SELECT json FROM ${MESSAGES_TABLE} WHERE
      conversationId = $convoId AND
      sent_at = $sentAt;`
      )
      .all<JSONRow>({
        convoId,
        sentAt,
      });
    rows.push(..._rows);
  }

  return uniq(map(rows, row => jsonToObject(row.json)));
}

function filterAlreadyFetchedOpengroupMessage(
  msgDetails: MsgDuplicateSearchOpenGroup
): MsgDuplicateSearchOpenGroup {
  if (msgDetails.length === 0) {
    return [];
  }

  // Build a single query with all sender/timestamp pairs
  const valuePlaceholders = msgDetails
    .map((_, i) => `($sender${i}, $serverTimestamp${i})`)
    .join(', ');

  const sql = `SELECT source, serverTimestamp
    FROM ${MESSAGES_TABLE}
    WHERE (source, serverTimestamp) IN (${valuePlaceholders})`;

  // Build params object
  const params: Record<string, string | number> = {};
  msgDetails.forEach((msg, i) => {
    params[`sender${i}`] = msg.sender;
    params[`serverTimestamp${i}`] = msg.serverTimestamp;
  });

  const rows = analyzeQuery(assertGlobalInstance(), sql, params).all<{
    source: string;
    serverTimestamp: number;
  }>();

  const existingMessages = new Set(rows.map(row => `${row.source}:${row.serverTimestamp}`));

  // Filter out messages that already exist
  return msgDetails.filter(msg => {
    const key = `${msg.sender}:${msg.serverTimestamp}`;
    if (existingMessages.has(key)) {
      console.info(
        `filtering out already received sogs message from ${msg.sender} at ${msg.serverTimestamp}`
      );
      return false;
    }
    return true;
  });
}

function getUnreadByConversation(conversationId: string, sentBeforeTimestamp: number) {
  const sql = `SELECT * FROM ${MESSAGES_TABLE} WHERE
      unread = $unread AND
      conversationId = $conversationId AND
      ${MessageColumns.coalesceForSentOnly} <= $sentBeforeTimestamp
     ${orderByClauseASC};`;
  const params = { unread: toSqliteBoolean(true), conversationId, sentBeforeTimestamp };
  const rows = analyzeQuery(assertGlobalInstance(), sql, params).all<JSONRow>();

  return parseJsonRows(rows);
}

function getUnreadDisappearingByConversation(conversationId: string, sentBeforeTimestamp: number) {
  const sql = `SELECT * FROM ${MESSAGES_TABLE} WHERE
      unread = $unread AND expireTimer > 0 AND
      conversationId = $conversationId AND
      ${MessageColumns.coalesceForSentOnly} <= $sentBeforeTimestamp
     ${orderByClauseASC};`;
  const params = { unread: toSqliteBoolean(true), conversationId, sentBeforeTimestamp };
  const rows = analyzeQuery(assertGlobalInstance(), sql, params).all<JSONRow>();

  return parseJsonRows(rows);
}

/**
 * Warning: This does not start expiration timer
 */
function markAllAsReadByConversationNoExpiration(
  conversationId: string,
  returnMessagesUpdated: boolean
): Array<number> {
  let toReturn: Array<number> = [];
  if (returnMessagesUpdated) {
    const messagesUnreadBefore = assertGlobalInstance()
      .prepare(
        `SELECT json FROM ${MESSAGES_TABLE} WHERE
  unread = $unread AND
  conversationId = $conversationId;`
      )
      .all<JSONRow>({
        unread: toSqliteBoolean(true),
        conversationId,
      });
    toReturn = compact(messagesUnreadBefore.map(row => jsonToObject(row.json).sent_at));
  }

  assertGlobalInstance()
    .prepare(
      `UPDATE ${MESSAGES_TABLE} SET
      unread = 0, json = json_set(json, '$.unread', 0)
      WHERE unread = $unread AND
      conversationId = $conversationId;`
    )
    .run({
      unread: toSqliteBoolean(true),
      conversationId,
    });

  return toReturn;
}

function getUnreadCountByConversation(conversationId: string, instance?: Database): number {
  const row = analyzeQuery(
    assertGlobalInstanceOrInstance(instance),
    `SELECT count(*) FROM ${MESSAGES_TABLE} WHERE unread = $unread AND conversationId = $conversationId;`,
    {
      unread: toSqliteBoolean(true),
      conversationId,
    }
  ).get<CountRow>();

  if (!row) {
    throw new Error(`Unable to get unread count of ${conversationId}`);
  }

  return row['count(*)'];
}

function getMessageCountByType(conversationId: string, type = '%') {
  const sql = `SELECT count(*) from ${MESSAGES_TABLE}
      WHERE conversationId = $conversationId
      AND type = $type;`;
  const params = { conversationId, type };
  const row = analyzeQuery(assertGlobalInstance(), sql, params).get<CountRow>();

  if (!row) {
    throw new Error(
      `getIncomingMessagesCountByConversation: Unable to get incoming messages count of ${conversationId}`
    );
  }

  return row['count(*)'];
}

// Note: Sorting here is necessary for getting the last message (with limit 1)
// be sure to update the sorting order to sort messages on redux too (sortMessages)
const orderByClauseDESC = `ORDER BY ${MessageColumns.coalesceSentAndReceivedAt} DESC`;
const orderByClauseASC = `ORDER BY ${MessageColumns.coalesceSentAndReceivedAt} ASC`;

function getMessagesByConversation(
  conversationId: string,
  { messageId = null, returnQuotes = false } = {}
): FetchMessageSharedResult & {
  messages: Array<Record<string, any>>;
  quotedMessages: Array<Record<string, any>> | null;
} {
  const absLimit = 30;
  // If messageId is given it means we are opening the conversation to that specific messageId,
  // or that we just scrolled to it by a quote click and needs to load around it.
  // If messageId is null, it means we are just opening the convo to the last unread message, or at the bottom
  const firstUnreadMessageId = getFirstUnreadMessageIdInConversation(conversationId);
  const oldestMessageId = getOldestMessageIdInConversation(conversationId);
  const mostRecentMessageId = getLastMessageIdInConversation(conversationId);

  const numberOfMessagesInConvo = getMessagesCountByConversation(conversationId);
  const floorLoadAllMessagesInConvo = 70;

  let messages: Array<Record<string, any>> = [];
  let quotedMessages: Array<Record<string, any>> = [];

  const messageIdToGoTo = messageId || firstUnreadMessageId;

  if (messageIdToGoTo) {
    const messageFound = getMessageById(messageIdToGoTo);

    if (messageFound && messageFound.conversationId === conversationId) {
      const start = Date.now();
      const msgTimestamp =
        messageFound.serverTimestamp || messageFound.sent_at || messageFound.received_at;

      const commonArgs = {
        conversationId,
        msgTimestamp,
        limit:
          numberOfMessagesInConvo < floorLoadAllMessagesInConvo
            ? floorLoadAllMessagesInConvo
            : absLimit,
      };

      const sqlBefore = `SELECT json
            FROM ${MESSAGES_TABLE} WHERE conversationId = $conversationId AND ${MessageColumns.coalesceSentAndReceivedAt} <= $msgTimestamp
            ${orderByClauseDESC}
            LIMIT $limit`;
      const sqlAfter = `SELECT json
            FROM ${MESSAGES_TABLE} WHERE conversationId = $conversationId AND ${MessageColumns.coalesceSentAndReceivedAt} > $msgTimestamp
            ${orderByClauseASC}
            LIMIT $limit`;

      const messagesBefore = analyzeQuery(
        assertGlobalInstance(),
        sqlBefore,
        commonArgs
      ).all<JSONRow>();

      const messagesAfter = analyzeQuery(
        assertGlobalInstance(),
        sqlAfter,
        commonArgs
      ).all<JSONRow>();

      console.info(`getMessagesByConversation around took ${Date.now() - start}ms `);

      messagesBefore.reverse();

      // sorting is made in redux already when rendered, but some things are made outside of redux, so let's make sure the order is right
      const sorted = [...messagesBefore, ...messagesAfter];

      messages = map(sorted, row => jsonToObject(row.json));
    } else {
      console.info(
        `getMessagesByConversation: Could not find messageId ${messageId} in db with conversationId: ${conversationId}. Just fetching the convo as usual. messageFound:`,
        messageFound
      );
    }
  }

  if (!messages.length) {
    const limit =
      numberOfMessagesInConvo < floorLoadAllMessagesInConvo
        ? floorLoadAllMessagesInConvo
        : absLimit * 2;
    const sql = `SELECT json FROM ${MESSAGES_TABLE} WHERE
      conversationId = $conversationId
      ${orderByClauseDESC}
    LIMIT $limit;`;

    const params = {
      conversationId,
      limit,
    };

    const rows = analyzeQuery(assertGlobalInstance(), sql, params).all<JSONRow>();

    messages = parseJsonRows(rows);
  }

  if (returnQuotes) {
    const quotes = compact(
      uniq(
        messages
          .filter(message => message.quote)
          .map(message => message.quote)
          .filter(m => {
            if (
              m.author &&
              isString(m.author) &&
              ((isNumber(m.timestamp) && isFinite(m.timestamp)) || isString(m.timestamp))
            ) {
              return { ...m, timestamp: toNumber(m.timestamp) };
            }
            return null;
          })
      )
    );

    quotedMessages = getMessagesByConvoIdAndSentAt(
      quotes.map(m => ({ convoId: conversationId, sentAt: m.timestamp }))
    );
  }

  return {
    messages,
    quotedMessages,
    firstUnreadMessageId: firstUnreadMessageId ?? null,
    mostRecentMessageId,
    oldestMessageId,
  };
}

function getLastMessagesByConversation(conversationId: string, limit: number) {
  if (!isNumber(limit)) {
    throw new Error('limit must be a number');
  }

  const sql = `SELECT json FROM ${MESSAGES_TABLE} WHERE
      conversationId = $conversationId
      ${orderByClauseDESC}
    LIMIT $limit;`;
  const params = { conversationId, limit };
  const rows = analyzeQuery(assertGlobalInstance(), sql, params).all<JSONRow>();

  return parseJsonRows(rows);
}

function getLastMessageIdInConversation(conversationId: string): string | null {
  const sql = `SELECT id FROM ${MESSAGES_TABLE} WHERE
      conversationId = $conversationId
      ${orderByClauseDESC}
    LIMIT $limit;`;
  const params = { conversationId, limit: 1 };
  const row = analyzeQuery(assertGlobalInstance(), sql, params).get<
    Pick<MessageAttributes, 'id'>
  >();

  return row?.id ?? null;
}

/**
 * This is the oldest message so we cannot reuse getLastMessagesByConversation
 */
function getOldestMessageInConversation(conversationId: string) {
  const sql = `SELECT json FROM ${MESSAGES_TABLE} WHERE
      conversationId = $conversationId
      ${orderByClauseASC}
    LIMIT $limit;`;
  const params = { conversationId, limit: 1 };
  const rows = analyzeQuery(assertGlobalInstance(), sql, params).all<JSONRow>();

  return parseJsonRows(rows);
}

function getOldestMessageIdInConversation(conversationId: string): string | null {
  const sql = `SELECT id FROM ${MESSAGES_TABLE} WHERE
      conversationId = $conversationId
      ${orderByClauseASC}
    LIMIT $limit;`;
  const params = { conversationId, limit: 1 };
  const row = analyzeQuery(assertGlobalInstance(), sql, params).get<
    Pick<MessageAttributes, 'id'>
  >();

  return row?.id ?? null;
}

function hasConversationOutgoingMessage(conversationId: string) {
  const sql = `SELECT count(*)  FROM ${MESSAGES_TABLE} WHERE
      conversationId = $conversationId AND
      type IS 'outgoing';`;
  const params = { conversationId };
  const row = analyzeQuery(assertGlobalInstance(), sql, params).get<CountRow>();

  if (!row) {
    throw new Error('hasConversationOutgoingMessage: Unable to get count');
  }

  return Boolean(row['count(*)']);
}

function getFirstUnreadMessageIdInConversation(conversationId: string): undefined | string {
  const sql = `SELECT id FROM ${MESSAGES_TABLE} WHERE
      conversationId = $conversationId AND
      unread = $unread
      ORDER BY ${MessageColumns.coalesceSentAndReceivedAt} ASC
    LIMIT 1;`;
  const params = { conversationId, unread: toSqliteBoolean(true) };
  const rows = analyzeQuery(assertGlobalInstance(), sql, params).all<
    Pick<SQLMessageAttributes, 'id'>
  >();

  if (rows.length === 0) {
    return undefined;
  }
  return rows[0].id;
}

/**
 * Returns the last read message timestamp in the specific conversation (the columns `serverTimestamp` || `sent_at`)
 */
function getLastMessageReadInConversation(conversationId: string): number | null {
  const sql = `SELECT MAX(${MessageColumns.coalesceForSentOnly}) AS max_sent_at
       FROM ${MESSAGES_TABLE}
       WHERE conversationId = $conversationId
         AND unread = $unread;`;
  const params = {
    conversationId,
    unread: toSqliteBoolean(false), // we want to find the message read with the higher sent_at timestamp
  };
  const rows = analyzeQuery(assertGlobalInstance(), sql, params).get<{
    max_sent_at?: SQLMessageAttributes['sent_at'];
  }>();

  return rows?.max_sent_at || null;
}

function getFirstUnreadMessageWithMention(
  conversationId: string,
  instance?: Database
): string | undefined {
  const ourPkInThatConversation = getUsBlindedInThatServerIfNeeded(conversationId, instance);

  if (!ourPkInThatConversation || !ourPkInThatConversation.length) {
    throw new Error('getFirstUnreadMessageWithMention needs our pubkey but nothing was given');
  }

  const sql = `SELECT ${MESSAGES_TABLE}.id
     FROM ${MESSAGES_TABLE} INDEXED BY messages_mentionsUs_index -- this has to be forced for this query to be fast on a convo with many messages
     WHERE ${MESSAGES_TABLE}.conversationId = $conversationId
       AND ${MESSAGES_TABLE}.unread = $unread
       AND ${MESSAGES_TABLE}.${MessageColumns.mentionsUs} = $mentionsUs
     ORDER BY ${MESSAGES_TABLE}.${MessageColumns.coalesceSentAndReceivedAt} ASC
     LIMIT 1;`;
  const params = {
    conversationId,
    unread: toSqliteBoolean(true),
    mentionsUs: toSqliteBoolean(true),
  };
  const row = analyzeQuery(assertGlobalInstanceOrInstance(instance), sql, params).get<
    Pick<SQLMessageAttributes, 'id'>
  >();

  if (!row) {
    return undefined;
  }
  return row.id;
}

function getMessagesBySentAt(sentAt: number) {
  const sql = `SELECT json FROM ${MESSAGES_TABLE}
     WHERE sent_at = $sent_at
     ORDER BY ${MessageColumns.coalesceSentAndReceivedAt} DESC;`;
  const params = {
    sent_at: sentAt,
  };
  const rows = analyzeQuery(assertGlobalInstance(), sql, params).all<JSONRow>();

  return parseJsonRows(rows);
}

function getLastHashBySnode(convoId: string, snode: string, namespace: number) {
  if (!isNumber(namespace)) {
    throw new Error('getLastHashBySnode: namespace must be set to a number');
  }
  const row = assertGlobalInstance()
    .prepare(
      `SELECT * FROM ${LAST_HASHES_TABLE} WHERE snode = $snode AND id = $id AND namespace = $namespace;`
    )
    .get({
      snode,
      id: convoId,
      namespace,
    });

  if (!row) {
    return null;
  }

  return row.hash;
}

function getSeenMessagesByHashList(hashes: Array<string>): Array<string> {
  if (hashes.some(h => !h)) {
    const err = 'getSeenMessagesByHashList was given an invalid hash';
    window.log.error(err);
    throw new Error(err);
  }
  const fromSeenTableRows = assertGlobalInstance()
    .prepare(
      `SELECT * FROM ${SEEN_MESSAGE_TABLE} WHERE hash IN ( ${hashes.map(() => '?').join(', ')} );`
    )
    .all<SQLSeenMessageAttributes>(hashes);

  const fromMessagesTableRows = compact(
    assertGlobalInstance()
      .prepare(
        `SELECT messageHash FROM ${MESSAGES_TABLE} WHERE messageHash IN ( ${hashes.map(() => '?').join(', ')} )`
      )
      .all<Pick<SQLMessageAttributes, 'messageHash'>>(hashes)
  );

  // NOTE: because we check for valid hashes at the input of the function we can cast all result hashes as strings
  const hashesFromSeen = map(fromSeenTableRows, row => row.hash as string);
  const hashesFromMessages = map(fromMessagesTableRows, row => row.messageHash as string);

  return uniq(hashesFromSeen.concat(hashesFromMessages));
}

function getExpiredMessages() {
  const now = Date.now();
  const sql = `SELECT json FROM ${MESSAGES_TABLE} WHERE
      expires_at IS NOT NULL AND
      expires_at <= $expires_at
     ORDER BY expires_at ASC;`;
  const params = {
    expires_at: now,
  };
  const rows = analyzeQuery(assertGlobalInstance(), sql, params).all<JSONRow>();

  return parseJsonRows(rows);
}

function cleanUpUnreadExpiredDaRMessages() {
  // we cannot rely on network offset here, so we need to trust the user clock
  const t14daysEarlier = Date.now() - 14 * DURATION.DAYS;
  const start = Date.now();

  const sql = `DELETE FROM ${MESSAGES_TABLE} WHERE
      expirationType = 'deleteAfterRead' AND
      unread = $unread AND
      sent_at <= $t14daysEarlier;`;
  const params = {
    unread: toSqliteBoolean(true),
    t14daysEarlier,
  };
  const deleted = analyzeQuery(assertGlobalInstance(), sql, params).run();

  console.info(
    `cleanUpUnreadExpiredDaRMessages: deleted ${
      deleted.changes
    } message(s) which were DaR and sent before ${t14daysEarlier} in ${Date.now() - start}ms`
  );
}

/**
 * Clean up invalid conversation ids.
 * Even though the `ID` in the `CONVERSATIONS_TABLE` is defined in the sqlite3 schema as being a string primary key,
 * this does not enforce NOT NULL in sqlite3. TODO: consider a database migration to fix this long-term
 */
function cleanUpInvalidConversationIds() {
  const sql = `DELETE FROM ${CONVERSATIONS_TABLE} WHERE id = '' OR id IS NULL OR typeof(id) != 'text';`;
  const params: StatementParameters<object> = [];

  const deleteResult = analyzeQuery(assertGlobalInstance(), sql, params).run();

  console.info(`cleanUpInvalidConversationIds removed ${deleteResult.changes} rows`);
}

function getOutgoingWithoutExpiresAt() {
  const sql = `SELECT json FROM ${MESSAGES_TABLE}
    WHERE
      expireTimer > 0 AND
      expires_at IS NULL AND
      type IS 'outgoing'
    ORDER BY expires_at ASC;`;
  const params: StatementParameters<object> = [];

  const rows = analyzeQuery(assertGlobalInstance(), sql, params).all<JSONRow>();

  return parseJsonRows(rows);
}

function getNextExpiringMessage() {
  const sql = `SELECT json FROM ${MESSAGES_TABLE}
    WHERE expires_at > 0
    ORDER BY expires_at ASC

    LIMIT 1;`;
  const params: StatementParameters<object> = [];

  const rows = analyzeQuery(assertGlobalInstance(), sql, params).all<JSONRow>();

  return parseJsonRows(rows);
}

function getNextAttachmentDownloadJobs(limit: number) {
  const timestamp = Date.now();

  const sql = `SELECT json FROM ${ATTACHMENT_DOWNLOADS_TABLE}
    WHERE pending = 0 AND timestamp < $timestamp
    ORDER BY timestamp DESC
    LIMIT $limit;`;
  const params = {
    limit,
    timestamp,
  };
  const rows = analyzeQuery(assertGlobalInstance(), sql, params).all<JSONRow>();

  return parseJsonRows(rows);
}

function saveAttachmentDownloadJob(job: any) {
  const { id, pending, timestamp } = job;
  if (!id) {
    throw new Error('saveAttachmentDownloadJob: Provided job did not have a truthy id');
  }

  assertGlobalInstance()
    .prepare(
      `INSERT OR REPLACE INTO ${ATTACHMENT_DOWNLOADS_TABLE} (
      id,
      pending,
      timestamp,
      json
    ) values (
      $id,
      $pending,
      $timestamp,
      $json
    )`
    )
    .run({
      id,
      pending,
      timestamp,
      json: objectToJSON(job),
    });
}

function setAttachmentDownloadJobPending(id: string, pending: 1 | 0) {
  assertGlobalInstance()
    .prepare(`UPDATE ${ATTACHMENT_DOWNLOADS_TABLE} SET pending = $pending WHERE id = $id;`)
    .run({
      id,
      pending,
    });
}

function resetAttachmentDownloadPending() {
  const params: StatementParameters<object> = [];

  const sql = `UPDATE ${ATTACHMENT_DOWNLOADS_TABLE} SET pending = 0 WHERE pending != 0;;`;
  analyzeQuery(assertGlobalInstance(), sql, params).run();
}

function removeAttachmentDownloadJob(id: string) {
  removeById(ATTACHMENT_DOWNLOADS_TABLE, id);
}

function removeAllAttachmentDownloadJobs() {
  assertGlobalInstance().exec(`DELETE FROM ${ATTACHMENT_DOWNLOADS_TABLE};`);
}

// All data in database
function removeAll() {
  assertGlobalInstance().exec(`
    DELETE FROM ${IDENTITY_KEYS_TABLE};
    DELETE FROM ${ITEMS_TABLE};
    DELETE FROM ${LAST_HASHES_TABLE};
    DELETE FROM ${NODES_FOR_PUBKEY_TABLE};
    DELETE FROM ${SEEN_MESSAGE_TABLE};
    DELETE FROM ${CONVERSATIONS_TABLE};
    DELETE FROM ${MESSAGES_TABLE};
    DELETE FROM ${ATTACHMENT_DOWNLOADS_TABLE};
    DELETE FROM ${MESSAGES_FTS_TABLE};
    DELETE FROM ${CONFIG_DUMP_TABLE};
`);
}

function removeAllConversations() {
  assertGlobalInstance().prepare(`DELETE FROM ${CONVERSATIONS_TABLE};`).run();
}

function getMessagesWithVisualMediaAttachments(conversationId: string, limit: number) {
  const rows = assertGlobalInstance()
    .prepare(
      `SELECT json FROM ${MESSAGES_TABLE} WHERE
      conversationId = $conversationId AND
      hasVisualMediaAttachments = 1
     ORDER BY ${MessageColumns.coalesceSentAndReceivedAt} DESC
     LIMIT $limit;`
    )
    .all<JSONRow>({
      conversationId,
      limit,
    });

  return parseJsonRows(rows);
}

function getMessagesWithFileAttachments(conversationId: string, limit: number) {
  const rows = assertGlobalInstance()
    .prepare(
      `SELECT json FROM ${MESSAGES_TABLE} WHERE
      conversationId = $conversationId AND
      hasFileAttachments = 1
     ORDER BY ${MessageColumns.coalesceSentAndReceivedAt} DESC
     LIMIT $limit;`
    )
    .all<JSONRow>({
      conversationId,
      limit,
    });

  return parseJsonRows(rows);
}

function getExternalFilesForMessage(message: any) {
  const { attachments, quote, preview } = message;
  const files: Array<string> = [];

  forEach(attachments, attachment => {
    const { path: file, thumbnail, screenshot } = attachment;
    if (file) {
      files.push(file);
    }

    if (thumbnail && thumbnail.path) {
      files.push(thumbnail.path);
    }

    if (screenshot && screenshot.path) {
      files.push(screenshot.path);
    }
  });
  if (quote && quote.attachments && quote.attachments.length) {
    forEach(quote.attachments, attachment => {
      const { thumbnail } = attachment;

      if (thumbnail && thumbnail.path) {
        files.push(thumbnail.path);
      }
    });
  }

  if (preview && preview.length) {
    forEach(preview, item => {
      const { image } = item;

      if (image && image.path) {
        files.push(image.path);
      }
    });
  }

  return files;
}

/**
 * This looks like `getExternalFilesForMessage`, but it does not include some type of attachments not visible from the right panel.
 * It should only be used when we look for messages to mark as deleted when an admin
 * triggers a "delete messages with attachments since".
 * Note: quoted attachments are referencing the original message, so we don't need to include them here.
 * Note: previews are not considered user visible (because not visible from the right panel),
 * so we don't need to include them here
 * Note: voice messages are not considered user visible (because not visible from the right panel),
 */
function hasUserVisibleAttachments(message: any) {
  const { attachments } = message;

  return some(attachments, attachment => {
    const { path: file, flags, thumbnail, screenshot } = attachment;

    return (
      // eslint-disable-next-line no-bitwise
      (file && !(flags & SignalService.AttachmentPointer.Flags.VOICE_MESSAGE)) ||
      thumbnail?.path ||
      screenshot?.path
    );
  });
}

function getExternalFilesForConversation(
  conversationAvatar:
    | string
    | {
        path?: string | undefined;
      }
    | undefined
    | null
) {
  const files = [];

  if (isString(conversationAvatar)) {
    files.push(conversationAvatar);
  }

  if (isObject(conversationAvatar)) {
    const avatarObj = conversationAvatar as Record<string, any>;
    if (isString(avatarObj.path)) {
      files.push(avatarObj.path);
    }
  }

  return files;
}

async function deleteAll({
  userDataPath,
  attachments,
}: {
  userDataPath: string;
  attachments: Array<string>;
}) {
  const deleteFromDisk = createDeleter(getAttachmentsPath(userDataPath));

  for (let index = 0, max = attachments.length; index < max; index += 1) {
    const file = attachments[index];
    // eslint-disable-next-line no-await-in-loop
    await deleteFromDisk(file);
  }

  console.log(`deleteAll: deleted ${attachments.length} files`);
}
function removeKnownAttachments(allAttachments: Array<string>) {
  const foundFiles = new Set<string>();
  const chunkSize = 1000;
  let startTime = Date.now();

  const total = getMessageCount();
  console.log(`removeKnownAttachments: About to iterate through ${total} messages`);

  let count = 0;
  let complete = false;
  let id = '';

  // Process messages
  while (!complete) {
    const sql = `SELECT json FROM ${MESSAGES_TABLE}
       WHERE id > $id AND hasAttachments=${toSqliteBoolean(true)}
       ORDER BY id ASC
       LIMIT $chunkSize;`;
    const params = { id, chunkSize };
    const rows = analyzeQuery(assertGlobalInstance(), sql, params).all<JSONRow>();

    const messages = parseJsonRows(rows);

    for (const message of messages) {
      const externalFiles = getExternalFilesForMessage(message);
      for (const file of externalFiles) {
        foundFiles.add(file);
      }
    }

    const lastMessage = messages[messages.length - 1];
    if (lastMessage) {
      id = lastMessage.id;
    }
    complete = messages.length < chunkSize;
    count += messages.length;
  }

  console.log(
    `removeKnownAttachments: Done processing ${count} ${MESSAGES_TABLE} in ${Date.now() - startTime}ms`
  );

  // Process conversations
  complete = false;
  count = 0;
  id = 0 as any;

  const conversationTotal = getConversationCount();
  startTime = Date.now();
  console.log(
    `removeKnownAttachments: About to iterate through ${conversationTotal} ${CONVERSATIONS_TABLE}`
  );

  while (!complete) {
    const sql = `SELECT * FROM ${CONVERSATIONS_TABLE}
       WHERE id > $id
       ORDER BY id ASC
       LIMIT $chunkSize;`;
    const params = { id, chunkSize };
    const conversations = analyzeQuery(
      assertGlobalInstance(),
      sql,
      params
    ).all<SQLConversationAttributes>();

    for (const conversation of conversations) {
      const externalFilesAvatar = getExternalFilesForConversation(conversation.avatarInProfile);
      const externalFilesFallbackAvatar = getExternalFilesForConversation(
        conversation.fallbackAvatarInProfile
      );

      for (const file of externalFilesAvatar) {
        foundFiles.add(file);
      }
      for (const file of externalFilesFallbackAvatar) {
        foundFiles.add(file);
      }
    }

    const lastConversation = conversations[conversations.length - 1];
    if (lastConversation) {
      id = lastConversation.id;
    }
    complete = conversations.length < chunkSize;
    count += conversations.length;
  }

  console.log(
    `removeKnownAttachments: Done processing ${count} ${CONVERSATIONS_TABLE} in ${Date.now() - startTime}ms`
  );

  // Return only attachments that were NOT found in messages/conversations
  return allAttachments.filter(file => !foundFiles.has(file));
}

function getMessagesCountByConversation(
  conversationId: string,
  instance?: Database | null
): number {
  const sql = `SELECT count(*) from ${MESSAGES_TABLE} WHERE conversationId = $conversationId;`;
  const params = { conversationId };
  const row = analyzeQuery(assertGlobalInstanceOrInstance(instance), sql, params).get<CountRow>();

  return row ? row['count(*)'] : 0;
}

function seedMessages({
  count,
  minWords,
  maxWords,
}: {
  count: number;
  minWords: number;
  maxWords: number;
}) {
  const now = Date.now();
  console.log(`about to seed ${count} messages`);

  const bulkText = generateBulkText(count, minWords, maxWords);

  const ourPk = getLoggedInUserConvoDuringMigration(assertGlobalInstance())?.ourKeys.publicKeyHex;

  if (!ourPk) {
    return;
  }

  const messageAttrsOpts: Array<MessageAttributes> = bulkText.map(body => {
    return {
      id: v4(),
      source: ourPk,
      type: 'outgoing',
      direction: 'outgoing',
      timestamp: Date.now(),
      conversationId: ourPk,
      body,
      received_at: Date.now(),
      serverTimestamp: Date.now(),
      expireTimer: 0,
      expirationStartTimestamp: 0,
      read_by: [],
      unread: toSqliteBoolean(false),
      sent_to: [],
      sent: true,
      sentSync: true,
      synced: true,
      sync: false,
    };
  });

  let seededCount = 0;
  chunk(messageAttrsOpts, 1000).forEach(item => {
    saveMessages(item);
    seededCount += item.length;
    console.log(`seeded so far ${seededCount} out of ${count} messages in ${Date.now() - now}ms`);
  });

  console.log(`seeded ${count} messages in ${Date.now() - now}ms`);
}

/**
 * Related to Opengroup V2
 */
function getAllV2OpenGroupRooms(instance?: Database): Array<OpenGroupV2Room> {
  const rows = assertGlobalInstanceOrInstance(instance)
    .prepare(`SELECT json FROM ${OPEN_GROUP_ROOMS_V2_TABLE};`)
    .all<JSONRow>();

  if (!rows) {
    return [];
  }

  return rows.map(r => jsonToObject(r.json)) as Array<OpenGroupV2Room>;
}

function getV2OpenGroupRoom(conversationId: string, instance?: Database) {
  const sql = `SELECT json FROM ${OPEN_GROUP_ROOMS_V2_TABLE} WHERE conversationId = $conversationId;`;
  const params = { conversationId };
  const row = analyzeQuery(assertGlobalInstanceOrInstance(instance), sql, params).get<JSONRow>();

  if (!row) {
    return null;
  }

  return jsonToObject(row.json);
}

function saveV2OpenGroupRoom(opengroupsV2Room: OpenGroupV2Room, instance?: Database) {
  // TODO: made convo id required, but for now this works
  if (!opengroupsV2Room.conversationId) {
    throw new Error('saveV2OpenGroupRoom given an invalid conversationId');
  }
  assertGlobalInstanceOrInstance(instance)
    .prepare(
      `INSERT OR REPLACE INTO ${OPEN_GROUP_ROOMS_V2_TABLE} (
      serverUrl,
      roomId,
      conversationId,
      json
    ) values (
      $serverUrl,
      $roomId,
      $conversationId,
      $json
    )`
    )
    .run({
      serverUrl: opengroupsV2Room.serverUrl,
      roomId: opengroupsV2Room.roomId,
      conversationId: opengroupsV2Room.conversationId,
      json: objectToJSON(opengroupsV2Room),
    });
}

function removeV2OpenGroupRoom(conversationId: string) {
  const sql = `DELETE FROM ${OPEN_GROUP_ROOMS_V2_TABLE} WHERE conversationId = $conversationId;`;
  const params = { conversationId };
  analyzeQuery(assertGlobalInstance(), sql, params).run();
}

/**
 * Others
 */

function getEntriesCountInTable(tbl: string) {
  try {
    const row = assertGlobalInstance().prepare(`SELECT count(*) from ${tbl};`).get<CountRow>();
    if (!row) {
      throw new Error('row is undefined in getEntriesCountInTable');
    }
    return row['count(*)'];
  } catch (e) {
    console.error(`getEntriesCountInTable for ${tbl} failed with`, e.message);
    return 0;
  }
}

function printDbStats() {
  [
    'attachment_downloads',
    'conversations',
    'encryptionKeyPairsForClosedGroupV2',
    'guardNodes',
    'identityKeys',
    'items',
    'lastHashes',
    'loki_schema',
    'messages',
    'messages_fts',
    'messages_fts_config',
    'messages_fts_data',
    'messages_fts_docsize',
    'messages_fts_idx',
    'nodesForPubkey',
    'openGroupRoomsV2',
    'seenMessages',
    'sqlite_sequence',
    'sqlite_stat1',
    'sqlite_stat4',
  ].forEach(i => {
    console.log(`${i} count`, getEntriesCountInTable(i));
  });
}

/**
 * Remove all the unused entries in the snodes for pubkey table.
 * This table is used to know which snodes we should contact to send a message to a recipient
 */
function cleanUpUnusedNodeForKeyEntriesOnStart() {
  // we have to keep private and closed group ids
  const allIdsToKeep =
    assertGlobalInstance()
      .prepare(
        `SELECT id FROM ${CONVERSATIONS_TABLE} WHERE id NOT LIKE 'http%'
    `
      )
      .all<{ id: string }>()
      .map(m => m.id) || [];

  const allEntriesInSnodeForPubkey =
    assertGlobalInstance()
      .prepare(`SELECT pubkey FROM ${NODES_FOR_PUBKEY_TABLE};`)
      .all<{ pubkey: string }>()
      .map(m => m.pubkey) || [];

  const swarmUnused = difference(allEntriesInSnodeForPubkey, allIdsToKeep);

  if (swarmUnused.length) {
    const start = Date.now();

    const chunks = chunk(swarmUnused, 500);
    chunks.forEach(ch => {
      assertGlobalInstance()
        .prepare(
          `DELETE FROM ${NODES_FOR_PUBKEY_TABLE} WHERE pubkey IN (${ch.map(() => '?').join(',')});`
        )
        .run(ch);
    });

    console.log(`Removing of ${swarmUnused.length} unused swarms took ${Date.now() - start}ms`);
  }
}

function cleanUpOldOpengroupsOnStart() {
  const ourNumber = getItemById(SettingsKey.numberId);
  if (!ourNumber || !ourNumber.value) {
    console.info('cleanUpOldOpengroups: ourNumber is not set');
    return;
  }
  let pruneSetting = getItemById(SettingsKey.settingsOpengroupPruning)?.value;

  if (pruneSetting === undefined) {
    console.info('Prune settings is undefined (and not explicitly false), forcing it to true.');
    createOrUpdateItem({ id: SettingsKey.settingsOpengroupPruning, value: true });
    pruneSetting = true;
  }

  if (!pruneSetting) {
    console.info('Prune setting not enabled, skipping cleanUpOldOpengroups');
    return;
  }

  const sql = `SELECT id FROM ${CONVERSATIONS_TABLE} WHERE
      type = 'group' AND
      id LIKE 'http%'
     ORDER BY id ASC;`;
  const params: StatementParameters<object> = [];

  const rows = analyzeQuery(assertGlobalInstance(), sql, params).all<SQLConversationAttributes>();

  const v2ConvosIds = map(rows, row => row.id);

  if (!v2ConvosIds || !v2ConvosIds.length) {
    console.info('cleanUpOldOpengroups: v2Convos is empty');
    return;
  }
  console.info(`Count of v2 opengroup convos to clean: ${v2ConvosIds.length}`);
  // For each open group, if it has more than 2000 messages, we remove all the messages
  // older than 6 months. So this does not limit the size of open group history to 2000
  // messages but to 6 months.
  //
  // This is the only way we can clean up conversations objects from users which just
  // sent messages a while ago and with whom we never interacted. This is only for open
  // groups, and is because ALL the conversations are cached in the redux store. Having
  // a very large number of conversations (unused) is causing the performance of the app
  // to deteriorate a lot.
  //
  // Another fix would be to not cache all the conversations in the redux store, but it
  // ain't going to happen any time soon as it would a pretty big change of the way we
  // do things and would break a lot of the app.
  const maxMessagePerOpengroupConvo = 2000;

  // first remove very old messages for each opengroups
  const db = assertGlobalInstance();
  db.transaction(() => {
    v2ConvosIds.forEach(convoId => {
      const messagesInConvoBefore = getMessagesCountByConversation(convoId);

      if (messagesInConvoBefore >= maxMessagePerOpengroupConvo) {
        const minute = 1000 * 60;
        const sixMonths = minute * 60 * 24 * 30 * 6;
        const limitTimestamp = Date.now() - sixMonths;
        const sqlSelect = `SELECT count(*) from ${MESSAGES_TABLE} WHERE serverTimestamp <= $serverTimestamp AND conversationId = $conversationId;`;
        const paramsSelect = { conversationId: convoId, serverTimestamp: limitTimestamp };
        const countToRemove =
          analyzeQuery(assertGlobalInstance(), sqlSelect, paramsSelect).get<CountRow>()?.[
            'count(*)'
          ] || 0;
        const start = Date.now();

        const sqlDelete = `DELETE FROM ${MESSAGES_TABLE} WHERE serverTimestamp <= $serverTimestamp AND conversationId = $conversationId;`;
        const paramsDelete = { conversationId: convoId, serverTimestamp: limitTimestamp };
        analyzeQuery(assertGlobalInstance(), sqlDelete, paramsDelete).run(); // delete messages older than 6 months ago.

        const messagesInConvoAfter = getMessagesCountByConversation(convoId);

        console.info(
          `Cleaning ${countToRemove} messages older than 6 months in public convo: ${convoId} took ${
            Date.now() - start
          }ms. Old message count: ${messagesInConvoBefore}, new message count: ${messagesInConvoAfter}`
        );

        // no need to update the `unreadCount` during the migration anymore.
        // `saveConversation` is broken when called with a argument without all the required fields.
        // and this makes little sense as the unreadCount will be updated on opening
      } else {
        console.info(
          `Not cleaning messages older than 6 months in public convo: ${convoId}. message count: ${messagesInConvoBefore}`
        );
      }
    });

    // now, we might have a bunch of private conversation, without any interaction and no messages
    // those are the conversation of the old members in the opengroups we just cleaned.
    const sqlSelectInactive = `SELECT id FROM ${CONVERSATIONS_TABLE} WHERE type = 'private' AND (active_at IS NULL OR active_at = 0);`;
    const paramsSelectInactive: StatementParameters<object> = [];

    const allInactiveConvos = analyzeQuery(
      assertGlobalInstance(),
      sqlSelectInactive,
      paramsSelectInactive
    ).all<SQLConversationAttributes>(); // delete messages older than 6 months ago.

    const ourPubkey = ourNumber.value.split('.')[0];

    const allInactiveAndWithoutMessagesConvo = allInactiveConvos
      .map(c => c.id)
      .filter(convoId => {
        return !!(convoId !== ourPubkey && getMessagesCountBySender({ source: convoId }) === 0);
      });
    if (allInactiveAndWithoutMessagesConvo.length) {
      console.info(
        `Removing ${allInactiveAndWithoutMessagesConvo.length} completely inactive convos`
      );
      const start = Date.now();

      const chunks = chunk(allInactiveAndWithoutMessagesConvo, 500);
      chunks.forEach(ch => {
        db.prepare(
          `DELETE FROM ${CONVERSATIONS_TABLE} WHERE id IN (${ch.map(() => '?').join(',')});`
        ).run(ch);
      });

      console.info(
        `Removing of ${
          allInactiveAndWithoutMessagesConvo.length
        } completely inactive convos done in ${Date.now() - start}ms`
      );
    }
  })();
}

export type SqlNodeType = typeof sqlNode;

export function close() {
  try {
    setGracefulLastShutdown(assertGlobalInstance(), true);
  } catch (e) {
    // console.info('setGracefulLastShutdown failed', e.message);
  }
  try {
    dbVacuumManager?.cleanup();
    dbVacuumManager = undefined;
  } catch (e) {
    // nothing to do
  }
  closeDbInstance();
}

export const sqlNode = {
  initializeSql,
  close,
  removeDB,
  setSQLPassword,
  getDBCreationTimestampMs,

  getPasswordHash,
  savePasswordHash,
  removePasswordHash,

  getIdentityKeyById,

  createOrUpdateItem,
  getItemById,
  getAllItems,
  removeItemById,

  getSwarmNodesForPubkey,
  updateSwarmNodesForPubkey,
  clearOutAllSnodesNotInPool,
  getGuardNodes,
  updateGuardNodes,

  getConversationCount,
  saveConversation,
  fetchConvoMemoryDetails,
  getConversationById,
  removeConversation,
  getAllConversations,
  getPubkeysInPublicConversation,
  removeAllConversations,

  searchMessages,

  getMessageCount,
  saveMessage,
  cleanSeenMessages,
  cleanLastHashes,
  clearLastHashesForConvoId,
  saveSeenMessageHashes,
  emptySeenMessageHashesForConversation,
  updateLastHash,
  saveMessages,
  removeMessage,
  removeMessagesByIds,
  removeAllMessagesInConversationSentBefore,
  getAllMessagesWithAttachmentsInConversationSentBefore,
  cleanUpExpirationTimerUpdateHistory,
  removeAllMessagesInConversation,
  findAllMessageFromSendersInConversation,
  findAllMessageHashesInConversation,
  findAllMessageHashesInConversationMatchingAuthor,
  fetchAllGroupUpdateFailedMessage,
  getUnreadByConversation,
  getUnreadDisappearingByConversation,
  markAllAsReadByConversationNoExpiration,
  getUnreadCountByConversation,
  getMessageCountByType,

  filterAlreadyFetchedOpengroupMessage,
  getMessagesBySenderAndSentAt,
  getMessagesByConvoIdAndSentAt,
  getMessageIdsFromServerIds,
  getMessageById,
  getMessagesById,
  getMessagesBySentAt,
  getMessageByServerId,
  getSeenMessagesByHashList,
  getLastHashBySnode,
  getExpiredMessages,
  getOutgoingWithoutExpiresAt,
  getNextExpiringMessage,
  getMessagesByConversation,
  getLastMessagesByConversation,
  getOldestMessageInConversation,
  getFirstUnreadMessageIdInConversation,
  getFirstUnreadMessageWithMention,
  getOldestMessageIdInConversation,
  hasConversationOutgoingMessage,

  getNextAttachmentDownloadJobs,
  saveAttachmentDownloadJob,
  setAttachmentDownloadJobPending,
  resetAttachmentDownloadPending,
  removeAttachmentDownloadJob,
  removeAllAttachmentDownloadJobs,
  removeKnownAttachments,
  deleteAll,
  removeAll,

  getMessagesWithVisualMediaAttachments,
  getMessagesWithFileAttachments,
  getMessagesCountByConversation,

  // seeding
  seedMessages,

  // open group v2
  getV2OpenGroupRoom,
  saveV2OpenGroupRoom,
  getAllV2OpenGroupRooms,
  removeV2OpenGroupRoom,

  // config dumps
  ...configDumpData,
};
