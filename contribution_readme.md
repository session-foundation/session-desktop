# Contribution README — Issue #563 (Phase II)

**Capstone:** CodePath AI301
**Issue #563:** Adding a moderator to an Open Group (community) by **ONS name** fails
validation instead of resolving the name to a Session ID.
**Branch:** [`fix-issue-563`](https://github.com/KyWB/session-desktop/tree/fix-issue-563)

---

## Reproduction Process

### Environment Setup

Getting a runnable dev build on Windows required working around several issues:

- **Node `v24.16.0`** was used instead of the required `24.12.0`. This produces an
  "Unsupported engine" warning but **works fine** for building and running the app.
- **`pnpm install` failed** while compiling the native module `libsession_util_nodejs`:
  the C++ build crashed due to an **MSVC 19.38 LTO / MSBuild bug** (CMake
  `INTERPROCEDURAL_OPTIMIZATION` → `/GL` + `/LTCG`).
- **Fix:**
  1. Installed JS dependencies without the failing native scripts:
     `pnpm install --ignore-scripts`
  2. Initialized the required git submodules (`ts/localization`, `dynamic_assets`):
     `git submodule update --init --recursive`
  3. Rebuilt the native module with LTO disabled and repaired the Electron binary via the
     local helper script **`win-dev-setup.ps1`** (rebuilds `libsession_util_nodejs` with
     `--CDUSE_LTO=OFF`, applies `patch-package`, and extracts the Electron binary that
     `@electron/get` failed to unpack on Node 24).
- The app was launched with **`SESSION_DEV=1`** to unlock the **Add Admins** dialog
  (it is normally gated to community admins/moderators).

### Branch Link

https://github.com/KyWB/session-desktop/tree/fix-issue-563

### Steps to Reproduce

1. Clone the repo and run `pnpm install --ignore-scripts`.
2. Launch with `SESSION_DEV=1 pnpm start-dev`.
3. Create an account and join any community.
4. Click the community name → **Settings** → **Add Admins**.
5. Type **`testname`** (a valid ONS-format name) in the input field.
6. Click **Add**.
7. **Expected:** the ONS name resolves to a 66-char hex public key and the account is added
   as a moderator.
8. **Actual:** toast error — **"This Account ID is invalid. Please check and try again."**

---

## Solution Approach / Implementation Plan (UMPIRE)

- **Understand:** The `ModeratorsAddDialog` validates input using `PubKey.from()`, which only
  accepts 66-char hex keys and **never calls the ONS resolver**. An ONS name fails the pubkey
  regex, so the input is treated as invalid and the error toast is shown.
- **Match:** `OverlayMessage.tsx` (the New Message flow) already has **working ONS resolution
  logic** (`ONSResolve.getSessionIDForOnsName`) that we can reuse.
- **Plan:** Add an asynchronous ONS resolution step in `ModeratorsAddDialog.tsx` before
  validation — if the input isn't a valid pubkey but matches the ONS format, resolve it to a
  Session ID and validate that result.
- **Implement:** Phase III — see the branch link above.
- **Review:** Will follow the conventions in `CONTRIBUTING.md`.
- **Evaluate:** Manual test — a valid registered ONS name should resolve and succeed; invalid
  or unregistered names should still show a clear error.

---

## Relevant Files

| File | Role |
|------|------|
| `ts/components/dialog/ModeratorsAddDialog.tsx` | The dialog; validates input with `PubKey.from()` (no ONS resolution). |
| `ts/session/types/PubKey.ts` | `PubKey.from()` / `validate()` — rejects non-hex input. |
| `ts/components/leftpane/overlay/OverlayMessage.tsx` | Reference implementation of pubkey-or-ONS resolution to reuse. |
| `ts/session/apis/snode_api/onsResolve.ts` | `ONSResolve.getSessionIDForOnsName()` — the ONS resolver. |
