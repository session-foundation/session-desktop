import * as BetterSqlite3 from '@signalapp/better-sqlite3';
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
  fromPairs,
  intersection,
  isArray,
  isEmpty,
  isFunction,
  isNumber,
  isObject,
  isString,
  last,
  map,
  omit,
  some,
  uniq,
} from 'lodash';

import { GroupPubkeyType } from 'libsession_util_nodejs';
import { ConversationAttributes } from '../models/conversationAttributes';
import { redactAll } from '../util/privacy';
import {
  arrayStrToJson,
  assertValidConversationAttributes,
  ATTACHMENT_DOWNLOADS_TABLE,
  CONVERSATIONS_TABLE,
  formatRowOfConversation,
  GUARD_NODE_TABLE,
  HEX_KEY,
  IDENTITY_KEYS_TABLE,
  ITEMS_TABLE,
  jsonToObject,
  LAST_HASHES_TABLE,
  MESSAGES_FTS_TABLE,
  MESSAGES_TABLE,
  NODES_FOR_PUBKEY_TABLE,
  objectToJSON,
  OPEN_GROUP_ROOMS_V2_TABLE,
  SEEN_MESSAGE_TABLE,
  toSqliteBoolean,
} from './database_utility';
import type { SetupI18nReturnType } from '../types/localizer';
import { StorageItem } from './storage_item';

import {
  CONFIG_DUMP_TABLE,
  MsgDuplicateSearchOpenGroup,
  roomHasBlindEnabled,
  SaveConversationReturn,
  SaveSeenMessageHash,
  UnprocessedDataNode,
  UnprocessedParameter,
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
import { Quote } from '../receiver/types';
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

// eslint:disable: function-name non-literal-fs-path

const MAX_PUBKEYS_MEMBERS = 300;

function getSQLIntegrityCheck(db: BetterSqlite3.Database) {
  const checkResult = db.pragma('quick_check', { simple: true });
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

function vacuumDatabase(db: BetterSqlite3.Database) {
  if (!db) {
    throw new Error('vacuum: db is not initialized');
  }
  const start = Date.now();
  console.info('Vacuuming DB. This might take a while.');
  db.exec('VACUUM;');
  console.info(`Vacuuming DB Finished in ${Date.now() - start}ms.`);
}

let databaseFilePath: string | undefined;

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
  i18n,
  passwordAttempt,
}: {
  configDir: string;
  key: string;
  i18n: SetupI18nReturnType;
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
  if (!isFunction(i18n)) {
    throw new Error('initialize: i18n is required!');
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

    console.info('total message count before cleaning: ', getMessageCount());
    console.info('total conversation count before cleaning: ', getConversationCount());
    cleanUpOldOpengroupsOnStart();
    cleanUpUnusedNodeForKeyEntriesOnStart();
    cleanUpUnreadExpiredDaRMessages();
    printDbStats();

    console.info('total message count after cleaning: ', getMessageCount());
    console.info('total conversation count after cleaning: ', getConversationCount());
    // Clear any already deleted db entries on each app start.
    vacuumDatabase(db);
  } catch (error) {
    console.error('error', error);
    if (passwordAttempt) {
      throw error;
    }
    console.log('Database startup error:', error.stack);
    const button = await dialog.showMessageBox({
      buttons: [i18n('errorCopyAndQuit'), i18n('clearDataAll')],
      defaultId: 0,
      detail: redactAll(error.stack),
      message: i18n('errorDatabase'),
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

function getIdentityKeyById(id: string, instance: BetterSqlite3.Database) {
  return getById(IDENTITY_KEYS_TABLE, id, instance);
}

function getGuardNodes() {
  const nodes = assertGlobalInstance()
    .prepare(`SELECT ed25519PubKey FROM ${GUARD_NODE_TABLE};`)
    .all();

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

function createOrUpdateItem(data: StorageItem, instance?: BetterSqlite3.Database) {
  createOrUpdate(ITEMS_TABLE, data, instance);
}

function getItemById(id: string, instance?: BetterSqlite3.Database) {
  return getById(ITEMS_TABLE, id, instance);
}

function getAllItems() {
  const rows = assertGlobalInstance()
    .prepare(`SELECT json FROM ${ITEMS_TABLE} ORDER BY id ASC;`)
    .all();
  return map(rows, row => jsonToObject(row.json));
}

function removeItemById(id: string) {
  removeById(ITEMS_TABLE, id);
}

function createOrUpdate(table: string, data: StorageItem, instance?: BetterSqlite3.Database) {
  const { id } = data;
  if (!id) {
    throw new Error('createOrUpdate: Provided data did not have a truthy id');
  }

  assertGlobalInstanceOrInstance(instance)
    .prepare(
      `INSERT OR REPLACE INTO ${table} (
      id,
      json
    ) values (
      $id,
      $json
    )`
    )
    .run({
      id,
      json: objectToJSON(data),
    });
}

function getById(table: string, id: string, instance?: BetterSqlite3.Database) {
  const row = assertGlobalInstanceOrInstance(instance)
    .prepare(`SELECT * FROM ${table} WHERE id = $id;`)
    .get({
      id,
    });

  if (!row) {
    return null;
  }

  return jsonToObject(row.json);
}

function removeById(table: string, id: string) {
  if (!Array.isArray(id)) {
    assertGlobalInstance().prepare(`DELETE FROM ${table} WHERE id = $id;`).run({ id });
    return;
  }

  if (!id.length) {
    throw new Error('removeById: No ids to delete!');
  }

  // Our node interface doesn't seem to allow you to replace one single ? with an array
  assertGlobalInstance()
    .prepare(`DELETE FROM ${table} WHERE id IN ( ${id.map(() => '?').join(', ')} );`)
    .run({ id });
}

// Conversations

function getSwarmNodesForPubkey(pubkey: string) {
  const row = assertGlobalInstance()
    .prepare(`SELECT * FROM ${NODES_FOR_PUBKEY_TABLE} WHERE pubkey = $pubkey;`)
    .get({
      pubkey,
    });

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
    .all();

  allSwarms.forEach(swarm => {
    try {
      const json = JSON.parse(swarm.json);
      if (isArray(json)) {
        const intersect = intersection(json, edKeysOfSnodePool);
        if (intersect.length !== json.length) {
          updateSwarmNodesForPubkey(swarm.pubkey, intersect);
          console.info(
            `clearOutAllSnodesNotInPool: updating swarm of ${ed25519Str(swarm.pubkey)} to `,
            intersect
          );
        }
      }
    } catch (e) {
      console.warn(
        `Failed to parse swarm while iterating in clearOutAllSnodesNotInPool for pk: ${ed25519Str(swarm?.pubkey)}`
      );
    }
  });
}

function getConversationCount(db?: BetterSqlite3.Database) {
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
    isKickedFromGroup,
    avatarPointer,
    avatarImageId,
    triggerNotificationsFor,
    isTrustedForAttachmentDownload,
    isApproved,
    didApproveMe,
    avatarInProfile,
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
  assertGlobalInstance()
    .prepare(
      `INSERT OR REPLACE INTO ${CONVERSATIONS_TABLE} (
	${columnsCommaSeparated}
	) values (
	   ${valuesArgs}
      )`
    )
    .run({
      id,
      active_at,
      type,
      members: members && members.length ? arrayStrToJson(members) : '[]',
      nickname,
      profileKey,
      left: toSqliteBoolean(left),
      expirationMode,
      expireTimer,
      isExpired03Group,
      lastMessageStatus,
      lastMessage: shortenedLastMessage,
      lastMessageInteractionType,
      lastMessageInteractionStatus,

      lastJoinedTimestamp,
      groupAdmins: groupAdmins && groupAdmins.length ? arrayStrToJson(groupAdmins) : '[]',
      isKickedFromGroup: toSqliteBoolean(isKickedFromGroup),
      avatarPointer,
      avatarImageId,
      triggerNotificationsFor,
      isTrustedForAttachmentDownload: toSqliteBoolean(isTrustedForAttachmentDownload),
      priority,
      isApproved: toSqliteBoolean(isApproved),
      didApproveMe: toSqliteBoolean(didApproveMe),
      avatarInProfile,
      displayNameInProfile,
      conversationIdOrigin,
      markedAsUnread: toSqliteBoolean(markedAsUnread),
      blocksSogsMsgReqsTimestamp,
    });

  return fetchConvoMemoryDetails(id);
}

function fetchConvoMemoryDetails(convoId: string): SaveConversationReturn {
  const hasMentionedUsUnread = !!getFirstUnreadMessageWithMention(convoId);
  const unreadCount = getUnreadCountByConversation(convoId);
  const lastReadTimestampMessageSentTimestamp = getLastMessageReadInConversation(convoId);

  // TODOLATER it would be nice to be able to remove the lastMessage and lastMessageStatus from the conversation table, and just return it when saving the conversation
  // and saving it in memory only.
  // But we'd need to update a bunch of things as we do some logic before setting the lastUpdate text and status mostly in `getMessagePropStatus` and `getNotificationText()`
  // const lastMessages = getLastMessagesByConversation(convoId, 1) as Array:Record<string, any>>;

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

export function getIdentityKeys(db: BetterSqlite3.Database) {
  const row = db.prepare(`SELECT * FROM ${ITEMS_TABLE} WHERE id = $id;`).get({
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

    // TODOLATER migrate the ed25519KeyPair for all the users already logged in to a base64 representation
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
  instance?: BetterSqlite3.Database
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

function getConversationById(id: string, instance?: BetterSqlite3.Database) {
  const row = assertGlobalInstanceOrInstance(instance)
    .prepare(`SELECT * FROM ${CONVERSATIONS_TABLE} WHERE id = $id;`)
    .get({
      id,
    });

  const unreadCount = getUnreadCountByConversation(id, instance) || 0;
  const mentionedUsStillUnread = !!getFirstUnreadMessageWithMention(id, instance);

  return formatRowOfConversation(row, 'getConversationById', unreadCount, mentionedUsStillUnread);
}

function getAllConversations() {
  const rows = assertGlobalInstance()
    .prepare(`SELECT * FROM ${CONVERSATIONS_TABLE} ORDER BY id ASC;`)
    .all();

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

  const rows = assertGlobalInstance()
    .prepare(
      `SELECT DISTINCT source FROM ${MESSAGES_TABLE} WHERE
    conversationId = $conversationId ${whereClause}
   ORDER BY received_at DESC LIMIT ${MAX_PUBKEYS_MEMBERS};`
    )
    .all({
      conversationId,
    });

  return map(rows, row => row.source);
}

function searchConversations(query: string) {
  const rows = assertGlobalInstance()
    .prepare(
      `SELECT * FROM ${CONVERSATIONS_TABLE} WHERE
    (
      displayNameInProfile LIKE $displayNameInProfile COLLATE NOCASE OR
      nickname LIKE $nickname COLLATE NOCASE OR
      (id LIKE $id AND
        (displayNameInProfile IS NULL OR displayNameInProfile = '') AND (nickname IS NULL OR nickname = '')
      )
    ) AND active_at > 0
    ORDER BY (COALESCE(NULLIF(nickname, ''), displayNameInProfile) COLLATE NOCASE)
    LIMIT $limit`
    )
    .all({
      displayNameInProfile: `%${query}%`,
      id: `%${query}%`,
      nickname: `%${query}%`,
      limit: 50,
    });

  return (rows || []).map(m => {
    const unreadCount = getUnreadCountByConversation(m.id);
    const mentionedUsStillUnread = !!getFirstUnreadMessageWithMention(m.id);

    const formatted = formatRowOfConversation(
      m,
      'searchConversations',
      unreadCount,
      mentionedUsStillUnread
    );

    return formatted;
  });
}

// order by clause is the same as orderByClause but with a table prefix so we cannot reuse it
const orderByMessageCoalesceClause = `ORDER BY COALESCE(${MESSAGES_TABLE}.serverTimestamp, ${MESSAGES_TABLE}.sent_at, ${MESSAGES_TABLE}.received_at) DESC`;

function searchMessages(query: string, limit: number) {
  if (!limit) {
    throw new Error('searchMessages limit must be set');
  }

  const rows = assertGlobalInstance()
    .prepare(
      `SELECT
      ${MESSAGES_TABLE}.json,
      snippet(${MESSAGES_FTS_TABLE}, -1, '<<left>>', '<<right>>', '...', 5) as snippet
    FROM ${MESSAGES_FTS_TABLE}
    INNER JOIN ${MESSAGES_TABLE} on ${MESSAGES_FTS_TABLE}.rowid = ${MESSAGES_TABLE}.rowid
    WHERE
     ${MESSAGES_FTS_TABLE}.body match $query
    ${orderByMessageCoalesceClause}
    LIMIT $limit;`
    )
    .all({
      query,
      limit,
    });

  return map(rows, row => ({
    ...jsonToObject(row.json),
    snippet: row.snippet,
  }));
}

/**
 * Search for matching messages in a specific conversation.
 * Currently unused but kept as we want to add it back at some point.
 */
function searchMessagesInConversation(query: string, conversationId: string, limit: number) {
  const rows = assertGlobalInstance()
    .prepare(
      `SELECT
      ${MESSAGES_TABLE}.json,
      snippet(${MESSAGES_FTS_TABLE}, -1, '<<left>>', '<<right>>', '...', 15) as snippet
    FROM ${MESSAGES_FTS_TABLE}
    INNER JOIN ${MESSAGES_TABLE} on ${MESSAGES_FTS_TABLE}.id = ${MESSAGES_TABLE}.id
    WHERE
    ${MESSAGES_FTS_TABLE} match $query AND
      ${MESSAGES_TABLE}.conversationId = $conversationId
    ${orderByMessageCoalesceClause}
      LIMIT $limit;`
    )
    .all({
      query,
      conversationId,
      limit: limit || 100,
    });

  return map(rows, row => ({
    ...jsonToObject(row.json),
    snippet: row.snippet,
  }));
}

function getMessageCount() {
  const row = assertGlobalInstance().prepare(`SELECT count(*) from ${MESSAGES_TABLE};`).get();

  if (!row) {
    throw new Error(`getMessageCount: Unable to get count of ${MESSAGES_TABLE}`);
  }
  return row['count(*)'];
}

function saveMessage(data: MessageAttributes) {
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
    flags,
    messageHash,
    errors,
  } = data;

  if (!id) {
    throw new Error('id is required');
  }

  if (!conversationId) {
    throw new Error('conversationId is required');
  }

  const payload = {
    id,
    json: objectToJSON(data),

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
    type: type || '',
    unread,
    flags: flags ?? 0,
    messageHash,
    errors,
  };

  assertGlobalInstance()
    .prepare(
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
    errors
  ) values (
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
    $errors
  );`
    )
    .run(payload);

  return id;
}

function saveSeenMessageHashes(arrayOfHashes: Array<SaveSeenMessageHash>) {
  assertGlobalInstance().transaction(() => {
    map(arrayOfHashes, saveSeenMessageHash);
  })();
}

function emptySeenMessageHashesForConversation(conversationId: string) {
  if (!isString(conversationId) || isEmpty(conversationId)) {
    throw new Error('emptySeenMessageHashesForConversation: conversationId is not a string');
  }
  assertGlobalInstance()
    .prepare(`DELETE FROM ${SEEN_MESSAGE_TABLE} WHERE conversationId=$conversationId`)
    .run({ conversationId });
}

function updateLastHash(data: UpdateLastHashType) {
  const { convoId, snode, hash, expiresAt, namespace } = data;
  if (!isNumber(namespace)) {
    throw new Error('updateLastHash: namespace must be set to a number');
  }
  assertGlobalInstance()
    .prepare(
      `INSERT OR REPLACE INTO ${LAST_HASHES_TABLE} (
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
    )`
    )
    .run({
      id: convoId,
      snode,
      hash,
      expiresAt,
      namespace,
    });
}

function clearLastHashesForConvoId(conversationId: string) {
  if (!isString(conversationId) || isEmpty(conversationId)) {
    throw new Error('clearLastHashesForConvoId: conversationId is not a string');
  }
  assertGlobalInstance()
    .prepare(`DELETE FROM ${LAST_HASHES_TABLE} WHERE id=$conversationId`)
    .run({ conversationId });
}

function saveSeenMessageHash(data: SaveSeenMessageHash) {
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
  try {
    assertGlobalInstance()
      .prepare(
        `INSERT OR REPLACE INTO ${SEEN_MESSAGE_TABLE} (
      expiresAt,
      hash,
      conversationId
      ) values (
        $expiresAt,
        $hash,
        $conversationId
        );`
      )
      .run({
        expiresAt,
        hash,
        conversationId,
      });
  } catch (e) {
    console.error('saveSeenMessageHash failed:', e.message);
  }
}

function cleanLastHashes() {
  assertGlobalInstance().prepare(`DELETE FROM ${LAST_HASHES_TABLE} WHERE expiresAt <= $now;`).run({
    now: Date.now(),
  });
}

function cleanSeenMessages() {
  assertGlobalInstance().prepare(`DELETE FROM ${SEEN_MESSAGE_TABLE} WHERE expiresAt <= $now;`).run({
    now: Date.now(),
  });
}

function saveMessages(arrayOfMessages: Array<MessageAttributes>) {
  console.info('saveMessages count: ', arrayOfMessages.length);
  assertGlobalInstance().transaction(() => {
    map(arrayOfMessages, saveMessage);
  })();
}

function removeMessage(id: string, instance?: BetterSqlite3.Database) {
  if (!isString(id)) {
    throw new Error('removeMessage: only takes single message to delete!');
  }

  assertGlobalInstanceOrInstance(instance)
    .prepare(`DELETE FROM ${MESSAGES_TABLE} WHERE id = $id;`)
    .run({ id });
}

function removeMessagesByIds(ids: Array<string>, instance?: BetterSqlite3.Database) {
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
  instance?: BetterSqlite3.Database
) {
  const msgIds = assertGlobalInstanceOrInstance(instance)
    .prepare(
      `SELECT id FROM ${MESSAGES_TABLE} WHERE conversationId = $conversationId AND sent_at <= $beforeMs;`
    )
    .all({ conversationId, beforeMs: deleteBeforeSeconds * 1000 });

  assertGlobalInstanceOrInstance(instance)
    .prepare(
      `DELETE FROM ${MESSAGES_TABLE} WHERE conversationId = $conversationId AND sent_at <= $beforeMs;`
    )
    .run({ conversationId, beforeMs: deleteBeforeSeconds * 1000 });
  console.info('removeAllMessagesInConversationSentBefore deleted msgIds:', JSON.stringify(msgIds));
  return msgIds.map(m => m.id);
}

async function getAllMessagesWithAttachmentsInConversationSentBefore(
  {
    deleteAttachBeforeSeconds,
    conversationId,
  }: { deleteAttachBeforeSeconds: number; conversationId: GroupPubkeyType },
  instance?: BetterSqlite3.Database
) {
  const rows = assertGlobalInstanceOrInstance(instance)
    .prepare(
      `SELECT json FROM ${MESSAGES_TABLE} WHERE conversationId = $conversationId AND sent_at <= $beforeMs;`
    )
    .all({ conversationId, beforeMs: deleteAttachBeforeSeconds * 1000 });
  const messages = map(rows, row => jsonToObject(row.json));
  const messagesWithAttachments = messages.filter(m => {
    return hasUserVisibleAttachments(m);
  });
  return messagesWithAttachments;
}

function removeAllMessagesInConversation(
  conversationId: string,
  instance?: BetterSqlite3.Database
) {
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
  instance?: BetterSqlite3.Database
) {
  if (!groupPk || !toRemove.length) {
    return { messageHashes: [] };
  }
  const rows = assertGlobalInstanceOrInstance(instance)
    .prepare(
      `SELECT json FROM ${MESSAGES_TABLE} WHERE conversationId = ? AND sent_at <= ? AND source IN ( ${toRemove.map(() => '?').join(', ')} )`
    )
    .all(groupPk, signatureTimestamp, ...toRemove);

  if (!rows || isEmpty(rows)) {
    return [];
  }
  return map(rows, row => jsonToObject(row.json));
}

function findAllMessageHashesInConversation(
  { groupPk, messageHashes, signatureTimestamp }: FindAllMessageHashesInConversationTypeArgs,
  instance?: BetterSqlite3.Database
) {
  if (!groupPk || !messageHashes.length) {
    return [];
  }
  const rows = compact(
    assertGlobalInstanceOrInstance(instance)
      .prepare(
        `SELECT json FROM ${MESSAGES_TABLE} WHERE conversationId = ? AND sent_at <= ? AND messageHash IN ( ${messageHashes.map(() => '?').join(', ')} )`
      )
      .all(groupPk, signatureTimestamp, ...messageHashes)
  );

  if (!rows || isEmpty(rows)) {
    return [];
  }
  return map(rows, row => jsonToObject(row.json));
}

function findAllMessageHashesInConversationMatchingAuthor(
  {
    author,
    groupPk,
    messageHashes,
    signatureTimestamp,
  }: FindAllMessageHashesInConversationMatchingAuthorTypeArgs,
  instance?: BetterSqlite3.Database
) {
  if (!groupPk || !author || !messageHashes.length) {
    return { msgHashesDeleted: [], msgIdsDeleted: [] };
  }
  const rows = assertGlobalInstanceOrInstance(instance)
    .prepare(
      `SELECT json FROM ${MESSAGES_TABLE} WHERE conversationId = ? AND source = ? AND sent_at <= ? AND messageHash IN ( ${messageHashes.map(() => '?').join(', ')} );`
    )
    .all(groupPk, author, signatureTimestamp, ...messageHashes);

  if (!rows || isEmpty(rows)) {
    return null;
  }
  return map(rows, row => jsonToObject(row.json));
}

function fetchAllGroupUpdateFailedMessage(
  groupPk: GroupPubkeyType,
  instance?: BetterSqlite3.Database
) {
  if (!groupPk) {
    return [];
  }
  const rows = assertGlobalInstanceOrInstance(instance)
    .prepare(
      `SELECT json FROM ${MESSAGES_TABLE} WHERE conversationId = ? AND (JSON_EXTRACT(json, '$.group_update') IS NOT NULL OR JSON_EXTRACT(json, '$.expirationTimerUpdate') IS NOT NULL) AND errors IS NOT NULL;`
    )
    .all(groupPk);

  if (!rows || isEmpty(rows)) {
    return [];
  }
  const objs = map(rows, row => jsonToObject(row.json)).filter(m => {
    return !isEmpty(m);
  });

  return objs;
}

function cleanUpExpirationTimerUpdateHistory(
  conversationId: string,
  isPrivate: boolean,
  db?: BetterSqlite3.Database
) {
  if (isEmpty(conversationId)) {
    return [];
  }
  const rows = assertGlobalInstanceOrInstance(db)
    .prepare(
      `SELECT id, source FROM ${MESSAGES_TABLE} WHERE conversationId = $conversationId and flags = ${SignalService.DataMessage.Flags.EXPIRATION_TIMER_UPDATE} ${orderByClause}`
    )
    .all({ conversationId });

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
    .get({
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
    .all(ids);
  if (!rows || isEmpty(rows)) {
    return null;
  }
  return map(rows, row => jsonToObject(row.json));
}

// serverIds are not unique so we need the conversationId
function getMessageByServerId(conversationId: string, serverId: number) {
  const row = assertGlobalInstance()
    .prepare(
      `SELECT * FROM ${MESSAGES_TABLE} WHERE conversationId = $conversationId AND serverId = $serverId;`
    )
    .get({
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
  const count = assertGlobalInstance()
    .prepare(
      `SELECT count(*) FROM ${MESSAGES_TABLE} WHERE
      source = $source;`
    )
    .get({
      source,
    });
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
      .all({
        source,
        timestamp,
      });
    rows.push(..._rows);
  }

  return uniq(map(rows, row => jsonToObject(row.json)));
}

function filterAlreadyFetchedOpengroupMessage(
  msgDetails: MsgDuplicateSearchOpenGroup
): MsgDuplicateSearchOpenGroup {
  const filteredNonBlinded = msgDetails.filter(msg => {
    const rows = assertGlobalInstance()
      .prepare(
        `SELECT source, serverTimestamp  FROM ${MESSAGES_TABLE} WHERE
      source = $sender AND
      serverTimestamp = $serverTimestamp;`
      )
      .all({
        sender: msg.sender,
        serverTimestamp: msg.serverTimestamp,
      });
    if (rows.length) {
      console.info(
        `filtering out already received sogs message from ${msg.sender} at ${msg.serverTimestamp} `
      );
      return false;
    }
    return true;
  });

  return filteredNonBlinded;
}

function getUnreadByConversation(conversationId: string, sentBeforeTimestamp: number) {
  const rows = assertGlobalInstance()
    .prepare(
      `SELECT * FROM ${MESSAGES_TABLE} WHERE
      unread = $unread AND
      conversationId = $conversationId AND
      COALESCE(serverTimestamp, sent_at) <= $sentBeforeTimestamp
     ${orderByClauseASC};`
    )
    .all({
      unread: toSqliteBoolean(true),
      conversationId,
      sentBeforeTimestamp,
    });

  return map(rows, row => jsonToObject(row.json));
}

function getUnreadDisappearingByConversation(conversationId: string, sentBeforeTimestamp: number) {
  const rows = assertGlobalInstance()
    .prepare(
      `SELECT * FROM ${MESSAGES_TABLE} WHERE
      unread = $unread AND expireTimer > 0 AND
      conversationId = $conversationId AND
      COALESCE(serverTimestamp, sent_at) <= $sentBeforeTimestamp
     ${orderByClauseASC};`
    )
    .all({
      unread: toSqliteBoolean(true),
      conversationId,
      sentBeforeTimestamp,
    });

  return map(rows, row => jsonToObject(row.json));
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
      .all({
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

function getUnreadCountByConversation(
  conversationId: string,
  instance?: BetterSqlite3.Database
): number {
  const row = assertGlobalInstanceOrInstance(instance)
    .prepare(
      `SELECT count(*) FROM ${MESSAGES_TABLE} WHERE
    unread = $unread AND
    conversationId = $conversationId;`
    )
    .get({
      unread: toSqliteBoolean(true),
      conversationId,
    });

  if (!row) {
    throw new Error(`Unable to get unread count of ${conversationId}`);
  }

  return row['count(*)'];
}

function getMessageCountByType(conversationId: string, type = '%') {
  const row = assertGlobalInstance()
    .prepare(
      `SELECT count(*) from ${MESSAGES_TABLE}
      WHERE conversationId = $conversationId
      AND type = $type;`
    )
    .get({
      conversationId,
      type,
    });

  if (!row) {
    throw new Error(
      `getIncomingMessagesCountByConversation: Unable to get incoming messages count of ${conversationId}`
    );
  }

  return row['count(*)'];
}

// Note: Sorting here is necessary for getting the last message (with limit 1)
// be sure to update the sorting order to sort messages on redux too (sortMessages)
const orderByClause = 'ORDER BY COALESCE(serverTimestamp, sent_at, received_at) DESC';
const orderByClauseASC = 'ORDER BY COALESCE(serverTimestamp, sent_at, received_at) ASC';

function getMessagesByConversation(
  conversationId: string,
  { messageId = null, returnQuotes = false } = {}
): { messages: Array<Record<string, any>>; quotes: Array<Quote> } {
  const absLimit = 30;
  // If messageId is given it means we are opening the conversation to that specific messageId,
  // or that we just scrolled to it by a quote click and needs to load around it.
  // If messageId is null, it means we are just opening the convo to the last unread message, or at the bottom
  const firstUnread = getFirstUnreadMessageIdInConversation(conversationId);

  const numberOfMessagesInConvo = getMessagesCountByConversation(conversationId);
  const floorLoadAllMessagesInConvo = 70;

  let messages: Array<Record<string, any>> = [];
  let quotes: Array<any> = [];

  if (messageId || firstUnread) {
    const messageFound = getMessageById(messageId || firstUnread);

    if (!messageFound || messageFound.conversationId !== conversationId) {
      console.info(
        `getMessagesByConversation: Could not find messageId ${messageId} in db with conversationId: ${conversationId}. Just fetching the convo as usual. messageFound:`,
        messageFound
      );
      return { messages, quotes };
    }
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

    const messagesBefore = assertGlobalInstance()
      .prepare(
        `SELECT id, conversationId, json
            FROM ${MESSAGES_TABLE} WHERE conversationId = $conversationId AND COALESCE(serverTimestamp, sent_at, received_at) <= $msgTimestamp
            ${orderByClause}
            LIMIT $limit`
      )
      .all(commonArgs);

    const messagesAfter = assertGlobalInstance()
      .prepare(
        `SELECT id, conversationId, json
            FROM ${MESSAGES_TABLE} WHERE conversationId = $conversationId AND COALESCE(serverTimestamp, sent_at, received_at) > $msgTimestamp
            ${orderByClauseASC}
            LIMIT $limit`
      )
      .all(commonArgs);

    console.info(`getMessagesByConversation around took ${Date.now() - start}ms `);

    // sorting is made in redux already when rendered, but some things are made outside of redux, so let's make sure the order is right
    messages = map([...messagesBefore, ...messagesAfter], row => jsonToObject(row.json)).sort(
      (a, b) => {
        return (
          (b.serverTimestamp || b.sent_at || b.received_at) -
          (a.serverTimestamp || a.sent_at || a.received_at)
        );
      }
    );
  } else {
    const limit =
      numberOfMessagesInConvo < floorLoadAllMessagesInConvo
        ? floorLoadAllMessagesInConvo
        : absLimit * 2;

    const rows = assertGlobalInstance()
      .prepare(
        `
    SELECT json FROM ${MESSAGES_TABLE} WHERE
      conversationId = $conversationId
      ${orderByClause}
    LIMIT $limit;
    `
      )
      .all({
        conversationId,
        limit,
      });

    messages = map(rows, row => jsonToObject(row.json));
  }

  if (returnQuotes) {
    quotes = uniq(messages.filter(message => message.quote).map(message => message.quote));
  }

  return { messages, quotes };
}

function getLastMessagesByConversation(conversationId: string, limit: number) {
  if (!isNumber(limit)) {
    throw new Error('limit must be a number');
  }

  const rows = assertGlobalInstance()
    .prepare(
      `
    SELECT json FROM ${MESSAGES_TABLE} WHERE
      conversationId = $conversationId
      ${orderByClause}
    LIMIT $limit;
    `
    )
    .all({
      conversationId,
      limit,
    });
  return map(rows, row => jsonToObject(row.json));
}

/**
 * This is the oldest message so we cannot reuse getLastMessagesByConversation
 */
function getOldestMessageInConversation(conversationId: string) {
  const rows = assertGlobalInstance()
    .prepare(
      `
    SELECT json FROM ${MESSAGES_TABLE} WHERE
      conversationId = $conversationId
      ${orderByClauseASC}
    LIMIT $limit;
    `
    )
    .all({
      conversationId,
      limit: 1,
    });
  return map(rows, row => jsonToObject(row.json));
}

function hasConversationOutgoingMessage(conversationId: string) {
  const row = assertGlobalInstance()
    .prepare(
      `
    SELECT count(*)  FROM ${MESSAGES_TABLE} WHERE
      conversationId = $conversationId AND
      type IS 'outgoing'
    `
    )
    .get({
      conversationId,
    });
  if (!row) {
    throw new Error('hasConversationOutgoingMessage: Unable to get count');
  }

  return Boolean(row['count(*)']);
}

function getFirstUnreadMessageIdInConversation(conversationId: string) {
  const rows = assertGlobalInstance()
    .prepare(
      `
    SELECT id FROM ${MESSAGES_TABLE} WHERE
      conversationId = $conversationId AND
      unread = $unread
      ORDER BY serverTimestamp ASC, serverId ASC, sent_at ASC, received_at ASC
    LIMIT 1;
    `
    )
    .all({
      conversationId,
      unread: toSqliteBoolean(true),
    });

  if (rows.length === 0) {
    return undefined;
  }
  return rows[0].id;
}

/**
 * Returns the last read message timestamp in the specific conversation (the columns `serverTimestamp` || `sent_at`)
 */
function getLastMessageReadInConversation(conversationId: string): number | null {
  const rows = assertGlobalInstance()
    .prepare(
      `
      SELECT MAX(MAX(COALESCE(serverTimestamp, 0)), MAX(COALESCE(sent_at, 0)) ) AS max_sent_at
      FROM ${MESSAGES_TABLE} WHERE
        conversationId = $conversationId AND
        unread = $unread;
    `
    )
    .get({
      conversationId,
      unread: toSqliteBoolean(false), // we want to find the message read with the higher sent_at timestamp
    });

  return rows?.max_sent_at || null;
}

function getFirstUnreadMessageWithMention(
  conversationId: string,
  instance?: BetterSqlite3.Database
): string | undefined {
  const ourPkInThatConversation = getUsBlindedInThatServerIfNeeded(conversationId, instance);

  if (!ourPkInThatConversation || !ourPkInThatConversation.length) {
    throw new Error('getFirstUnreadMessageWithMention needs our pubkey but nothing was given');
  }
  const likeMatch = `%@${ourPkInThatConversation}%`;

  // TODOLATER make this use the fts search table rather than this one?
  const rows = assertGlobalInstanceOrInstance(instance)
    .prepare(
      `
    SELECT id FROM ${MESSAGES_TABLE} WHERE
      conversationId = $conversationId AND
      unread = $unread AND
      body LIKE $likeMatch
      ORDER BY serverTimestamp ASC, serverId ASC, sent_at ASC, received_at ASC
    LIMIT 1;
    `
    )
    .all({
      conversationId,
      unread: toSqliteBoolean(true),
      likeMatch,
    });

  if (rows.length === 0) {
    return undefined;
  }
  return rows[0].id;
}

function getMessagesBySentAt(sentAt: number) {
  const rows = assertGlobalInstance()
    .prepare(
      `SELECT json FROM ${MESSAGES_TABLE}
     WHERE sent_at = $sent_at
     ORDER BY received_at DESC;`
    )
    .all({
      sent_at: sentAt,
    });

  return map(rows, row => jsonToObject(row.json));
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

function getSeenMessagesByHashList(hashes: Array<string>) {
  const fromSeenTableRows = assertGlobalInstance()
    .prepare(
      `SELECT * FROM ${SEEN_MESSAGE_TABLE} WHERE hash IN ( ${hashes.map(() => '?').join(', ')} );`
    )
    .all(hashes);

  const fromMessagesTableRows = compact(
    assertGlobalInstance()
      .prepare(
        `SELECT messageHash FROM ${MESSAGES_TABLE} WHERE messageHash IN ( ${hashes.map(() => '?').join(', ')} )`
      )
      .all(hashes)
  );

  const hashesFromSeen: Array<string> = map(fromSeenTableRows, row => row.hash);
  const hashesFromMessages: Array<string> = map(fromMessagesTableRows, row => row.messageHash);

  return uniq(hashesFromSeen.concat(hashesFromMessages));
}

function getExpiredMessages() {
  const now = Date.now();
  const rows = assertGlobalInstance()
    .prepare(
      `SELECT json FROM ${MESSAGES_TABLE} WHERE
      expires_at IS NOT NULL AND
      expires_at <= $expires_at
     ORDER BY expires_at ASC;`
    )
    .all({
      expires_at: now,
    });

  return map(rows, row => jsonToObject(row.json));
}

function cleanUpUnreadExpiredDaRMessages() {
  // we cannot rely on network offset here, so we need to trust the user clock
  const t14daysEarlier = Date.now() - 14 * DURATION.DAYS;
  const start = Date.now();
  const deleted = assertGlobalInstance()
    .prepare(
      `DELETE FROM ${MESSAGES_TABLE} WHERE
      expirationType = 'deleteAfterRead' AND
      unread = $unread AND
      sent_at <= $t14daysEarlier;`
    )
    .run({
      unread: toSqliteBoolean(true),
      t14daysEarlier,
    });
  console.info(
    `cleanUpUnreadExpiredDaRMessages: deleted ${
      deleted.changes
    } message(s) which were DaR and sent before ${t14daysEarlier} in ${Date.now() - start}ms`
  );
}

function getOutgoingWithoutExpiresAt() {
  const rows = assertGlobalInstance()
    .prepare(
      `
    SELECT json FROM ${MESSAGES_TABLE}
    WHERE
      expireTimer > 0 AND
      expires_at IS NULL AND
      type IS 'outgoing'
    ORDER BY expires_at ASC;
  `
    )
    .all();

  return map(rows, row => jsonToObject(row.json));
}

function getNextExpiringMessage() {
  const rows = assertGlobalInstance()
    .prepare(
      `
    SELECT json FROM ${MESSAGES_TABLE}
    WHERE expires_at > 0
    ORDER BY expires_at ASC
    LIMIT 1;
  `
    )
    .all();

  return map(rows, row => jsonToObject(row.json));
}

/* Unprocessed a received messages not yet processed */
const unprocessed: UnprocessedDataNode = {
  saveUnprocessed: (data: UnprocessedParameter) => {
    const { id, timestamp, version, attempts, envelope, senderIdentity, messageHash } = data;
    if (!id) {
      throw new Error(`saveUnprocessed: id was falsy: ${id}`);
    }

    assertGlobalInstance()
      .prepare(
        `INSERT OR REPLACE INTO unprocessed (
        id,
        timestamp,
        version,
        attempts,
        envelope,
        senderIdentity,
        serverHash
      ) values (
        $id,
        $timestamp,
        $version,
        $attempts,
        $envelope,
        $senderIdentity,
        $messageHash
      );`
      )
      .run({
        id,
        timestamp,
        version,
        attempts,
        envelope,
        senderIdentity,
        messageHash,
      });
  },

  updateUnprocessedAttempts: (id: string, attempts: number) => {
    assertGlobalInstance()
      .prepare('UPDATE unprocessed SET attempts = $attempts WHERE id = $id;')
      .run({
        id,
        attempts,
      });
  },

  updateUnprocessedWithData: (id: string, data: UnprocessedParameter) => {
    const { source, decrypted, senderIdentity } = data;

    assertGlobalInstance()
      .prepare(
        `UPDATE unprocessed SET
        source = $source,
        decrypted = $decrypted,
        senderIdentity = $senderIdentity
      WHERE id = $id;`
      )
      .run({
        id,
        source,
        decrypted,
        senderIdentity,
      });
  },

  getUnprocessedById: (id: string) => {
    const row = assertGlobalInstance().prepare('SELECT * FROM unprocessed WHERE id = $id;').get({
      id,
    });

    return row;
  },

  getUnprocessedCount: () => {
    const row = assertGlobalInstance().prepare('SELECT count(*) from unprocessed;').get();

    if (!row) {
      throw new Error('getMessageCount: Unable to get count of unprocessed');
    }

    return row['count(*)'];
  },

  getAllUnprocessed: () => {
    const rows = assertGlobalInstance()
      .prepare('SELECT * FROM unprocessed ORDER BY timestamp ASC;')
      .all();

    return rows;
  },

  removeUnprocessed: (id: string): void => {
    if (Array.isArray(id)) {
      console.error('removeUnprocessed only supports single ids at a time');
      throw new Error('removeUnprocessed only supports single ids at a time');
    }
    assertGlobalInstance().prepare('DELETE FROM unprocessed WHERE id = $id;').run({ id });
  },

  removeAllUnprocessed: () => {
    assertGlobalInstance().prepare('DELETE FROM unprocessed;').run();
  },
};

function getNextAttachmentDownloadJobs(limit: number) {
  const timestamp = Date.now();

  const rows = assertGlobalInstance()
    .prepare(
      `SELECT json FROM ${ATTACHMENT_DOWNLOADS_TABLE}
    WHERE pending = 0 AND timestamp < $timestamp
    ORDER BY timestamp DESC
    LIMIT $limit;`
    )
    .all({
      limit,
      timestamp,
    });

  return map(rows, row => jsonToObject(row.json));
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
  assertGlobalInstance()
    .prepare(`UPDATE ${ATTACHMENT_DOWNLOADS_TABLE} SET pending = 0 WHERE pending != 0;`)
    .run();
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
    DELETE FROM unprocessed;
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

function getMessagesWithVisualMediaAttachments(conversationId: string, limit?: number) {
  const rows = assertGlobalInstance()
    .prepare(
      `SELECT json FROM ${MESSAGES_TABLE} WHERE
      conversationId = $conversationId AND
      hasVisualMediaAttachments = 1
     ORDER BY received_at DESC
     LIMIT $limit;`
    )
    .all({
      conversationId,
      limit,
    });

  return map(rows, row => jsonToObject(row.json));
}

function getMessagesWithFileAttachments(conversationId: string, limit: number) {
  const rows = assertGlobalInstance()
    .prepare(
      `SELECT json FROM ${MESSAGES_TABLE} WHERE
      conversationId = $conversationId AND
      hasFileAttachments = 1
     ORDER BY received_at DESC
     LIMIT $limit;`
    )
    .all({
      conversationId,
      limit,
    });

  return map(rows, row => jsonToObject(row.json));
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
  const lookup = fromPairs(map(allAttachments, file => [file, true]));
  const chunkSize = 50;

  const total = getMessageCount();
  console.log(`removeKnownAttachments: About to iterate through ${total} messages`);

  let count = 0;
  let complete = false;
  let id = '';

  while (!complete) {
    const rows = assertGlobalInstance()
      .prepare(
        `SELECT json FROM ${MESSAGES_TABLE}
       WHERE id > $id
       ORDER BY id ASC
       LIMIT $chunkSize;`
      )
      .all({
        id,
        chunkSize,
      });

    const messages = map(rows, row => jsonToObject(row.json));
    forEach(messages, message => {
      const externalFiles = getExternalFilesForMessage(message);
      forEach(externalFiles, file => {
        delete lookup[file];
      });
    });

    const lastMessage = last(messages);
    if (lastMessage) {
      ({ id } = lastMessage);
    }
    complete = messages.length < chunkSize;
    count += messages.length;
  }

  console.log(`removeKnownAttachments: Done processing ${count} ${MESSAGES_TABLE}`);

  complete = false;
  count = 0;
  // Though conversations.id is a string, this ensures that, when coerced, this
  //   value is still a string but it's smaller than every other string.
  (id as any) = 0;

  const conversationTotal = getConversationCount();
  console.log(
    `removeKnownAttachments: About to iterate through ${conversationTotal} ${CONVERSATIONS_TABLE}`
  );

  while (!complete) {
    const conversations = assertGlobalInstance()
      .prepare(
        `SELECT * FROM ${CONVERSATIONS_TABLE}
       WHERE id > $id
       ORDER BY id ASC
       LIMIT $chunkSize;`
      )
      .all({
        id,
        chunkSize,
      });

    forEach(conversations, conversation => {
      const avatar = (conversation as ConversationAttributes)?.avatarInProfile;
      const externalFiles = getExternalFilesForConversation(avatar);
      forEach(externalFiles, file => {
        delete lookup[file];
      });
    });

    const lastMessage = last(conversations);
    if (lastMessage) {
      ({ id } = lastMessage);
    }
    complete = conversations.length < chunkSize;
    count += conversations.length;
  }

  console.log(`removeKnownAttachments: Done processing ${count} ${CONVERSATIONS_TABLE}`);

  return Object.keys(lookup);
}

function getMessagesCountByConversation(
  conversationId: string,
  instance?: BetterSqlite3.Database | null
): number {
  const row = assertGlobalInstanceOrInstance(instance)
    .prepare(`SELECT count(*) from ${MESSAGES_TABLE} WHERE conversationId = $conversationId;`)
    .get({ conversationId });

  return row ? row['count(*)'] : 0;
}

/**
 * Related to Opengroup V2
 */
function getAllV2OpenGroupRooms(instance?: BetterSqlite3.Database): Array<OpenGroupV2Room> {
  const rows = assertGlobalInstanceOrInstance(instance)
    .prepare(`SELECT json FROM ${OPEN_GROUP_ROOMS_V2_TABLE};`)
    .all();

  if (!rows) {
    return [];
  }

  return rows.map(r => jsonToObject(r.json)) as Array<OpenGroupV2Room>;
}

function getV2OpenGroupRoom(conversationId: string, db?: BetterSqlite3.Database) {
  const row = assertGlobalInstanceOrInstance(db)
    .prepare(
      `SELECT json FROM ${OPEN_GROUP_ROOMS_V2_TABLE} WHERE conversationId = $conversationId;`
    )
    .get({
      conversationId,
    });

  if (!row) {
    return null;
  }

  return jsonToObject(row.json);
}

function saveV2OpenGroupRoom(opengroupsV2Room: OpenGroupV2Room, instance?: BetterSqlite3.Database) {
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
  assertGlobalInstance()
    .prepare(`DELETE FROM ${OPEN_GROUP_ROOMS_V2_TABLE} WHERE conversationId = $conversationId`)
    .run({
      conversationId,
    });
}

/**
 * Others
 */

function getEntriesCountInTable(tbl: string) {
  try {
    const row = assertGlobalInstance().prepare(`SELECT count(*) from ${tbl};`).get();
    return row['count(*)'];
  } catch (e) {
    console.error(e);
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
    'messages_fts_content',
    'messages_fts_data',
    'messages_fts_docsize',
    'messages_fts_idx',
    'nodesForPubkey',
    'openGroupRoomsV2',
    'seenMessages',
    'sqlite_sequence',
    'sqlite_stat1',
    'sqlite_stat4',
    'unprocessed',
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
      .all()
      .map(m => m.id) || [];

  const allEntriesInSnodeForPubkey =
    assertGlobalInstance()
      .prepare(`SELECT pubkey FROM ${NODES_FOR_PUBKEY_TABLE};`)
      .all()
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

function cleanUpMessagesJson() {
  console.info('cleanUpMessagesJson ');
  const start = Date.now();
  assertGlobalInstance().transaction(() => {
    assertGlobalInstance().exec(`
      UPDATE ${MESSAGES_TABLE} SET
      json = json_remove(json, '$.schemaVersion', '$.recipients', '$.decrypted_at', '$.sourceDevice')
    `);
  })();

  console.info(`cleanUpMessagesJson took ${Date.now() - start}ms`);
}

function cleanUpOldOpengroupsOnStart() {
  const ourNumber = getItemById('number_id');
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

  const rows = assertGlobalInstance()
    .prepare(
      `SELECT id FROM ${CONVERSATIONS_TABLE} WHERE
      type = 'group' AND
      id LIKE 'http%'
     ORDER BY id ASC;`
    )
    .all();

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
        const countToRemove = assertGlobalInstance()
          .prepare(
            `SELECT count(*) from ${MESSAGES_TABLE} WHERE serverTimestamp <= $serverTimestamp AND conversationId = $conversationId;`
          )
          .get({ conversationId: convoId, serverTimestamp: limitTimestamp })['count(*)'];
        const start = Date.now();

        assertGlobalInstance()
          .prepare(
            `
        DELETE FROM ${MESSAGES_TABLE} WHERE serverTimestamp <= $serverTimestamp AND conversationId = $conversationId`
          )
          .run({ conversationId: convoId, serverTimestamp: limitTimestamp }); // delete messages older than 6 months ago.
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
    const allInactiveConvos = assertGlobalInstance()
      .prepare(
        `
    SELECT id FROM ${CONVERSATIONS_TABLE} WHERE type = 'private' AND (active_at IS NULL OR active_at = 0)`
      )
      .all();

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

    cleanUpMessagesJson();
  })();
}

export type SqlNodeType = typeof sqlNode;

export function close() {
  closeDbInstance();
}

export const sqlNode = {
  initializeSql,
  close,
  removeDB,
  setSQLPassword,

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

  searchConversations,
  searchMessages,
  searchMessagesInConversation,

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
  hasConversationOutgoingMessage,

  // add all the calls related to the unprocessed cache of incoming messages
  ...unprocessed,

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

  // open group v2
  getV2OpenGroupRoom,
  saveV2OpenGroupRoom,
  getAllV2OpenGroupRooms,
  removeV2OpenGroupRoom,

  // config dumps
  ...configDumpData,
};
