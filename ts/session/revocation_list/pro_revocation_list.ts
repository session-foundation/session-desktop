import { isArray, isNumber, isString } from 'lodash';
import { SettingsKey } from '../../data/settings-key';
import { Storage } from '../../util/storage';
import {
  ProRevocationItemsDBSchema,
  type ProRevocationItemsDBType,
} from '../apis/pro_backend_api/schemas';
import { NetworkTime } from '../../util/NetworkTime';

let initialFetchFromDBDone = false;
let cachedProRevocationListTicket = 0;
let cachedProRevocationListItems: ProRevocationItemsDBType = [];

async function loadFromDbIfNeeded() {
  if (initialFetchFromDBDone) {
    // do nothing
    return;
  }

  const ticketFromDb = Storage.get(SettingsKey.proRevocationListTicket);
  cachedProRevocationListTicket = isNumber(ticketFromDb) ? ticketFromDb : 0;

  const itemsFromDb = Storage.get(SettingsKey.proRevocationListItems);

  const resetItems: ProRevocationItemsDBType = [];
  if (!isString(itemsFromDb) || !itemsFromDb) {
    // reset the cache and the DB entry manually (not calling setListItems here)
    await Storage.put(SettingsKey.proRevocationListItems, JSON.stringify(resetItems));
    cachedProRevocationListItems = resetItems;
  } else {
    const parsedJsonItems = JSON.parse(itemsFromDb);
    if (!isArray(parsedJsonItems)) {
      await Storage.put(SettingsKey.proRevocationListItems, JSON.stringify(resetItems));
      cachedProRevocationListItems = resetItems;
    } else {
      const parsed = ProRevocationItemsDBSchema.safeParse(parsedJsonItems);

      if (parsed.success) {
        cachedProRevocationListItems = parsed.data;
      } else {
        window.log.error(
          'failed to parse pro revocation list items from storage, resetting to []. error:',
          parsed.error
        );
        await Storage.put(SettingsKey.proRevocationListItems, JSON.stringify(resetItems));
        cachedProRevocationListItems = resetItems;
      }
    }
  }

  initialFetchFromDBDone = true;
}

function assertInitialFetchFromDBDone(ctx: string) {
  if (!initialFetchFromDBDone) {
    throw new Error(`ProRevocationCache.loadFromDbIfNeeded() was not called before ctx: ${ctx}.`);
  }
}

function getTicket() {
  assertInitialFetchFromDBDone('getTicket');

  return cachedProRevocationListTicket;
}

async function setTicket(ticket: number) {
  assertInitialFetchFromDBDone('setTicket');

  cachedProRevocationListTicket = ticket;
  await Storage.put(SettingsKey.proRevocationListTicket, ticket);
}

async function getListItems(): Promise<ProRevocationItemsDBType> {
  assertInitialFetchFromDBDone('getListItems');

  return cachedProRevocationListItems;
}

async function setListItems(items: ProRevocationItemsDBType) {
  assertInitialFetchFromDBDone('setListItems');

  await Storage.put(SettingsKey.proRevocationListItems, JSON.stringify(items));
  cachedProRevocationListItems = items;
}

/**
 * Clear the cache only (not what is stored in the database)
 */
function clear() {
  cachedProRevocationListTicket = 0;
  cachedProRevocationListItems = [];
  initialFetchFromDBDone = false;
}

/**
 * Returns true if the hash is effectively revoked.
 * That is, if the hash is present in the revocation list,
 * and has an `effective_unix_ts_ms` that is in the past (network time).
 */
function isB64HashEffectivelyRevoked(genIndexHashBase64: string) {
  assertInitialFetchFromDBDone('isB64HashEffectivelyRevoked');

  const found = cachedProRevocationListItems.find(m => m.gen_index_hash_b64 === genIndexHashBase64);

  return !!found && NetworkTime.now() >= found.effective_unix_ts_ms;
}

export const ProRevocationCache = {
  getTicket,
  setTicket,
  getListItems,
  setListItems,
  clear,
  isB64HashEffectivelyRevoked,
  loadFromDbIfNeeded,
};
