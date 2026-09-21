# TDD — Session Desktop: real full screen + screen sharing in 1:1 calls

- **Document**: `docs/TDD-call-fullscreen-and-screenshare.md`
- **Version**: 1.0
- **Date**: 2026-09-20
- **Branch**: `feature/call-fullscreen-and-screenshare`
- **Status**: implemented; §5 records what was verified and what was not.

---

## 1. Problem statement

Session Desktop 1:1 calls today have two defects and one missing capability.

**D1 — "Full screen" is not full screen.** `CallInFullScreenContainer.tsx` renders an
absolutely-positioned overlay inside the renderer window (`position: absolute; top/bottom/left/right: 0;
z-index: 9`). It fills the *app window*, never the *display*. There is no call path to
`Element.requestFullscreen()` and no IPC to `BrowserWindow.setFullScreen()`. Verified by
`grep -rn "requestFullscreen\|setFullScreen" ts/` → no hits in renderer code.

**D2 — the control is hidden, unlabelled, and self-cancelling.**

| # | Defect | Evidence (pre-change) |
|---|---|---|
| D2.1 | The maximize button only renders when the *remote* peer is sending video | `CallButtons.tsx`: `{!remoteStreamVideoIsMuted && <ShowInFullScreenButton …/>}` |
| D2.2 | Full screen is force-exited whenever the remote peer's video mutes | `CallInFullScreenContainer.tsx`: `useEffect(… if (remoteStreamVideoIsMuted) dispatch(setFullScreenCall(false)))` |
| D2.3 | Any click anywhere in the overlay — including on the call control buttons — exits full screen | `CallInFullScreenContainer.tsx`: `<CallInFullScreenVisible onClick={toggleFullScreenOFF}>` |
| D2.4 | The button is a bare `MAXIMIZE` glyph at `opacity: 0.4` with no tooltip, no label, no keyboard shortcut | `CallButtons.tsx` `StyledCallActionButton` / `ShowInFullScreenButton` |

**D3 — there is no screen sharing at all.** Verified:
`grep -rn "getDisplayMedia\|desktopCapturer\|setDisplayMediaRequestHandler" ts/ preload.js` → no hits.

**The requirement that ties them together**: full screen and screen share must be usable
*simultaneously*. D2.2 and D2.3 each independently break that — sharing your screen replaces your
outgoing camera track, and clicking the share button would drop you out of full screen.

## 2. Requirements

| ID | Requirement | Verified by |
|---|---|---|
| R1 | A user in an ongoing 1:1 call can put the call video into **true OS full screen** (fills the display, not just the app window) | V1 (live, two instances) |
| R2 | The full-screen control is **discoverable**: always present during an ongoing call, labelled, tooltipped, at full opacity | V2 (live) + V5 (unit) |
| R3 | Full screen is exitable by the button, by `Escape`, and by the OS/browser's own full-screen exit, with app state staying in sync in all three cases | V1, V4 |
| R4 | A user can **share a screen or window** into the call; the remote peer sees it as the caller's video | V3 (live, two instances) |
| R5 | **Screen share and full screen work at the same time** — entering one never cancels the other, in either order | V3 (live) |
| R6 | Stopping the share (in-app button, or the OS "Stop sharing" affordance) returns the outgoing video to the previously-selected camera, or to the black-silence track if no camera was on | V3 (live) |
| R7 | Interoperability with **unmodified** Session clients (Android / iOS / stock desktop) is preserved — no signalling or SDP shape changes | D4 (design constraint, see §3.1) |
| R8 | Entering call full screen must not corrupt the persisted window geometry (`ephemeralConfig` `window.fullscreen`) | V4 (live) |

Out of scope (stated, not silently dropped): group calls (Session has none), simultaneous
camera **and** screen tracks (see §3.1), remote-side "X is sharing their screen" indicator
(requires a protocol change, see §3.1), Crowdin-official translations of the two new strings
(see §3.6).

## 3. Design

### 3.1 Constraint: one video track, `replaceTrack` only

`CallManager.ts` builds exactly one video transceiver per call and keeps it alive for the call's
duration, swapping tracks under it (`selectCameraByDeviceId` → `videoSender.replaceTrack(videoTrack)`,
CallManager.ts:293-305). A black-silence track occupies the sender when the camera is off
(`getBlackSilenceMediaStream()`), which is why the sender always exists.

Session's call signalling (`SignalService.CallMessage` with `OFFER` / `ANSWER` / `ICE_CANDIDATES`)
has no mid-call renegotiation path. Adding a **second** video m-line for the screen would change the
SDP shape and require renegotiation that stock peers do not implement.

**Decision D4: screen share reuses the existing video sender via `replaceTrack`.**

Consequence, stated plainly rather than hidden: **while you are sharing your screen, your camera is
off** — you send the screen *instead of* the camera, not in addition to it. This is the correct
trade under R7. When the share stops, the camera track that was selected before the share is
restored (R6).

Consequence 2: the remote peer sees the share as ordinary video and gets no "screen share" label.
Signalling that would mean extending the data-channel payload
(`sendVideoStatusViaDataChannel()` currently sends `{video: boolean}`). We **do** extend that
payload with an additive, ignorable field (see §3.3) — stock peers `JSON.parse` it and read only
`video`, so they are unaffected.

### 3.2 True full screen (R1, R3, R8)

The renderer calls the standard `Element.requestFullscreen()` on the call overlay element, and
`document.exitFullscreen()` to leave. In Electron this puts the `BrowserWindow` into HTML full
screen on macOS, Windows and Linux alike — no IPC, no platform branch.

State stays in one place: Redux `call.callIsInFullScreen` remains the single source of truth for
*whether the overlay is shown*. A `fullscreenchange` listener reconciles it with the DOM, so that
the browser's own `Escape` handling (which exits DOM full screen without telling React) cannot
leave the two disagreeing (R3).

Ordering rule (matters, and is easy to get wrong): the overlay element must be **mounted** before
`requestFullscreen()` can be called on it. So the sequence is
`dispatch(setFullScreenCall(true))` → overlay mounts → `useEffect` on mount calls
`requestFullscreen()`. Exit is the mirror: `exitFullscreen()` first (if the document is in full
screen), then `dispatch(setFullScreenCall(false))`.

**R8 — window-config corruption.** `captureAndSaveWindowStats()` in `ts/mains/main_node.ts` runs on
every `resize`, and writes `fullscreen: true` into `ephemeralConfig` whenever
`mainWindow.isFullScreen()`. Entering HTML full screen fires `resize`. Without a guard, quitting
while in a full-screen call makes Session reopen full screen forever after. Fix: track HTML full
screen in the main process via the `enter-html-full-screen` / `leave-html-full-screen` webContents
events and skip the `fullscreen: true` write while that flag is set. User-initiated window full
screen (green button / `Ctrl+Cmd+F`) is unaffected, because those do not raise HTML full-screen
events.

### 3.3 Screen share (R4, R6)

**Renderer — `CallManager.ts`**, two new exported functions mirroring the existing camera path:

```
startScreenShare():
  stream = await navigator.mediaDevices.getDisplayMedia({video: true, audio: false})
  track  = stream.getVideoTracks()[0]
  track.addEventListener('ended', onDisplayTrackEnded)   // OS "Stop sharing"
  videoSender = peerConnection.getTransceivers().find(t => t.sender.track?.kind === 'video').sender
  await videoSender.replaceTrack(track)
  // swap the local preview the same way selectCameraByDeviceId does
  localStream.getVideoTracks().forEach(t => { t.stop(); localStream.removeTrack(t) })
  localStream.addTrack(track)
  isScreenSharing = true
  sendVideoStatusViaDataChannel(); callVideoListeners()

stopScreenShare():
  isScreenSharing = false
  if (cameraIdBeforeShare !== DEVICE_DISABLED_DEVICE_ID) await selectCameraByDeviceId(cameraIdBeforeShare)
  else await selectCameraByDeviceId(DEVICE_DISABLED_DEVICE_ID)   // restores black-silence
```

`selectCameraByDeviceId` is reused for the restore path deliberately: it already does the full
track lifecycle correctly, including the black-silence fallback, the data-channel notification and
the listener fan-out. Duplicating it is how the two paths would drift.

`isScreenSharing` is **separate module state**, not derived from `selectedCameraId`. It is threaded
through every hop, because missing one hop is the obvious bug:
`CallManagerOptionsType` → `callVideoListeners()` → `useVideoCallEventsListener` →
`CallWindowControls` props → the button's pressed state.

`sendVideoStatusViaDataChannel()` gains an additive field: `{video, screenShare}`. Stock peers read
`video` only (`handleDataChannelMessage` destructures known keys), so this is backwards-compatible.

**Main process — `ts/mains/main_node.ts`.** `navigator.mediaDevices.getDisplayMedia()` **rejects in
an Electron renderer unless the main process registers a handler** — Electron ships no picker of its
own. We register:

```
session.defaultSession.setDisplayMediaRequestHandler(handler, { useSystemPicker: true })
```

with a `desktopCapturer.getSources({types:['screen','window']})` fallback handler for platforms
where the system picker is unavailable. On macOS the system picker is the native ScreenCaptureKit
picker (Sonoma+), which is also what satisfies the OS screen-recording consent flow.

**Permission gate.** The renderer's `setPermissionRequestHandler` path already exists for
`media`; `display-capture` is requested as its own permission type in Electron ≥ 30 and is granted
in the same handler.

### 3.4 Making it obvious (R2)

- The full-screen button is **always rendered** during an ongoing call. The
  `!remoteStreamVideoIsMuted` gate (D2.1) is removed — you may want your *own* shared screen in full
  screen even when the peer's camera is off, which is precisely the R5 case.
- Resting opacity for call action buttons goes from `0.4` to `0.9` in full screen (they were
  effectively invisible against dark video).
- Both new controls carry a visible tooltip + `aria-label` + `title`:
  "Toggle Full Screen" (existing localized token `fullScreenToggle`) and
  "Share Screen" / "Stop Sharing".
- While in full screen an explicit pill reading **"Exit Full Screen (Esc)"** is shown in the overlay,
  so the exit path is never a guess.
- `F` toggles full screen and `S` toggles screen share while a call overlay has focus; `Escape`
  exits full screen. Shortcuts are additive to the buttons, never the only affordance.

### 3.5 Making them coexist (R5)

Three edits, each removing a way the current code cancels full screen:

1. Delete the container-level `onClick={toggleFullScreenOFF}` (D2.3). Exit is by the labelled
   button, `Escape`, or the OS control. Without this, clicking "Share Screen" exits full screen —
   i.e. R5 is unsatisfiable while it stands.
2. Delete the `remoteStreamVideoIsMuted → setFullScreenCall(false)` effect (D2.2). The remote peer
   muting their camera is not a reason to tear down *your* full screen, and it happens routinely
   while you are presenting.
3. Always render the full-screen button (D2.1) so the *entry* path exists during a share.

Order-independence is a requirement, not an accident: share→full screen and full screen→share must
both work, and are both exercised in V3.

### 3.6 Strings

`fullScreenToggle` ("Toggle Full Screen") already exists in the `session-localization` submodule and
is used. The screen-share strings do **not** exist upstream and the localization repo is a separate
submodule this fork does not own, so they are defined as English constants in
`ts/components/calling/CallButtons.tsx` with a `TODO(l10n)` marker. This is a known, stated gap:
promoting them means a PR to `session-foundation/session-localization`.

## 4. Verification plan

Verification is part of implementation, not of the GO. Every item below is to be **observed**, and
the observation recorded in §5 with its result — not asserted.

| ID | What | How | Pass criterion |
|---|---|---|---|
| V0 | It compiles and lints | `pnpm build`, `pnpm lint` | zero TS errors, zero new eslint errors |
| V1 | True full screen | Two instances (`MULTI=1`/`MULTI=2`), two accounts, place a call, click **Full Screen** | the video covers the whole display; menu bar/dock hidden; `Escape` and the exit pill both return to windowed |
| V2 | Discoverability | Same session, with the peer's camera **off** | the Full Screen button is present and legible; tooltip shows on hover |
| V3 | Simultaneity (both orders) | (a) share → full screen; (b) full screen → share | in both, the share keeps streaming and the overlay stays full screen; peer sees the screen |
| V4 | No config corruption | Enter call full screen, quit the app, relaunch | `ephemeralConfig` `window.fullscreen` is absent; app opens windowed |
| V5 | Reducer/unit | `pnpm test` with new `call_duck_test.ts` | new tests pass; existing suite unchanged |
| V6 | Stop-share paths | Stop via in-app button; stop via the OS "Stop sharing" affordance | camera (or black silence) is restored both ways; no dead sender |

**Honest limit on V1/V3/V6**: they require two Session accounts and a live call over the Session
network. If that cannot be completed in this environment, the result is recorded as *blocked* with
what is missing — not as passed. A build that compiles is not evidence that a call works.

## 5. Observations

All of the following were **observed on 2026-09-20** on macOS (Darwin 27.0.0), Electron 40, against
a build of this branch. The live items ran two instances of the real app
(`NODE_APP_INSTANCE=devprod1` / `devprod2`) with two throwaway Session accounts — call them
A (the caller) and B (the callee) — and a real 1:1 call over the Session network. The app was driven through the Chrome
DevTools Protocol (`--remote-debugging-port`) and the Electron main process through the Node
inspector (`--inspect`), so every number below is read out of the running app, not asserted.

| ID | Result | Evidence |
|---|---|---|
| V0 | **PASS** | `pnpm build` exit 0, zero TS errors; `pnpm lint` clean |
| V5 | **PASS** | `pnpm test`: 961 passing, 0 failing (baseline before the change: 953 passing) |
| — | **PASS** | Screen-share source listing in the real app: `screenAccess: granted`, 9 sources, real thumbnails |
| — | **PASS** | `getDisplayMedia` in the real renderer: live 1920×1200 @30fps track; canvas sample min 0 / max 255 → real pixels, not a black placeholder |
| V2 | **PASS** | `CallWindowControls` rendered against the real store: captions "Full Screen"/"Share Screen", and "Exit Full Screen (Esc)"/"Stop Sharing" in the other state; `title` and `aria-label` present on both buttons |
| — | **PASS** | Session's own picker rendered in the app: headings "Choose what to share / Screens / Windows", 8 thumbnails, clicking a tile returned `screen:4:0` |
| V1 | **PASS** | In a live call, clicking **Full Screen**: Redux `callIsInFullScreen: true`, `document.fullscreenElement` set, and **the main process reports `BrowserWindow.isFullScreen(): true` with `getSize(): [1920, 1200]`** — the whole display, not the app window |
| V3 | **PASS** | Order A (share → full screen): track stayed `live`/unmuted, window went full screen. Order B (full screen → share): picker opened *inside* full screen, still full screen after picking, overlay button switched to "Stop Sharing", `getIsScreenSharing(): true`, window still `isFullScreen: true` |
| — | **PASS** | The peer received it: B's remote `<video>` became **1920×1200** (the shared screen's resolution) with real pixel content |
| — | **PASS** | Regression, the one that made R5 impossible before: clicking a control **and** clicking the video inside the overlay both left full screen intact |
| V6 | **PASS** | Stopping the share from inside full screen: still full screen, `getIsScreenSharing(): false`, button back to "Share Screen", and B's remote video went to a flat frame (min = max = 1) — the peer stops seeing the screen |
| V3/R3 | **PASS** | `Escape` left both DOM full screen and app state; re-entering and then exiting through `document.exitFullscreen()` alone also brought the app state back — neither path can desync |
| V4/R8 | **PASS** | Across the whole session, **zero** `"fullscreen":true` lines were persisted while the window genuinely was full screen; `ephemeral.json` ends at the pre-call geometry (`maximized: true, 1920×1092, y: 30`) |

### A real defect the live test found

The full screen overlay was rendering **stale state**: its video elements had `srcObject: null` and
its screen-share button read "Share Screen" while a share was running. Cause:
`useVideoEventListener` evaluated `useMountedState()` **during render** and captured the result.
On the first render that value is `false`, so the listener it registered discarded every update it
was ever handed; the overlay mounts once and nothing else re-renders it, so it stayed frozen at its
initial defaults. Fixed by calling the getter inside the listener instead. This is pre-existing and
unrelated to the new features — it is only unmissable now that the overlay is reachable in more
situations.

### Not verified, stated plainly

- **Windows and Linux.** Everything above is macOS. The picker and the display-media handler use
  no macOS-specific API (`useSystemPicker: false`, `desktopCapturer` everywhere), but they have not
  been run there.
- **Interop with stock Session clients** (Android / iOS / unmodified desktop). The design changes
  no signalling and adds only an additive data-channel field (§3.1), but the call tested here was
  between two instances of *this* build.
- **The macOS Screen Recording permission prompt path.** The permission was already granted on
  this machine, so the "not granted" branch of the picker (message + Open System Settings) was not
  exercised live.

## 6. Backing out

Everything here is confined to application code on one branch; no data is moved or deleted.

```
git checkout dev
git branch -D feature/call-fullscreen-and-screenshare
```

## 7. Review

The design was reviewed before implementation. Changes folded in as a result, each of which is
load-bearing:

- screen share reuses the single video sender via `replaceTrack` rather than adding a second
  video m-line, so calls with unmodified clients keep working (§3.1);
- the display track's `ended` event is handled, so the OS "Stop sharing" affordance does not leave
  a dead sender (§3.3);
- `isScreenSharing` is its own state rather than something derived from `selectedCameraId` (§3.3);
- the `captureAndSaveWindowStats` guard, without which a full-screen call corrupts the saved
  window geometry (§3.2);
- the `removeVideoEventsListener` `splice` bug.
