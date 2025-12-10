import { isNumber } from 'lodash/fp';
import { SettingsKey } from '../../data/settings-key';
import { Storage } from '../../util/storage';
import {
  ProRevocationItemsSchema,
  type ProRevocationItemsType,
} from '../apis/pro_backend_api/schemas';
import { Timestamp } from '../../types/timestamp/timestamp';
import { base64_variants, from_base64, to_hex } from 'libsodium-wrappers-sumo';

let cachedProRevocationListTicket = 0;
let cachedProRevocationListItems: ProRevocationItemsType = [];

function getTicket() {
  if (cachedProRevocationListTicket !== 0) {
    return cachedProRevocationListTicket;
  }
  const ticketFromDb = Storage.get(SettingsKey.proRevocationListTicket);

  const lastFetchTicket = isNumber(ticketFromDb) ? ticketFromDb : 0;
  if (!lastFetchTicket) {
    cachedProRevocationListTicket = lastFetchTicket;
  }
  return lastFetchTicket;
}

async function setTicket(ticket: number) {
  cachedProRevocationListTicket = ticket;
  await Storage.put(SettingsKey.proRevocationListTicket, ticket);
}

async function getListItems(): Promise<ProRevocationItemsType> {
  if (cachedProRevocationListItems.length) {
    return cachedProRevocationListItems;
  }
  const itemsFromDb = Storage.get(SettingsKey.proRevocationListItems);

  if (!itemsFromDb) {
    cachedProRevocationListItems = [];
    return cachedProRevocationListItems;
  }
  const parsed = ProRevocationItemsSchema.safeParse(itemsFromDb);
  if (parsed.success) {
    cachedProRevocationListItems = parsed.data;
    return cachedProRevocationListItems;
  }
  window.log.error(
    'failed to parse pro revocation list items from storage, removing item. error:',
    parsed.error
  );
  await Storage.remove(SettingsKey.proRevocationListItems);
  cachedProRevocationListItems = [];
  return cachedProRevocationListItems;
}

async function setListItems(items: ProRevocationItemsType) {
  cachedProRevocationListItems = items;
  await Storage.put(SettingsKey.proRevocationListItems, JSON.stringify(items));
}

function clear() {
  cachedProRevocationListTicket = 0;
  cachedProRevocationListItems = [];
}

function isB64HashRevokedAtMs(genIndexHashBase64: string, ms: number) {
  const asHex = to_hex(from_base64(genIndexHashBase64, base64_variants.ORIGINAL));
  const found = cachedProRevocationListItems.find(m => m.gen_index_hash === asHex);
  if (!found) {
    return false;
  }
  const revokedAtMs = found.expiry_unix_ts_ms;
  const ts = new Timestamp({ value: ms, expectedUnit: 'ms' });
  return ts.isAfterMs({ ms: revokedAtMs });
}

export const ProRevocationCache = {
  getTicket,
  setTicket,
  getListItems,
  setListItems,
  clear,
  isB64HashRevokedAtMs,
};
