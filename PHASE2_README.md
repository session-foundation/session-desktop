# Phase II — Issue #563 Reproduction & Phase III Plan

**Capstone:** CodePath AI301
**Repo:** session-desktop
**Branch:** `fix-issue-563`
**Issue #563:** Adding a moderator to an Open Group (community) by **ONS name** fails
validation instead of resolving the name to a Session ID.

---

## 1. Environment setup (Windows)

A plain `pnpm install` does not produce a runnable build on this machine (MSVC + Node 24 +
pnpm). The native `libsession_util_nodejs` build crashes under MSVC LTO, git submodules are
not auto-initialized, and Electron's binary fails to extract. Setup used:

```bash
# 1. Install JS deps WITHOUT the (failing) native build scripts
pnpm install --ignore-scripts

# 2. Run the local repair script (idempotent). It performs:
#    - git submodule update --init --recursive   (ts/localization, dynamic_assets)
#    - rebuild libsession_util_nodejs with USE_LTO=OFF   (works around the MSVC 19.3x
#      INTERPROCEDURAL_OPTIMIZATION /GL + /LTCG MSBuild crash)
#    - repair the Electron binary (manual zip extraction; @electron/get extract bug on Node 24)
#    - pnpm patch-package
powershell -ExecutionPolicy Bypass -File .\win-dev-setup.ps1

# 3. Build the renderer/app
pnpm build:dev
```

Key flag: the native module **must** be compiled with `USE_LTO=OFF`:

```bash
cmake-js build --runtime=electron --runtime-version=<electronVersion> \
  --CDSUBMODULE_CHECK=OFF --CDLOCAL_MIRROR=https://oxen.rocks/deps \
  --CDENABLE_NETWORKING=OFF --CDWITH_TESTS=OFF --CDUSE_LTO=OFF
```

> Do **not** run the stock postinstall `electron-builder install-app-deps` — it rebuilds
> libsession with LTO on and re-breaks the build. Stop the running app before any rebuild,
> or the `clean` step hits `EPERM` on the locked libsession `.node`.

---

## 2. Reproduction steps

The Add Admins dialog is admin-gated by two render checks, so reaching it as a non-admin
requires debug mode. Launch with `SESSION_DEV=1` (Git Bash inline env prefix):

```bash
SESSION_DEV=1 pnpm start-dev
```

(PowerShell equivalent: `$env:SESSION_DEV="1"; pnpm start-dev`. In Git Bash, `$env:...` and
`set ...` do **not** work — they don't export the variable.)

Verify the flag is live: DevTools (**Ctrl+Shift+I**) → Console → `process.env.SESSION_DEV` → `'1'`.

Then:

1. **Join a community** (Open Group) if you haven't — compose/"+" → Join Community.
2. Open the community → open its **settings** panel.
3. Under **Admin Settings**, click **Add Admins**.
4. In the input, type **`testname`** — a valid ONS-format name (matches the ONS regex
   `^\w([\w-]*[\w])?$`).
5. Submit.

### Exact error observed

> **This Account ID is invalid. Please check and try again.**

(Localization token: `accountIdErrorInvalid`. A screenshot of this toast is the Phase II
evidence.)

---

## 3. Relevant files

| File | Role in the bug |
|------|-----------------|
| `ts/components/dialog/ModeratorsAddDialog.tsx` | **The buggy dialog.** Line 38: `compact(inputBoxValue.split(',').map(p => PubKey.from(p.trim())))` validates input as a hex Session ID only — **no ONS resolution**. Empty result → `ToastUtils.pushInvalidPubKey()` (line 42). |
| `ts/session/types/PubKey.ts` | **`PubKey.from()`** (L117) → `PubKey.validate()` (L138, regex). An ONS name fails the regex → returns `undefined`. |
| `ts/components/leftpane/overlay/OverlayMessage.tsx` | **Reference (correct) pattern.** New Message flow (`handleMessageButtonClick`, L111–163): try pubkey → else ONS regex → else `ONSResolve.getSessionIDForOnsName()`. This is what the moderator dialog should mirror. |
| `ts/session/apis/snode_api/onsResolve.ts` | The ONS resolver: `ONSResolve = { onsNameRegex, getSessionIDForOnsName }`. |
| `ts/session/utils/Toast.tsx` | `pushInvalidPubKey()` (L240) → token `accountIdErrorInvalid`. |
| `ts/localization/generated/english.ts` | Error strings: `accountIdErrorInvalid` (L19), `onsErrorNotRecognized` (L678), `onsErrorUnableToSearch` (L679). |

**Root cause:** the moderator-add path validates strictly as a hex pubkey and never attempts
ONS resolution, while the equivalent New Message path already resolves ONS names. The fix is
to give the moderator dialog the same resolve-pubkey-or-ONS behavior.

---

## 4. Phase III solution plan (UMPIRE)

### U — Understand
- **Problem:** In the Add Admins dialog, an ONS name should resolve to a Session ID and add
  that account as a moderator; today it is rejected as an invalid Account ID.
- **Input:** a string — a hex Session ID, an ONS name, or a comma-separated mix.
- **Output:** moderator(s) added on success; otherwise a *specific* error (invalid ID vs.
  ONS not registered vs. network failure).
- **Constraints:** ONS resolution is asynchronous (snode network call). Must not regress the
  existing hex-pubkey behavior. The field already supports comma-separated multi-add.
- **Edge cases:** unregistered ONS, network/SnodeResponseError, ONS-regex mismatch, blinded
  / `03`-group keys (reject), mixed valid+invalid list, duplicate/self entries.

### M — Match
- This is the **same "resolve a pubkey-or-ONS string" problem already solved** in
  `OverlayMessage.tsx` (New Message). That flow: `PubKey.validateWithErrorNoBlinding` →
  if pubkey-but-invalid/`03` reject → else test `ONSResolve.onsNameRegex` → else
  `await ONSResolve.getSessionIDForOnsName()` → re-validate resolved ID. Reuse this pattern
  rather than reinventing it.

### P — Plan
1. **Extract** the resolution logic from `OverlayMessage.handleMessageButtonClick` into a
   shared, testable unit — e.g. `resolvePubkeyOrOns(input: string): Promise<{ pubkey?: string; error?: string }>`
   (or a `useResolvePubkeyOrOns` hook) under `ts/session/...` / `ts/hooks`.
2. **Refactor** `OverlayMessage.tsx` to call the shared helper (no behavior change — keeps
   the reference path and the fix in sync).
3. **Rewire** `ModeratorsAddDialog.tsx`: replace the synchronous `PubKey.from` map (line 38)
   with async resolution of each comma-separated entry via the helper.
4. **UX:** show the existing `SessionSpinner` during resolution, disable **Add**, and surface
   per-entry errors inline through the input's `providedError` prop (currently `''`) instead
   of only the generic toast.
5. **Submit** resolved pubkeys through the existing `sogsV3AddAdmin(pubkeys, roomInfos)`.

### I — Implement
- **New:** `resolvePubkeyOrOns` helper/hook (single source of truth for pubkey-or-ONS).
- **Edit:** `OverlayMessage.tsx` → consume the helper.
- **Edit:** `ModeratorsAddDialog.tsx` → consume the helper; manage `addingInProgress` + error
  state; handle partial success in the multi-add case (report which entry failed).
- **Strings:** reuse `onsErrorNotRecognized`, `onsErrorUnableToSearch`, `accountIdErrorInvalid`;
  optionally switch the input placeholder to `membersAddAccountIdOrOns` to advertise ONS.

### R — Review
- **Unit tests** for the helper: valid hex pubkey; valid registered ONS → resolves; valid-format
  but unregistered ONS → `onsErrorNotRecognized`; network error → `onsErrorUnableToSearch`;
  garbage / blinded / `03` key → invalid.
- **Component test** for the dialog: spinner shown during resolution; inline error rendered.
- **Manual (SESSION_DEV=1):** registered ONS → moderator added; `testname` (unregistered) →
  ONS-not-recognized; random text → invalid Account ID.

### E — Evaluate
- **Complexity:** O(n) network resolutions for n comma-separated entries — resolve
  sequentially with progress, or in parallel with a combined result; cap to `MAX_SUBREQUESTS_COUNT`.
- **Trade-offs:** async resolution adds a spinner/disabled state and an extra round trip vs.
  the previous instant (but wrong) rejection.
- **Risk:** the shared-helper refactor touches the New Message flow — covered by keeping its
  behavior identical and adding tests. Confirm desired UX (resolve silently vs. confirm the
  resolved ID) against Issue #563 before finalizing.

---

*Note: the two dev-only render-gate bypasses (`useAddModerators.ts`, `defaultPage.tsx`,
both gated on `isDebugMode()`) are testing scaffolding used to reach the dialog without a
SOGS admin account; they are not part of the Phase III fix and are inert without `SESSION_DEV`.*
