# CLAUDE.md — Session Desktop (Issue #563 capstone)

Guidance for Claude Code (and humans) working in this repo. Created for a CodePath
AI301 capstone documenting and fixing **Issue #563** (adding a moderator to an Open
Group by ONS name fails validation).

## Project overview

**Session Desktop** is the desktop client for [Session](https://getsession.org), a
private, decentralized messenger (Oxen / Session Foundation). It is an **Electron +
React + TypeScript** app (`v1.18.0`, AUMID `com.loki-project.messenger-desktop`).

- **UI:** React 19 + Redux (`ts/state`), components under `ts/components`.
- **Core/protocol:** `ts/session` (APIs, types, crypto, conversations).
- **Native:** `libsession_util_nodejs` (C++ via cmake-js) for config/crypto;
  `@signalapp/sqlcipher` (prebuilt) for the encrypted SQLite DB.
- **Storage layer:** `ts/node/sql.ts`.
- **Localization:** `ts/localization` (git submodule); generated strings in
  `ts/localization/generated/english.ts`, helper `tr()` in `localeTools.ts`.
- **Build pipeline:** TS → `tsc` → `dist` → Babel → `app/`; SASS/SVG/workers via
  webpack. Entry: `electron ./app`.

### Common commands
| Task | Command |
|------|---------|
| Install (skip broken native build, see below) | `pnpm install --ignore-scripts` |
| Local Windows repair/setup | `.\win-dev-setup.ps1` |
| Build (dev, with source maps) | `pnpm build:dev` |
| Launch | `pnpm start-dev` |
| Unit tests | `pnpm test` |
| Lint / format | `pnpm lint` |

## Branch

**`fix-issue-563`** (PRs target `dev`).

## Build blocker we hit — and how we fixed it (Windows)

A plain `pnpm install` does **not** produce a runnable app on this Windows machine
(MSVC + Node 24 + pnpm). Three issues, all handled by the local, idempotent helper
**`win-dev-setup.ps1`** (repo root; git-excluded locally, not committed):

1. **MSVC LTO crash (the original blocker).** `libsession_util_nodejs`'s native build
   defaults `USE_LTO=ON` on non-MINGW, which sets CMake `INTERPROCEDURAL_OPTIMIZATION`
   → MSVC `/GL` + `/LTCG`, hitting an MSVC 19.3x MSBuild bug. **Fix:** rebuild via
   `cmake-js ... --CDUSE_LTO=OFF`, run from the *real* `.pnpm` package dir so the
   `node-addon-api` (`napi.h`) include path resolves.
2. **Uninitialized git submodules.** `ts/localization` and `dynamic_assets` aren't
   auto-cloned, so the TS build fails on missing `localization/localeTools` etc.
   **Fix:** `git submodule update --init --recursive`.
3. **Electron binary extraction fails silently** on Node 24 (`@electron/get` +
   `extract-zip`), leaving `dist/` with no `electron.exe` (exit 0). **Fix:**
   `Expand-Archive` the cached zip into `node_modules/electron/dist` + write `path.txt`.

> Do **not** run the stock postinstall `electron-builder install-app-deps` — it rebuilds
> libsession with LTO on and re-breaks the build. `@signalapp/sqlcipher` ships prebuilt
> binaries (no compile). Node-engine warning (24.16 vs wanted 24.12) is harmless.

**Working sequence:** `pnpm install --ignore-scripts` → `.\win-dev-setup.ps1` → `pnpm start-dev`.

## Issue #563 — reproduction & relevant files

**Repro:** Open Group → Group Settings → Add Moderator → enter an ONS name (e.g.
`testname`) → submit. **Observed:** toast *"This Account ID is invalid. Please check and
try again."* (token `accountIdErrorInvalid`). **Expected:** the ONS name resolves to a
Session ID and the moderator is added (parity with the New Message flow).

**Root cause:** the Add Moderator dialog validates input strictly as a hex Session ID via
`PubKey.from()` and **never attempts ONS resolution**, even though the resolver
(`ONSResolve.getSessionIDForOnsName`) already exists and is used elsewhere.

### Relevant files

| File | Role |
|------|------|
| `ts/components/dialog/ModeratorsAddDialog.tsx` | **The buggy dialog.** Line 38 `PubKey.from(p.trim())` — hex-only, no ONS. Empty result → `ToastUtils.pushInvalidPubKey()` (line 42). Input = `ModalSimpleSessionInput` (testId `add-admins-input`). |
| `ts/session/types/PubKey.ts` | Validation. `from()` (L117) / `validate()` (L138, regex) / `validateWithErrorNoBlinding()` (L148). |
| `ts/session/utils/Toast.tsx` | `pushInvalidPubKey()` (L240) → token `accountIdErrorInvalid`. |
| `ts/localization/generated/english.ts` | Error strings: `accountIdErrorInvalid` (L19), `onsErrorNotRecognized` (L678), `onsErrorUnableToSearch` (L679), `errorUnregisteredOns` (L409). |
| `ts/session/apis/snode_api/onsResolve.ts` | **ONS resolver.** `ONSResolve = { onsNameRegex, getSessionIDForOnsName }`; regex `^\w([\w-]*[\w])?$`. |
| `ts/session/apis/snode_api/SnodeRequestTypes.ts` | `OnsResolveSubRequest` (L250, endpoint `ons_resolve`). |
| `ts/components/leftpane/overlay/OverlayMessage.tsx` | **Reference pattern** (New Message): pubkey → else ONS regex → else `getSessionIDForOnsName()` (L111–163). |
| `ts/session/apis/open_group_api/sogsv3/sogsV3AddRemoveMods.ts` | `sogsV3AddAdmin()` — the add-moderator network call. |

## Testing / Reaching the Dialog (requires `SESSION_DEV=1`)

Issue #563 is a client-side validation bug, so you don't need real admin rights to
reproduce it — you just need the dialog to render. **Two** render gates hide it from
non-admins; both now read `isDebugMode()` (`process.env.SESSION_DEV`) so they open in dev:

1. `ts/components/dialog/conversationSettings/pages/default/defaultPage.tsx` —
   `CommunityAdminActions` returns `null` unless `weAreCommunityAdminOrModerator` (hides the
   whole admin section). Bypassed with `... && !isDebugMode()`.
2. `ts/components/menuAndSettingsHooks/useAddModerators.ts` — `useAddModeratorsCb` returns
   `null` unless `weAreAdmin` (hides the Add Admins button). Bypassed with `... && !isDebugMode()`.

Render chain: community (`isPublic`) → `DefaultPageForCommunities` → `CommunityAdminActions`
(gate 1) → `AddAdminCommunityButton` → `useAddModeratorsCb` (gate 2) → `AddModeratorsDialog`.

Launch with the flag — **Git Bash** (inline env prefix, one line):
```bash
SESSION_DEV=1 pnpm start-dev
```
PowerShell equivalent: `$env:SESSION_DEV="1"; pnpm start-dev`. Common Git Bash mistakes:
`$env:...` (PowerShell syntax) and `set ...` (cmd syntax) — neither exports the var.

Verify it's active: DevTools (Ctrl+Shift+I) → Console → `process.env.SESSION_DEV` → `'1'`
(works because the renderer uses `nodeIntegration: true`, `contextIsolation: false`). Then:
open a community → settings panel → **Add Admins** → enter `testname` → observe the toast.

> Both bypasses are dev-only (inert in prod without `SESSION_DEV`) and are testing scaffolding,
> not part of the #563 fix. Decide whether to keep or revert them before the final PR.
> Reminder: stop the running app before any rebuild, or `clean` hits `EPERM` on the locked
> libsession `.node`.

## Phase III — implementation plan

Goal: make Add Moderator accept an ONS name by resolving it to a Session ID before
submitting, mirroring `OverlayMessage.tsx`.

1. **Extract the ONS-or-pubkey resolution into shared logic.** The flow in
   `OverlayMessage.handleMessageButtonClick` (validate pubkey → ONS regex → resolve →
   re-validate) should be factored into a reusable hook/util (e.g. a
   `useResolvePubkeyOrOns()` hook or a `resolvePubkeyOrOns()` helper) so both the New
   Message overlay and the moderator dialog share one implementation.
2. **Update `ModeratorsAddDialog.tsx`** to use it instead of the raw
   `PubKey.from()` map at line 38. Handle the comma-separated multi-add case (resolve each
   entry; a single failure should report which entry failed).
3. **Async UX:** ONS resolution is a network call — show the existing `SessionSpinner`
   during resolution, disable Add, and surface `onsErrorNotRecognized` /
   `onsErrorUnableToSearch` inline via the input's `providedError` prop (currently `''`)
   rather than only the generic invalid-pubkey toast.
4. **Edge cases:** trim + `toASCII()` input (as OverlayMessage does); reject blinded /
   03-group keys; ensure a resolved ID passes `validateWithErrorNoBlinding` before calling
   `sogsV3AddAdmin`.
5. **Update copy:** consider the `membersAddAccountIdOrOns` / `accountIdOrOnsEnter`
   strings for the input placeholder/description so the UI advertises ONS support.
6. **Tests:** unit-test the shared resolver (valid pubkey, valid ONS, unregistered ONS,
   network error); add a component test for the dialog's loading/error states.

### Open questions to resolve before coding
- Confirm Issue #563's exact expected behavior (resolve silently vs. show resolved ID for
  confirmation).
- ONS display convention: real ONS names match `^\w([\w-]*[\w])?$` (no dots). Decide how
  to handle dotted inputs like `name.loki`/`name.bdx` (strip suffix, or reject with a
  clear message).
