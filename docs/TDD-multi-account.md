# TDD — Session Desktop: multiple accounts, all of them live

- **Document**: `docs/TDD-multi-account.md`
- **Version**: 1.0
- **Date**: 2026-09-20
- **Branch**: `feature/call-fullscreen-and-screenshare`
- **Status**: implemented; §5 records what was verified and what was not.

---

## 1. Problem statement

Session Desktop holds exactly one account, and the constraint is not in one place:

| Singleton | Where |
|---|---|
| SQLCipher database, attachments, settings | rooted at `app.getPath('userData')` (`ts/node/sql.ts`, `ts/node/config/user_config.ts`) |
| Redux store | one `window.inboxStore` |
| Our identity | one `UserUtils.getOurPubKeyStrFromCache()`, one libsession user config |
| Swarm polling / notifications | one poller per renderer |

A per-environment data directory already exists (`NODE_APP_INSTANCE`), but it is developer
plumbing, not a feature: `ts/node/config.ts` **forces `NODE_APP_INSTANCE = ''` when the app is
packaged**, so a shipped Session can only ever use one directory.

**The goal**: an account switcher, with *all accounts active* — not one live account and several
parked ones.

## 2. Requirements

| ID | Requirement | Verified by |
|---|---|---|
| R1 | A user can register several accounts and move between them from inside the app | V4, V5 |
| R2 | **Every account is live at the same time** — receiving messages and raising notifications even when its window is not the one on screen | V6 |
| R3 | Accounts are fully isolated: separate database, keys, settings, attachments | V2 |
| R4 | An existing install keeps its account, unchanged, with no migration step | V1 |
| R5 | Two processes must never open one account's database | V3 |
| R6 | Selecting an account that is already running brings its window forward rather than starting a second copy | V3, V5 |
| R7 | Removing an account from the list must not destroy its data | design §3.5 |

Out of scope, stated rather than silently dropped: a **unified inbox** (one window listing every
account's conversations). That needs the singletons in §1 to become per-account inside a single
process — a rewrite of Session's core, not a feature on top of it.

## 3. Design

### 3.1 One account, one data directory, one process

Since an account *is* a data directory as far as Session is concerned, each account gets its own
directory and its own process. Every account therefore has a real, running Session behind it: its
own poller, its own database, its own notifications. That is what makes "all active" true rather
than a claim.

The cost, stated plainly: N accounts means N processes and N windows, and memory scales with it.
The benefit is that nothing in Session's core has to be made re-entrant for this to be correct.

### 3.2 The registry — `ts/node/config/profiles.ts`

A JSON file beside the data directories (`<appData>/Session-accounts.json`, suffixed per dev
instance) holding `{ version, activeId, accounts[] }`. Each account records its id, label,
`runInBackground`, timestamps, and — once the renderer reports them — its Session ID and display
name.

Directory mapping:

- the **first** account is `isDefault` and resolves to the directory Session already used, which
  is how R4 is satisfied: an existing install finds its account exactly where it left it, and the
  registry is created around it on first run;
- every other account gets `Session-[<base>-]acct-<id>`.

`<base>` is the storage profile Session would have used anyway (empty when packaged), so a dev
instance keeps its own independent set of accounts rather than colliding with another.

This module runs **before** anything reads a config — `ts/node/config/user_config.ts` imports it
to decide `app.setPath('userData', …)` — so it must not import anything that reads a config.

Selection order: `--profile=<id>` → `SESSION_PROFILE` → the registry's `activeId` → the first
account. Only a **foreground** launch updates `activeId`, so an account started in the background
on someone else's behalf cannot change which account opens by default.

**The registry is read from disk on every read, never cached.** With one process per account, a
process that remembered the registry would work from its own start-up snapshot: its switcher would
never show an account added elsewhere, and its next whole-object write would erase accounts added
since — a cross-process lost update, and one that can happen without anyone touching the UI,
because `update-account-meta` writes as soon as a background account finishes loading. The file is
a few hundred bytes and is read on user actions, not in a loop. Atomic write-then-rename keeps each
write whole; the residual simultaneous-write window does not justify a lock at this frequency.

Which account *this process is* stays memoized: another process rewriting `activeId` must never
change who we are half way through our own lifetime.

### 3.3 Switching is launching (R6)

Electron's single-instance lock lives in the user-data directory. Because every account has its
own directory, the lock is **per account**, and the two operations collapse into one:

```
switch to account X  ==  spawn(process.execPath, [...argv, --profile=X])
```

- X not running → the new process starts it.
- X already running → the new process cannot take X's lock, hands its arguments to the running
  instance (`second-instance`, which calls `showWindow()`), and exits.

No custom IPC bus between accounts is needed, and there is no way to end up with two processes on
one database.

**R5 required a fix to existing code.** `main_node.ts` only quit on a failed lock when
`NODE_APP_INSTANCE === 0`, an escape hatch so developers could run several copies. With
per-account directories that exemption is both unnecessary (different instances already get
different directories) and unsafe (two processes could open one account's SQLCipher database). It
is removed: a failed lock now always exits. This was **found by testing, not by reading** — see
§5.

### 3.4 "All active" (R2)

Whichever instance the user launched starts every other account marked `runInBackground`, staggered
by 1.5s so N databases do not open at once. Spawned siblings carry `--session-spawned-sibling` and
never fan out again, so there is no spawn storm.

A background account is launched with `--session-background`, which creates its window with
`show: false` and registers the tray icon. It is a complete, running Session — polling,
receiving, notifying — that simply is not in your face. Bringing it forward is the same
"switching is launching" path as everything else.

### 3.5 Removing an account (R7)

"Remove from this list" forgets the account in the registry and **leaves its data directory on
disk**, returning the path so the UI can say where it is. Deleting someone's messages and keys as
a side effect of tidying a list is not a recoverable mistake, so it is not something this feature
does. The current account and the default account cannot be forgotten.

### 3.6 UI

- A **people** icon in the left action panel (`data-testid="accounts-section"`) opens the account
  switcher.
- `ts/components/dialog/AccountSwitcherModal.tsx` lists every account with its display name and a
  truncated Account ID, marks the current one "This window", and offers rename, a "Background"
  toggle, "Remove from this list", and "Add account".
- "Add account" registers an account and opens it; the new window starts at Session's normal
  onboarding, where the user creates or restores an account as usual.

### 3.7 Labelling accounts

Only the renderer knows who is signed in. `startReportingAccountIdentity()`
(`ts/util/accounts.ts`, called from the renderer's start-up) subscribes to the store and reports
the Session ID and display name over IPC whenever they change. The registry auto-labels an account
from its display name unless the user has named it themselves.

Deliberately not a React hook: it is a once-per-process side effect, not UI. (It was a hook first;
the React Compiler pass in this repo's build rejected it.)

### 3.8 Strings

English-only constants with `TODO(l10n)`, for the same reason as the call work:
`session-localization` is a separate repository this fork does not own.

## 4. Verification plan

| ID | What | Pass criterion |
|---|---|---|
| V0 | Build, lint, tests | `pnpm build` 0, `pnpm lint` clean, `pnpm test` no new failures |
| V1 | Existing install keeps its account (R4) | first launch after the change opens the same data directory, with the same account |
| V2 | Isolation (R3) | a second account gets its own directory and its own Session ID |
| V3 | No double-open (R5, R6) | launching an already-running account logs that it is already running and exits 0, leaving one process |
| V4 | Switcher lists accounts (R1) | both accounts shown with real display names and Account IDs, current one marked |
| V5 | Switching (R1, R6) | selecting a background account makes its window visible, with no new process |
| V6 | **All active** (R2) | a message sent to an account whose window is hidden, while a *different* account is on screen, arrives at the hidden one |
| V7 | Registry is shared, not per-process (§3.2) | an account added in one window is visible to another **without restarting it**, and an older process writing its identity does not erase it |
| V8 | Forgetting keeps data (R7) | the account leaves the list; its data directory is still on disk |

## 5. Observations

Observed on **2026-09-20**, macOS (Darwin 27.0.0), Electron 40, running throwaway Session accounts
against the real Session network. The app was driven through the Chrome DevTools Protocol and the
Electron main process through the Node inspector, so these are readings, not assertions.

| ID | Result | Evidence |
|---|---|---|
| V0 | **PASS** | build exit 0, lint clean, 961 passing / 0 failing |
| V1 | **PASS** | first launch: `userData: …/Session-production-devprod1 (account default)` — the pre-existing directory — and the registry created itself around it, auto-labelled itself from that account's live display name and Session ID |
| V2 | **PASS** | the second account got its own `Session-…-acct-<id>` directory and its own Session ID, distinct from the first |
| V3 | **PASS** | launching an already-running account: `quitting; this account is already running in another process`, exit 0, one process left for that account |
| V4 | **PASS** | the switcher listed both accounts by display name with truncated Account IDs, the current one badged "This window" |
| V5 | **PASS** | the background account's window read `isVisible: false` from the main process; clicking its row in the switcher flipped it to `isVisible: true`, with no additional process |
| V6 | **PASS** | with one account on screen and another's window hidden, a third account sent "background delivery test" to the hidden one: its instance showed `unreadCount: 1` and that message as its last message |
| V7 | **PASS** | two accounts running; a third added from window A appeared in window B's `get-accounts` without B restarting; B — which had started before that account existed — then wrote its identity, and the third account was still in the registry on disk afterwards |
| V8 | **PASS** | forgetting an account returned `removed: true` with its data directory path, the list dropped to two, and the directory was still present on disk |

### Two real defects found after the first pass

**The registry was cached per process.** `readRegistry()` memoized the file, so each process worked
from its start-up snapshot. Two consequences, neither of which the first round of testing could
have caught because only one window ever opened the switcher: a stale account list, and — because
every mutation writes the whole object — an account added in one window being erased by an older
process's next write. Reads now go to disk; see §3.2 and V7.

**The first duplicate-launch attempt did not exit**: two processes ran against one account's data
Two processes ran against one account's data directory. The cause was the pre-existing
`NODE_APP_INSTANCE !== 0` exemption in the single-instance check (§3.3). Reading the code had not
shown it, because the exemption was harmless when every dev instance had its own directory by
construction. Fixed, and re-verified as V3.

### Not verified, stated plainly

- **Packaged production builds.** All of the above ran from a development build. The packaged path
  is the one where `NODE_APP_INSTANCE` is forced empty, which the design handles explicitly
  (§3.2), but it has not been run.
- **Windows and Linux.** macOS only. `spawn(process.execPath, …)`, the single-instance lock and
  the tray are all cross-platform, but unverified there.
- **Many accounts.** Three accounts at most (plus a further instance as the message sender) were
  run. The staggering in §3.4 is a precaution, not a measured limit.
- **No unit tests** cover `profiles.ts`: it depends on `electron.app` paths, which the mocha/jsdom
  suite cannot provide. Its behaviour is covered by V1–V6 above rather than by an assertion.

## 6. Backing out

The feature does not move or delete any data, and it can be undone without touching an account.

```
# the registry lives beside the data directories, e.g. on macOS:
#   ~/Library/Application Support/Session-accounts*.json
# deleting it makes Session behave exactly as it did before
```

Deleting the registry is safe and complete: without it, Session resolves the default account and
therefore the directory it has always used. Any extra per-account directories are left untouched.

```
git checkout dev
git branch -D feature/call-fullscreen-and-screenshare
```
