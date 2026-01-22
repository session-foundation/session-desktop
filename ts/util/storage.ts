import { isBoolean, isFinite, isNil, isNumber } from 'lodash';
import { SessionKeyPair } from '../receiver/keypairs';
import { DEFAULT_RECENT_REACTS } from '../session/constants';
import { deleteSettingsBoolValue, updateSettingsBoolValue } from '../state/ducks/settings';
import { Data } from '../data/data';
import { SettingsKey } from '../data/settings-key';
import { ProProofResultType, ProDetailsResultType } from '../session/apis/pro_backend_api/schemas';
import { UrlInteractionsType } from './urlHistory';
import { updateStorageSchema } from './storageMigrations';
import { CtaInteractionsType } from './ctaHistory';

let ready = false;

// TODO: Add dynamic typing, this should be done as part of the settings refactor
type ValueType =
  | string
  | number
  | boolean
  | SessionKeyPair
  | Array<string>
  | UrlInteractionsType
  | CtaInteractionsType
  | ProDetailsResultType
  | ProProofResultType;
type InsertedValueType = { id: string; value: ValueType };
let items: Record<string, InsertedValueType>;
let callbacks: Array<() => void> = [];

reset();

async function put(key: string, value: ValueType) {
  if (value === undefined) {
    throw new Error('Tried to store undefined');
  }
  if (!ready) {
    window.log.warn('Called storage.put before storage is ready. key:', key);
  }

  const data: InsertedValueType = { id: key, value };

  items[key] = data;
  await Data.createOrUpdateItem(data);

  if (isBoolean(value)) {
    window?.inboxStore?.dispatch(updateSettingsBoolValue({ id: key, value }));
  }
}

/**
 * Increment the counter stored in the specified key.
 * If the existing value is null or undefined, it will be set to 1.
 * If the existing value is set but not a number, nothing will be done.
 */
async function increment(
  key: typeof SettingsKey.proLongerMessagesSent | typeof SettingsKey.proBadgesSent
) {
  const value = get(key);
  if (isNil(value)) {
    await put(key, 1);

    return;
  }

  if (isNumber(value) && isFinite(value)) {
    await put(key, value + 1);

    return;
  }
  window.log.debug('increment: value is not a number or null/undefined');
}

function get(key: string, defaultValue?: ValueType) {
  if (!ready) {
    window.log.warn('Called storage.get before storage is ready. key:', key);
  }

  const item = items[key];
  if (!item) {
    return defaultValue;
  }

  return item.value;
}

async function remove(key: string) {
  if (!ready) {
    window.log.warn('Called storage.remove before storage is ready. key:', key);
  }

  delete items[key];

  window?.inboxStore?.dispatch(deleteSettingsBoolValue(key));

  await Data.removeItemById(key);
}

function onready(callback: () => void) {
  if (ready) {
    callback();
  } else {
    callbacks.push(callback);
  }
}

function callListeners() {
  if (ready) {
    callbacks.forEach(callback => {
      callback();
    });
    callbacks = [];
  }
}

async function fetch() {
  reset();
  const array = await Data.getAllItems();

  for (let i = 0, max = array.length; i < max; i += 1) {
    const item = array[i];
    const { id } = item;
    items[id] = item;
  }

  ready = true;
  await updateStorageSchema();

  callListeners();
}

function reset() {
  ready = false;
  items = Object.create(null);
}

function getBoolOr(settingsKey: string, fallback: boolean): boolean {
  const got = Storage.get(settingsKey, fallback);
  if (isBoolean(got)) {
    return got;
  }
  return fallback;
}

export async function setLocalPubKey(pubkey: string) {
  await put(SettingsKey.numberId, `${pubkey}.1`);
}

export function getOurPubKeyStrFromStorage() {
  const numberId = get(SettingsKey.numberId) as string | undefined;
  if (numberId === undefined) {
    return undefined;
  }
  return numberId.split('.')[0];
}

export function isSignInByLinking() {
  const isByLinking = get('is_sign_in_by_linking');
  if (isByLinking === undefined) {
    return false;
  }
  return isByLinking;
}

/** this is a loading state to prevent config sync jobs while we are trying to sign in through link a device. It should be set to false after the linking is complete */
export async function setSignInByLinking(isLinking: boolean) {
  await put('is_sign_in_by_linking', isLinking);
}

/** if we sign in with an existing recovery password, then we don't need to show any of the onboarding ui once we login
 */
export function isSignWithRecoveryPhrase() {
  const isRecoveryPhraseUsed = get('is_sign_in_recovery_phrase');
  if (isRecoveryPhraseUsed === undefined) {
    return false;
  }
  return isRecoveryPhraseUsed;
}

export async function setSignWithRecoveryPhrase(isRecoveryPhraseUsed: boolean) {
  await put('is_sign_in_recovery_phrase', isRecoveryPhraseUsed);
}

export function getCurrentRecoveryPhrase() {
  return Storage.get('mnemonic') as string;
}

export async function saveRecoveryPhrase(mnemonic: string) {
  return Storage.put('mnemonic', mnemonic);
}

export function getRecentReactions(): Array<string> {
  const reactions = Storage.get('recent_reactions') as string;
  if (reactions) {
    return reactions.split(' ');
  }
  return DEFAULT_RECENT_REACTS;
}

export async function saveRecentReactions(reactions: Array<string>) {
  return Storage.put('recent_reactions', reactions.join(' '));
}

export function getPasswordHash() {
  return Storage.get('passHash') as string;
}

export function getStorageSchemaVersion(): number {
  const version = Storage.get('storage_version');
  if (!version || typeof version !== 'number') {
    return 0;
  }
  return version;
}

export async function setStorageSchemaVersion(version: number) {
  await Storage.put('storage_version', version);
}

export const Storage = { fetch, put, get, getBoolOr, remove, onready, reset, increment };
