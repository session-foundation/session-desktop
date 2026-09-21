/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

import { app } from 'electron';

/**
 * Multi-account support.
 *
 * Session keeps one account per *data directory*: the SQLCipher database, the libsession user
 * config, the attachments and the settings are all rooted at `app.getPath('userData')`, and the
 * renderer has a single store and a single snode poller for whichever account that directory
 * holds. Rather than pretending one process can hold several of those, each account gets its own
 * data directory and its own process — so every account is genuinely live at the same time, with
 * its own polling and its own notifications.
 *
 * This module owns the registry of accounts and the mapping from an account to its data
 * directory. It runs *before* anything else touches `userData`, so it must not import anything
 * which reads a config.
 */

export type AccountEntry = {
  /** stable id, also the data-directory suffix for every account but the first */
  id: string;
  /** what the user calls it; defaults to the account's Session display name once known */
  label: string;
  /**
   * The legacy account (`isDefault`) keeps the data directory Session has always used, so an
   * existing install keeps its account when this feature appears.
   */
  isDefault: boolean;
  /** run this account in the background when another one is launched */
  runInBackground: boolean;
  createdAt: number;
  lastUsedAt: number;
  /** filled in by the renderer once the account is logged in; null while it is still onboarding */
  sessionId: string | null;
  displayName: string | null;
};

type Registry = {
  version: 1;
  activeId: string;
  accounts: Array<AccountEntry>;
};

export const PROFILE_ARG_PREFIX = '--profile=';
export const BACKGROUND_ARG = '--session-background';
export const SPAWNED_SIBLING_ARG = '--session-spawned-sibling';

/**
 * The storage profile Session would use without multi-account: empty for a packaged production
 * build, `<env>[-<NODE_APP_INSTANCE>]` otherwise. Every account's directory is derived from it, so
 * a dev instance keeps its own independent set of accounts.
 */
function getBaseStorageProfile(): string {
  const { NODE_ENV: environment, NODE_APP_INSTANCE: instance } = process.env;
  const isValidInstance = typeof instance === 'string' && instance.length > 0;
  const isProduction = environment === 'production' && !isValidInstance;

  if (isProduction) {
    return '';
  }
  return isValidInstance ? `${environment || ''}-${instance}` : environment || '';
}

const baseStorageProfile = getBaseStorageProfile();

function getRegistryPath(): string {
  const name = baseStorageProfile
    ? `Session-accounts-${baseStorageProfile}.json`
    : 'Session-accounts.json';
  return path.join(app.getPath('appData'), name);
}

function newAccountId(): string {
  return crypto.randomBytes(6).toString('hex');
}

function defaultRegistry(): Registry {
  const now = Date.now();
  const first: AccountEntry = {
    id: 'default',
    label: 'Account 1',
    isDefault: true,
    runInBackground: true,
    createdAt: now,
    lastUsedAt: now,
    sessionId: null,
    displayName: null,
  };
  return { version: 1, activeId: first.id, accounts: [first] };
}

/**
 * Only a fallback for when the file cannot be read, never an optimisation.
 *
 * Every account is a separate process reading and writing this one file, so a process which
 * remembered the registry would be working from its own start-up snapshot: its switcher would
 * never show an account added elsewhere, and - worse - the next whole-object write it made would
 * erase accounts added since. Reads go to disk. The file is a few hundred bytes and is read on
 * user actions, not in a loop.
 */
let lastKnownRegistry: Registry | null = null;

export function readRegistry(): Registry {
  const registryPath = getRegistryPath();
  try {
    if (fs.existsSync(registryPath)) {
      const parsed = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
      if (parsed && Array.isArray(parsed.accounts) && parsed.accounts.length) {
        lastKnownRegistry = parsed as Registry;
        return lastKnownRegistry;
      }
    }
  } catch (e) {
    console.error(`accounts: could not read ${registryPath}`, e);
    if (lastKnownRegistry) {
      // better to carry on with what we last saw than to invent a fresh registry over the top
      return lastKnownRegistry;
    }
  }
  const fresh = defaultRegistry();
  writeRegistry(fresh);
  return fresh;
}

export function writeRegistry(registry: Registry) {
  lastKnownRegistry = registry;
  const registryPath = getRegistryPath();
  try {
    // write-then-rename so a crash mid-write cannot leave a truncated registry behind
    const tmp = `${registryPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(registry, null, 2), 'utf8');
    fs.renameSync(tmp, registryPath);
  } catch (e) {
    console.error(`accounts: could not write ${registryPath}`, e);
  }
}

/**
 * The `Session-…` directory name for an account. The default account keeps whatever Session
 * already used, which is how an existing install keeps its data.
 */
export function storageProfileFor(account: AccountEntry): string {
  if (account.isDefault) {
    return baseStorageProfile;
  }
  return baseStorageProfile ? `${baseStorageProfile}-acct-${account.id}` : `acct-${account.id}`;
}

export function userDataPathFor(account: AccountEntry): string {
  const storageProfile = storageProfileFor(account);
  if (!storageProfile) {
    // Electron's own default: appData/<productName>
    return path.join(app.getPath('appData'), 'Session');
  }
  return path.join(app.getPath('appData'), `Session-${storageProfile}`);
}

function accountIdFromArgv(): string | null {
  const arg = process.argv.find(a => a.startsWith(PROFILE_ARG_PREFIX));
  if (arg) {
    return arg.slice(PROFILE_ARG_PREFIX.length) || null;
  }
  return process.env.SESSION_PROFILE || null;
}

/**
 * Which account this process is running. Resolution order: an explicit `--profile=<id>` (that is
 * how the switcher launches an account), then `SESSION_PROFILE`, then the registry's active id,
 * then the first account.
 */
export function resolveSelectedAccount(): AccountEntry {
  const registry = readRegistry();
  const requested = accountIdFromArgv();

  const found =
    (requested && registry.accounts.find(a => a.id === requested)) ||
    registry.accounts.find(a => a.id === registry.activeId) ||
    registry.accounts[0];

  return found;
}

let selectedAccount: AccountEntry | null = null;

/**
 * Which account *this* process is. Memoized deliberately: another process rewriting `activeId`
 * must never change who we are half way through our own lifetime.
 */
export function getSelectedAccount(): AccountEntry {
  if (!selectedAccount) {
    selectedAccount = resolveSelectedAccount();
  }
  return selectedAccount;
}

export function isBackgroundLaunch(): boolean {
  return process.argv.includes(BACKGROUND_ARG);
}

export function isSpawnedSibling(): boolean {
  return process.argv.includes(SPAWNED_SIBLING_ARG);
}

// --- registry mutations -----------------------------------------------------------------

export function listAccounts(): Array<AccountEntry> {
  return readRegistry().accounts;
}

export function markAccountUsed(id: string) {
  const registry = readRegistry();
  const account = registry.accounts.find(a => a.id === id);
  if (!account) {
    return;
  }
  account.lastUsedAt = Date.now();
  registry.activeId = id;
  writeRegistry(registry);
}

export function addAccount(label?: string): AccountEntry {
  const registry = readRegistry();
  const now = Date.now();
  const account: AccountEntry = {
    id: newAccountId(),
    label: label || `Account ${registry.accounts.length + 1}`,
    isDefault: false,
    runInBackground: true,
    createdAt: now,
    lastUsedAt: 0,
    sessionId: null,
    displayName: null,
  };
  registry.accounts.push(account);
  writeRegistry(registry);
  return account;
}

export function renameAccount(id: string, label: string) {
  const registry = readRegistry();
  const account = registry.accounts.find(a => a.id === id);
  if (!account) {
    return;
  }
  account.label = label;
  writeRegistry(registry);
}

export function setAccountRunInBackground(id: string, runInBackground: boolean) {
  const registry = readRegistry();
  const account = registry.accounts.find(a => a.id === id);
  if (!account) {
    return;
  }
  account.runInBackground = runInBackground;
  writeRegistry(registry);
}

/**
 * Forgets an account. Deliberately does NOT delete its data directory: dropping someone's messages
 * and keys because they tidied a list is not a recoverable mistake. The directory is returned so
 * the caller can tell the user where it is.
 */
export function forgetAccount(id: string): { removed: boolean; dataDir: string | null } {
  const registry = readRegistry();
  const account = registry.accounts.find(a => a.id === id);
  if (!account || account.isDefault || registry.accounts.length <= 1) {
    return { removed: false, dataDir: null };
  }
  const dataDir = userDataPathFor(account);
  registry.accounts = registry.accounts.filter(a => a.id !== id);
  if (registry.activeId === id) {
    registry.activeId = registry.accounts[0].id;
  }
  writeRegistry(registry);
  return { removed: true, dataDir };
}

export function updateAccountMeta(
  id: string,
  meta: { sessionId?: string | null; displayName?: string | null }
) {
  const registry = readRegistry();
  const account = registry.accounts.find(a => a.id === id);
  if (!account) {
    return;
  }
  if (meta.sessionId !== undefined) {
    account.sessionId = meta.sessionId;
  }
  if (meta.displayName !== undefined) {
    account.displayName = meta.displayName;
    // only auto-label an account the user has not named themselves
    if (meta.displayName && /^Account \d+$/.test(account.label)) {
      account.label = meta.displayName;
    }
  }
  writeRegistry(registry);
}
