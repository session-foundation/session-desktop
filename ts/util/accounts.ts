import { ipcRenderer } from 'electron';

export type AccountSummary = {
  id: string;
  label: string;
  displayName: string | null;
  sessionId: string | null;
  isDefault: boolean;
  /** keep this account's process running when another account is launched */
  runInBackground: boolean;
  lastUsedAt: number;
  /** true for the account this window belongs to */
  isCurrent: boolean;
};

export type AccountsResult = { currentId: string; accounts: Array<AccountSummary> };

export async function getAccounts(): Promise<AccountsResult> {
  return ipcRenderer.invoke('get-accounts');
}

/**
 * Bring an account to the front, starting it if it is not running yet.
 *
 * Both cases are the same call: launching an account whose process already exists cannot start a
 * second copy, because Electron's single-instance lock is per data directory — the new process
 * hands its arguments to the running one, which focuses its window, and then exits.
 */
export async function switchToAccount(accountId: string): Promise<boolean> {
  return ipcRenderer.invoke('switch-account', accountId);
}

/**
 * Register a new account and open it. The new window starts at onboarding, where the user creates
 * or restores a Session account as usual.
 */
export async function addAccount(label?: string): Promise<{ id: string; label: string }> {
  return ipcRenderer.invoke('add-account', label);
}

export async function renameAccount(accountId: string, label: string): Promise<boolean> {
  return ipcRenderer.invoke('rename-account', accountId, label);
}

export async function setAccountRunInBackground(
  accountId: string,
  value: boolean
): Promise<boolean> {
  return ipcRenderer.invoke('set-account-run-in-background', accountId, value);
}

/**
 * Removes an account from the switcher. Its data directory is left on disk and returned, because
 * throwing away someone's messages and keys as a side effect of tidying a list is not recoverable.
 */
export async function forgetAccount(
  accountId: string
): Promise<{ removed: boolean; dataDir: string | null; reason?: string }> {
  return ipcRenderer.invoke('forget-account', accountId);
}

/**
 * Tell the main process who is logged in here. The renderer is the only side that knows, and this
 * is what puts a real name and Account ID next to each entry in the switcher.
 */
export async function reportAccountIdentity(meta: {
  sessionId?: string;
  displayName?: string;
}): Promise<boolean> {
  return ipcRenderer.invoke('update-account-meta', meta);
}

/**
 * Keep the account registry's copy of "who is signed in here" up to date.
 *
 * Deliberately not a React hook: this is not UI, it is a once-per-process side effect, and the
 * renderer's store is the only place the answer lives. Called from the renderer's start-up, it
 * reports the current identity and then only again when it actually changes.
 */
export function startReportingAccountIdentity() {
  let lastReported = '';

  const report = () => {
    const state = window.inboxStore?.getState();
    const sessionId: string | undefined = state?.user?.ourNumber;
    if (!sessionId) {
      return;
    }
    const displayName: string | undefined = state?.user?.ourDisplayNameInProfile || undefined;
    const key = `${sessionId}|${displayName || ''}`;
    if (key === lastReported) {
      return;
    }
    lastReported = key;
    void reportAccountIdentity({ sessionId, displayName });
  };

  report();
  window.inboxStore?.subscribe(report);
}
