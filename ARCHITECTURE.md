# Session Desktop Architecture

> This document describes the high-level architecture of Session Desktop.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Repository Layout](#2-repository-layout)
3. [Key Dependencies](#3-key-dependencies)
4. [Electron Process Model](#4-electron-process-model)
5. [State Management](#5-state-management)
6. [Database Layer](#6-database-layer)
7. [Networking and Messaging](#7-networking-and-messaging)
8. [Snode Namespaces](#8-snode-namespaces)
9. [Disappearing Messages](#9-disappearing-messages)
10. [Job Runner System](#10-job-runner-system)
11. [Feature Flags](#11-feature-flags)
12. [Identity and Key Management](#12-identity-and-key-management)
13. [Attachment Handling](#13-attachment-handling)
14. [Calls](#14-calls)
15. [Build System](#15-build-system)
16. [CI and Release Pipeline](#16-ci-and-release-pipeline)
17. [Testing](#17-testing)
18. [Notable Architectural Decisions](#18-notable-architectural-decisions)

---

## 1. Overview

Session Desktop is a privacy-focused, end-to-end encrypted messenger built on [Electron](https://www.electronjs.org/). It communicates over the Session network - a decentralised infrastructure of _service nodes_ (snodes) - without relying on central servers for message routing.

The codebase is written in TypeScript and React, with a SQLCipher-encrypted local database, libsodium-based cryptography, and a native addon (`libsession_util_nodejs`) that handles the Session-specific protocol configuration layer.

---

## 2. Repository Layout

```
session-desktop/
├── ts/                            # All application source code
│   ├── mains/                     # Electron entry points (main & renderer)
│   ├── components/                # React UI components
│   ├── state/                     # Redux store, slices, selectors, smart components
│   ├── models/                    # In-memory data models (ConversationModel, MessageModel)
│   ├── data/                      # IPC wrappers around the database API
│   ├── session/                   # Core protocol: sending, receiving, crypto, onion routing
│   │   ├── apis/                  # Service node, Open Group (SOGS) and other APIs
│   │   ├── crypto/                # Encryption utilities
│   │   ├── disappearing_messages/ # DaS / DaR expiry logic
│   │   ├── onions/                # Onion path construction and request wrapping
│   │   ├── sending/               # Message queue, sender, and wrapper
│   │   └── utils/                 # Session-level utilities (job runners, timers, etc.)
│   ├── receiver/                  # Incoming message decryption and dispatch
│   ├── webworker/                 # Web Worker implementations (libsession, image, utils)
│   ├── node/                      # Main-process-only code (SQL, IPC channel definitions)
│   ├── localization/              # i18n strings and dynamic token helpers (submodule)
│   ├── hooks/                     # React hooks
│   ├── util/                      # General-purpose utilities
│   ├── types/                     # Shared TypeScript type definitions
│   └── test/                      # Unit and integration tests
├── stylesheets/                   # SCSS source files
├── protos/                        # Protocol Buffer definitions (.proto files)
├── config/                        # Environment-specific JSON config (dev, test, production)
├── build/                         # Build scripts and platform assets (icons, entitlements)
├── dynamic_assets/                # submodule of assets refreshing often (e.g. GeoIP database, snode caches)
└── [root config files]            # package.json, tsconfig, webpack configs, babel, etc.
```

---

## 3. Key Dependencies

### Runtime

| Dependency                | Version | Role                                              |
| ------------------------- | ------- | ------------------------------------------------- |
| `electron`                | 40      | Desktop application shell                         |
| `react` / `react-dom`     | 19      | UI rendering                                      |
| `@reduxjs/toolkit`        | 2       | State management                                  |
| `@signalapp/sqlcipher`    | 3       | Encrypted SQLite database                         |
| `libsession_util_nodejs`  | 0.6     | Session protocol config layer (native node addon) |
| `libsodium-wrappers-sumo` | latest  | Ed25519 / X25519 cryptography                     |
| `protobufjs`              | 7       | Protobuf message encoding                         |
| `styled-components`       | 6       | CSS-in-JS component styling                       |
| `electron-updater`        | 6       | Auto-update delivery                              |
| `zod`                     | 4       | Runtime schema validation                         |
| `pino`                    | 9       | Structured logging                                |

### Development & Build

| Dependency                 | Role                                               |
| -------------------------- | -------------------------------------------------- |
| `webpack` 5                | Module bundling                                    |
| `babel` 7                  | Transpilation (includes React Compiler plugin)     |
| `typescript` 5.8           | Type checking                                      |
| `pnpm`                     | Package manager (workspace-aware, strict lockfile) |
| `mocha` + `chai` + `sinon` | Test framework                                     |
| `eslint` + `prettier`      | Code quality                                       |

---

## 4. Electron Process Model

Session Desktop follows the standard Electron two-process model.

```
┌─────────────────────────────────────────────────────────┐
│  Main Process  (Node.js)                                │
│  ts/mains/main_node.ts                                  │
│  ─────────────────────────────────────────────────────  │
│  • Window lifecycle (BrowserWindow)                     │
│  • SQLCipher database (all SQL runs here)               │
│  • File-system access (attachments, export)             │
│  • System tray, notifications, spell checker            │
│  • electron-updater                                     │
│  • Crash reporting                                      │
└────────────────────┬────────────────────────────────────┘
                     │  IPC
┌────────────────────┴────────────────────────────────────┐
│  Renderer Process  (Chromium + Node integration)        │
│  ts/mains/main_renderer.tsx                             │
│  ─────────────────────────────────────────────────────  │
│  • React root (SessionInboxView / RegistrationView)     │
│  • Redux store                                          │
│  • Protocol networking (fetch via onion routing)        │
│  • Message send/receive orchestration                   │
│  • Web Workers (libsession, image processing, utils)    │
└─────────────────────────────────────────────────────────┘
```

### Preload Scripts

Each Electron window has its own preload script:

- `preload.js` - main conversation window
- `about_preload.js` - about / version window
- `password_preload.js` - unlock window

### Web Workers

Heavy or blocking operations are offloaded to Web Workers so the UI thread stays responsive:

| Worker                      | Purpose                                           |
| --------------------------- | ------------------------------------------------- |
| `libsession.worker.ts`      | libsession-util crypto and config operations      |
| `image_processor.worker.ts` | Image resizing and thumbnail generation via sharp |
| `util.worker.ts`            | General-purpose compute tasks                     |

Each worker has its own Webpack config and is bundled independently.

### libsession Worker Protocol

The `libsession_util_nodejs` native addon is a NodeJS native addon. Every calls has to go through `libsession.worker.ts` using a typed message protocol:

**Request:** `[jobId, configType, actionName, ...args]`

**Response:** `[jobId, errorOrNull, result?]`

- `jobId` - a numeric ID used to correlate async responses
- `configType` - which wrapper to target: `'UserConfig'`, `'ContactsConfig'`, `'UserGroupsConfig'`, `'ConvoInfoVolatileConfig'`, or `MetaGroup-{03pubkey}` for a specific group
- `actionName` - the method to invoke (`'init'`, `'dump'`, `'push'`, `'merge'`, `'free'`, etc.)

There are two families of wrappers:

- **Singleton user wrappers** - one instance per config type per account: `UserConfig`, `ContactsConfig`, `UserGroupsConfig`, `ConvoInfoVolatileConfig`
- **Per-group wrappers** - one `MetaGroupWrapperNode` instance per group, keyed by its `03`-prefix pubkey

The browser-side interface is in `ts/webworker/workers/browser/libsession_worker_interface.ts`.

More details about this protocol can be found in the [libsession-util-nodejs](https://github.com/session-foundation/libsession-util-nodejs/) and the [libsession-util](https://github.com/session-foundation/libsession-util/) repos.

The `MetaGroup-{03pubkey}` wrapper is a special case for multiple reasons:

- it is not a singleton, but a per-group wrapper
- it is not a 1to1 mapping to the libsession-util API, but a merged wrapper of the GroupInfo, GroupMembers, and GroupKeys configs. See [libsession-util](https://github.com/session-foundation/libsession-util/tree/dev/include/session/config/groups)

---

## 5. State Management

Application state is managed with Redux Toolkit. The store is created in `ts/state/createStore.ts` and uses `redux-promise-middleware` for async action handling.

### Store Shape

The top-level reducer (`ts/state/reducer.ts`) composes the following slices:

| Slice                  | Contents                                                                     |
| ---------------------- | ---------------------------------------------------------------------------- |
| `conversations`        | Conversation list per-conversation metadata & selected conversation messages |
| `user`                 | Own account (Session ID, display name, avatar)                               |
| `search`               | Search query and results                                                     |
| `settings`             | User-configurable preferences                                                |
| `theme & primaryColor` | Active theme and colors                                                      |
| `section`              | Global layout of the app                                                     |
| `modals`               | Open modal dialogs and their props                                           |
| `call`                 | Voice / video call state                                                     |
| `onionPaths`           | Currently-active onion paths & online status                                 |
| `stagedAttachments`    | Attachments staged to an outgoing message                                    |
| `userGroups`           | Closed group and community list                                              |
| `metaGroups`           | Extended group metadata (derived from libsession)                            |
| `networkData`          | Sesh details fetched from the server                                         |

### Patterns

- **Ducks layout** - each slice lives in its own file under `ts/state/ducks/`.
- **Reselect** - memoised selectors live in `ts/state/selectors/` and are the only way components should derive computed values from state.
- **Class vs Functional components** - functional components are preferred over class components, but we still have some left in `ts/state/smart/`

### ConversationModel → Redux update flow

`ConversationModel` (`ts/models/conversation.ts`) does **not** use Backbone or a custom event emitter. When its attributes change, it pushes updates into Redux directly:

```
ConversationModel.set(attrs)
  └─▶ triggerUIRefresh()
        └─▶ getConversationModelProps()   // serialise to plain props object
              └─▶ dispatch(conversationsChanged([props]))
```

Components usually don't hold a reference to a `ConversationModel`. They select plain data from the Redux `conversations` slice and re-render when the slice changes.

When many conversations change at once (e.g. during a bulk import or config sync), updates are batched through `throttledAllConversationsDispatch()` to avoid one Redux dispatch per message.

`ConvoHub` (`ts/session/conversations/ConversationController.ts`) is the in-process registry. It is the only place that creates or looks up `ConversationModel` instances - call `ConvoHub.use().get(pubkey)` or `ConvoHub.use().getOrCreateAndWait(pubkey)` rather than constructing models directly.

---

## 6. Database Layer

### Technology

All persistent data is stored in a single **SQLCipher** database. The database file lives in the Electron user-data directory. Because SQLCipher runs as a native addon, it can only be used in the main process.

### Access Pattern

```
Renderer ──(IPC)──▶ ts/node/sql_channel.ts ──▶ SQLCipher (main process)
```

The renderer never calls SQL directly. It calls typed wrappers in `ts/data/` which serialise & clean arguments and dispatch them over named IPC channels. Results are returned as plain JSON objects. This arrangement:

1. Keeps the database in a single process, avoiding concurrent-write issues.
2. Enforces a clear API boundary between UI logic and persistence.

### Key Tables

| Table              | Contents                                        |
| ------------------ | ----------------------------------------------- |
| `conversations`    | Contact and group metadata                      |
| `messages`         | Message content, type, status, timestamps       |
| `messages_fts`     | FTS5 full-text search index over message bodies |
| `nodesForPubkey`   | cached swarm nodes for a given pubkey           |
| `identityKeys`     | User Ed25519 & x25519 key pairs                 |
| `items`            | Key/value settings store                        |
| `openGroupRoomsV2` | Open community (SOGS) room metadata             |
| `seenMessages`     | hashes of processed messages (deduplication)    |
| `configDump`       | Serialised (hex) libsession config dumps        |

### In-Memory Models

`ConversationModel` and `MessageModel` (under `ts/models/`) wrap database rows with business logic and event emission. `ConvoHub` acts as an in-process registry that caches loaded conversation objects, lazily fetching from the database on app start.

---

## 7. Networking and Messaging

### The Session Network

Session Desktop communicates with a decentralised network of _service nodes_. Each user's messages are stored on a _swarm_ - a subset of nodes responsible for that user's Session ID. The app periodically polls its swarm for new messages and pushes outgoing messages to the recipient's swarm.

For groups, the group gets its own pubkey and so its own swarm. Every member of the group will periodically poll the group swarm in addition to its own swarm.

All traffic is wrapped in onion routing: three service nodes are selected at random to form a path, and the request is layered in encryption so that no single node sees both the origin and the destination.

```
App ─▶ Guard Node ─▶ Middle Node ─▶ Exit Node ─▶ Destination
        (knows src)               (knows dst)
```

The path building logic is making sure that the nodes of path are not in the same subnet.
We also keep multiple paths in case one of them fails, or in case we need to store a message to a node that is already on our current path.

### Sending

```
ts/session/sending/
├── MessageQueue.ts          # Priority queue; retries on failure
├── PendingMessageCache.ts   # Tracks in-flight messages in the DB
├── MessageSender.ts         # Encrypts and dispatches to service nodes
└── MessageWrapper.ts        # Protobuf serialisation + padding
```

`MessageQueue` ensures messages are sent in order per conversation. Failed sends are retried with exponential back-off. The `PendingMessageCache` survives app restarts so no messages are silently lost.

Some calls don't need to be retried, or the retries are handled manually. For those, use the `sendToPubKeyNonDurably` method.

### Receiving

`ts/session/apis/snode_api/swarmPolling.ts` runs a background loop that polls each swarm the user is subscribed to. Fetched envelopes are passed to `ts/receiver/receiver.ts`, which:

1. Verifies the sender signature.
2. Decrypts the envelope with the recipient's private key.
3. Dispatches the inner content message to the appropriate handler (`contentMessage.ts`, `dataMessage.ts`, etc.).
4. Writes the result to the database and updates Redux state.

This whole process has to be fast so no network calls should be made while handling a message.
For anything that needs to be done on the network while processing a message, a job should be added (if retries are needed) or the network call should be `void` so that it doesn't delay processing of other messages.
For instance when we receive a message, we sometimes need to fetch a user's new profile picture from the file server. This is done by adding a new job that will fetch that file, but the fetch itself is not part of the message processing pipeline.

### Open Groups (SOGS)

Community rooms are served by **Session Open Group Servers (SOGS)**, accessed via the `ts/session/apis/open_group_api/` client. Communities usually use blinded Session IDs so joining a one does not expose your own SessionID . Blinded IDs start with `15` or `25`.

### Libsession Config Layer

The `libsession_util_nodejs` native addon manages _config messages_ - a CRDT-based mechanism that synchronises user details, contact list, groups and current read state across multiple devices. Config operations are executed inside the `libsession.worker.ts` Web Worker to avoid blocking the UI thread. See [§4 - libsession Worker Protocol](#libsession-worker-protocol) for the wire format.

### insecureNodeFetch

`ts/session/utils/InsecureNodeFetch.ts` is a thin wrapper around `node-fetch`. The name is intentionally alarming - it should never gain new call sites without a clear justification.

It is acceptable in its current call sites for a few reasons:

1. **Seed node requests** - the certificate of those are pinned and embedded in the app (see `ts/session/apis/seed_node_api/SeedNodeAPI.ts`)
2. **Guard node** - these are already encrypted at the onion routing layer.
3. **Public external calls** (link previews, Giphy API) - these do not go through the onion logic and are on leaking metadata. They are disabled by default and can only be enabled after a warning about their use it approved.

The wrapper also serves as the **online-state detector**: if a request throws a network-unreachable error (`ENETUNREACH`, `EHOSTUNREACH`), it calls `setIsOnlineIfDifferent(false)` to flip the app's connectivity state. This is why virtually all outbound network requests funnel through it rather than calling `fetch` directly.

Each call site tags its traffic with a `FetchDestination` enum value (`SERVICE_NODE`, `SEED_NODE`, `SOGS`, `PUBLIC`) for debug logging when the `debugInsecureNodeFetch` feature flag is enabled.

### Snode Pool and Swarm Selection

The app bootstraps its view of the network from a small hardcoded list of **seed nodes**. On first run (and periodically thereafter), it fetches the full snode pool (currently 1600+ nodes) from the seed or via a combination of snodes.

For each pubkey the user is subscribed to, `ts/session/apis/snode_api/getSwarmFor.ts` requests the responsible swarm from the pool and caches the result. Swarm membership is re-fetched lazily when the swarm of a pubkey is becoming too small.

**Guard node selection** (`ts/session/onions/onionPath.ts`): 2-4 nodes are pinned as persistent entry points for onion paths. Those are the nodes we are exposing our IP too. As long as they are reachable, they shouldn't be changed. They are saved in a database table so they survive restarts. When building a path, subnet isolation is enforced - to limit the risk of a single ISP observing both the origin and an intermediate/exit node.

Nodes that fail requests are dropped from the in-memory pool and logged. Paths that accumulate too many failures are torn down and rebuilt.

### Group Versions: Legacy (05-prefix) vs Groups v2 (03-prefix)

There are two incompatible closed-group implementations coexisting in the codebase:

|                   | Legacy Closed Groups                    | Groups v2                                |
| ----------------- | --------------------------------------- | ---------------------------------------- |
| Pubkey prefix     | `05` (Ed25519)                          | `03` (Curve25519)                        |
| Conversation type | `ConversationTypeEnum.GROUP`            | `ConversationTypeEnum.GROUPV2`           |
| Config storage    | Legacy protocol                         | `MetaGroupWrapper` via libsession worker |
| Detection         | `isClosedGroup() && !isClosedGroupV2()` | `isClosedGroupV2()`                      |
| Disappearing msgs | DaS only, control msgs never expire     | DaS forced; same control-msg rule        |
| Status            | Read only, cannot retrieve/send msgs    | Actively used, read/write possible       |

The predicates `PubKey.is05Pubkey(id)` and `PubKey.is03Pubkey(id)` in `ts/session/types/PubKey.ts` are the canonical way to distinguish them. New feature work should target Groups v2 only as the legacy ones are readonly.

---

## 8. Snode Namespaces

Every message stored on or retrieved from a service node is placed in a **namespace** - a numeric partition of a swarm's storage. Namespaces separate message types so the app can poll, authenticate, and prioritise them independently. The full enum is defined in `ts/session/apis/snode_api/namespaces.ts`.

### Namespace Reference

| Namespace | Constant                                | Stores                                                     | TTL     |
| --------- | --------------------------------------- | ---------------------------------------------------------- | ------- |
| `0`       | `Default`                               | 1-on-1 DMs, invitation to groups, etc                      | 14 days |
| `2`       | `UserProfile`                           | User profile config (display name, avatar)                 | 30 days |
| `3`       | `UserContacts`                          | Contacts list config                                       | 30 days |
| `4`       | `ConvoInfoVolatile`                     | Volatile conversation state (forced unread, last msg read) | 30 days |
| `5`       | `UserGroups`                            | User's groups and communities config                       | 30 days |
| `11`      | `ClosedGroupMessages`                   | Groups v2 messages                                         | 14 days |
| `12`      | `ClosedGroupKeys`                       | Groups v2 encryption keys config                           | 30 days |
| `13`      | `ClosedGroupInfo`                       | Groups v2 group info config                                | 30 days |
| `14`      | `ClosedGroupMembers`                    | Groups v2 member list config                               | 30 days |
| `-11`     | `ClosedGroupRevokedRetrievableMessages` | Group config visible to revoked members                    | 14 days |

Config namespaces get a longer TTL than message namespaces to make the app state more resilient. Those are also usually pruned, so not many messages are expected to be stored in them. For instance, a user should only have one `UserProfile` config, as each devices should delete the previous one when pushing a new one.

### Authentication per Namespace

Each namespace tier has a different authentication requirement on the store request:

| Namespace(s)                | Auth required                                                             |
| --------------------------- | ------------------------------------------------------------------------- |
| `0` (Default)               | None - pubkey only                                                        |
| `2, 3, 4, 5` (user config)  | signature with the user's own keypair                                     |
| `11` (group messages)       | subaccount signature (issued by group admin) or admin signature           |
| `12, 13, 14` (group config) | admin key **only** - regular members cannot write but they can extend TTL |
| `-11`                       | Ed25519 subaccount signature                                              |

The signature covers `method + namespace + timestamp`. Namespace `0` is not required to be provided, it is the default.

### Polling Strategy

`swarmPolling.ts` calls `getNamespacesToPollFrom()` to decide which namespaces to fetch for a given conversation. The sets differ by conversation type:

```
Private conversation  →  [0, 2, 3, 5, 4]
                          ^                regular DMs
                             ^^^^^^^^^^^   user config namespaces

Groups v2 conversation  →  [-11, 11, 13, 14, 12]
                             ^^^                 revoked-member still retrievable (polled first)
                                  ^^             group messages
                                      ^^^^^^^^^  group config (keys fetched last - see below)
```

**Key ordering constraint:** `ClosedGroupKeys` (12) is always requested last (`requestOrder = -10`) to prevent a race where a newly posted key arrives before the group info or member list that references it.

**Priority:** Message namespaces (`0`, `11`) have priority `10`; all config namespaces have priority `1`. Higher-priority namespaces receive a proportionally larger byte budget in each poll response so that new messages are never starved by a large config sync.

**Last-hash tracking:** The polling loop tracks the hash of the last retrieved message independently for every `(snode, pubkey, namespace)` triple, so each namespace is fetched incrementally without re-downloading old data. There are some known edge cases here, for instance if the message referenced by the last hash is deleted, the next poll will fetch the whole history of messages again.

---

## 9. Disappearing Messages

Session supports two message-expiry modes:

| Mode              | Abbreviation | Countdown starts                           |
| ----------------- | ------------ | ------------------------------------------ |
| Delete after Send | DaS          | When the message is sent                   |
| Delete after Read | DaR          | When the recipient first reads the message |

### Message Attributes

Each message row carries three expiry fields:

- `expireTimer` - duration in seconds (0 = disabled)
- `expirationStartTimestamp` - when the countdown began (ms since epoch)
- `expires_at` - absolute expiry time = `expirationStartTimestamp + expireTimer * 1000`

### DaR and Swarm Synchronisation

DaR is more complex than DaS because the expiry start time is different on every device. When a message is read:

1. `UpdateMsgExpirySwarmJob` pushes the updated TTL to the sender's swarm so other devices see the same deadline.
2. `FetchMsgExpirySwarmJob` pulls the actual swarm TTL for messages received while the device was offline.

Both jobs are implemented as `PersistedJob` instances so they survive app restarts.

### Constraints

- DaR is only available in 1-on-1 conversations, so DaS is the only option in Groups v2 conversations.
- Disappearing messages are not supported in Open Group communities at all.
- Expiry uses `NetworkTime.now()` (not `Date.now()`) for cross-device consistency with the service node clock.

#### Disappearing messages on 1-on-1 conversations

Due to the decentralised nature of Session, Disappearing messages work quite differently than most other messaging apps.

Each side of the conversation can have its own setting. So, if Alice and Bob are chatting, Alice can have **DaR** enabled and Bob can have **DaS** enabled, or one can have it **off** entirely, etc. A "Follow Setting" button is provided to allow the user to follow the other user's setting. Alice's message will expire based on her setting on Bob's devices, and Bob's messages will expire based on his setting on Alice's devices.

DaR is also working quite differently from most other messaging apps. Each side will have different starts timer for the same message. So if Alice sends a message to Bob with DaR 1h, the message will be stored on Alice's swarm and devices for 1h (as it was sent by Alice).
The same message on Bob's swarm will be stored for 14 days so that Bob can read it after 1h. Once Bob read the message, the message will be marked to be deleted in 1h on Bob's swarm and his devices.

#### Disappearing messages on group conversations

In group conversation, an admin can set a group-wide setting for the group. This setting will then be fetched by all members and messages they send will start disappearing based on that setting.

---

## 10. Job Runner System

`ts/session/utils/job_runners/` contains a persistent, typed job queue used for any operation that must survive app restarts and retry on failure.

### Pattern

```
PersistedJobRunner<T>
  ├── addJob(job)          - enqueue; persists to DB immediately
  ├── loadJobsFromDb()     - called on startup to restore pending jobs
  └── tryToRunJob()        - dequeues and executes; retries with back-off
```

- Each job type defines its own `maxAttempts` and retry delay.
- Job state is serialised to the `items` table so nothing is lost on crash.

### Job Types

| Job                          | Purpose                                       |
| ---------------------------- | --------------------------------------------- |
| `UserSyncJob`                | Push user's config to swarm                   |
| `GroupSyncJob`               | Push group's config to swarm                  |
| `FetchMsgExpirySwarmJob`     | Fetch actual TTL from swarm for DaR messages  |
| `UpdateMsgExpirySwarmJob`    | Update swarm TTL when a DaR message is read   |
| `AvatarDownloadJob`          | Download contact / group avatars              |
| `AvatarReuploadJob`          | Re-upload an avatar periodically if needed    |
| `AvatarMigrateJob`           | Migrate avatars to the current storage format |
| `GroupInviteJob`             | Send group invitations to new members         |
| `GroupPromoteJob`            | Promote a member to admin                     |
| `GroupPendingRemovalJob`     | Process members that are pending removals     |
| `UpdateProRevocationListJob` | Sync the Pro feature revocation list          |

---

## 11. Feature Flags

Session uses a feature flag system to be able to toggle features on and off at runtime.

### Storage

`window.sessionBooleanFeatureFlags` and `window.sessionDataFeatureFlags` are the **runtime source of truth**. They are set at app startup from environment variables. Most of those can be toggled at runtime via a debug menu.

### Flag Categories

| Category            | Type                              | Examples                                                          |
| ------------------- | --------------------------------- | ----------------------------------------------------------------- |
| Production booleans | `SessionBaseBooleanFeatureFlags`  | `proAvailable`, `canToggleGiphy`, `useTestNet`                    |
| Typed data          | `SessionDataFeatureFlags`         | `useLocalDevNet`, `mockProCurrentStatus`, `fakeAvatarPickerColor` |
| Debug logs booleans | `SessionDebugBooleanFeatureFlags` | `debugLogging`, `debugInsecureNodeFetch`, `debugOnionRequests`    |

### Access

```typescript
// Read a boolean flag
getFeatureFlag('proAvailable');

// Read a data flag
getDataFeatureFlag('useLocalDevNet');
```

Defaults come from env vars (e.g., `SESSION_DEBUG`, `GROUPV2_QA_BUTTONS`) read in `ts/state/ducks/types/defaultFeatureFlags.ts`.

---

## 12. Identity and Key Management

### Session ID Derivation

A Session ID is derived entirely from a mnemonic seed phrase - no server registration is required.

```
Mnemonic (13 words)
  └─▶ 32-byte hex seed  (mnemonic.ts: mnDecode/mnEncode)
        └─▶ crypto_sign_seed_keypair()  (libsodium)
              ├─▶ Ed25519 private key  (stored in DB)
              └─▶ X25519 public key + 0x05 prefix  = Session ID
```

### Multi-Device Config Sync

When the user installs Session on a second device and enters their seed, the new device fetches config messages from the swarm and uses the `libsession_util_nodejs` wrappers to reconstruct the current state of contacts, groups, and settings without any server-side account system.

As config messages are stored in the swarm for 30 days, this also means that a device needs to be online for the account recovery to work.
Any devices online will extend the TTL of the user's config messages, so that a user's state will be stored on the swarm as long as at least one device comes online periodically.

---

## 13. Attachment Handling

Attachments are stored **encrypted on disk** and **uploaded to a file server** rather than the service node swarm. Only the URL, encryption key, and digest are sent in the message envelope.

### Send Pipeline

```
User selects file
  → resize / thumbnail generation (image_processor.worker.ts)
  → encrypt with AES-GCM or deterministic via libsession (ts/util/crypto/attachmentsEncrypter.ts)
  → write encrypted blob to local attachments folder
  → add padding & upload to file server → receive URL
  → include {url, key} in outgoing message protobuf
```

### Receive Pipeline

```
Incoming message with attachment pointer
  → enqueue in AttachmentsDownload queue
  → download encrypted blob from file server URL
  → decrypt (AES-GCM or deterministic via libsession)
  → strip padding
  → hand decrypted buffer to DecryptedAttachmentsManager (in-memory cache)
```

The download queue (`ts/session/utils/AttachmentsDownload.ts`) retries with stepped back-off (30 s → 30 min → 6 h) and persists pending jobs to the database so downloads resume after restart.

`DecryptedAttachmentsManager` holds decrypted file data in memory only. Nothing plaintext is written to disk; the on-disk copy is always the encrypted blob.

---

## 14. Calls

Session supports one-to-one voice and video calls using **WebRTC** with Session's own signaling layer. The calls themselves are currently not onion-routed.

### Signaling

Call control messages are regular Session messages serialised as `SignalService.CallMessage` protobufs and sent through the normal onion-routed message pipeline. There is no separate signaling server.

| Message type     | Purpose                                                 |
| ---------------- | ------------------------------------------------------- |
| `PRE_OFFER`      | Notify recipient a call is incoming (before full offer) |
| `OFFER`          | WebRTC SDP offer                                        |
| `ANSWER`         | WebRTC SDP answer                                       |
| `ICE_CANDIDATES` | Trickle ICE candidates                                  |
| `END_CALL`       | Hang-up / rejection                                     |

Stale `OFFER` messages are discarded based on their timestamp to avoid ringing for missed calls after the fact.

### Peer Connection

`ts/session/utils/calling/CallManager.ts` owns the `RTCPeerConnection` lifecycle. TURN servers (multiple regional endpoints) are configured at connection time. A WebRTC data channel alongside the media tracks carries lightweight in-band signals (video mute state, hangup) to avoid encoding them as Session messages.

### Device Handling

Redux slice `ts/state/ducks/call.tsx` holds all UI-visible call state (ringing, in-call, participant info). `ts/receiver/callMessage.ts` handles incoming call message dispatch.

---

## 15. Build System

The project uses **Webpack 5** with **Babel 7** for bundling, compiled TypeScript output, and SCSS. `pnpm` is the package manager.

### Webpack Configurations

| Config file                        | Output                      |
| ---------------------------------- | --------------------------- |
| `utils.worker.config.js`           | `util.worker.js`            |
| `libsession.worker.config.js`      | `libsession.worker.js`      |
| `image_processor.worker.config.js` | `image_processor.worker.js` |
| `svgs.webpack.config.js`           | Compiled SVG sprites        |

### Key Build Commands

When changing branches, often a clean is needed. This command will clean the project, install dependencies, and start the watch mode.

```bash
rm -rf app dist/ release node_modules && mkdir dist && pnpm install && pnpm watch
```

Other notable commands are:

```bash
pnpm build             # Full production build
pnpm build-release     # electron-builder release packaging
pnpm start-prod:pretty # Start and pretty print its output
```

When starting the app you can use the `MULTI` environment variable to specify a separate instance.

For instance, you can start two users with `MULTI=alice pnpm start-prod:pretty` and `MULTI=bob pnpm start-prod:pretty`.
You can then create two users in those two instances, or make the second one login to the first one using its mnemonic.

### React Compiler

The Babel pipeline includes the **React Compiler** plugin, which automatically applies memoisation optimisations equivalent to manual `useMemo` / `useCallback` usage. A small number of components are explicitly opted out because their effect and callback timing is too nuanced for the compiler to handle safely:

- `CompositionTextArea` - complex composition input state
- `SessionStagedLinkPreview` - link preview lifecycle
- `MessageReactBar` - emoji reaction interaction

---

## 16. CI and Release Pipeline

The CI pipeline is defined in `.github/workflows/build-binaries.yml` and runs on push to `master`, `dev`, `release/**`, `feature/**`, and `ci/**` branches, as well as on PRs targeting those branches.

### Job sequence

```
create_draft_release_if_needed
  └─▶ lint_and_format          (runs in parallel with linux builds)
  └─▶ build_linux              (matrix: deb, rpm, AppImage, freebsd)
        └─▶ post_build_linux   (merges per-target latest-linux.yml metadata)
  └─▶ build_windows            (x64)
  └─▶ build_mac                (arm64 + x64)
         └─▶ post_build_mac    (merges per-target latest-mac.yml)
```

### When a draft release is created

A GitHub draft release is created **only** on:

- Push to `master` - stable release, uses `build/release-notes.md`
- Push to a `release/*-alpha.*` branch - alpha release, uses `build/release-notes-alpha.md`

On all other branches (PRs, `dev`, `feature/**`) the binaries are uploaded as GitHub Actions artifacts instead. The release is always created as a **draft** - it is never published automatically. A human must review and publish.

To make a new release, just bump the version in `package.json` and push `dev` to `master`. The CI pipeline will create a draft release and upload the artifacts.
Before publishing it, you'll first need binaries to be signed with Jason's key.

### Lint gate

The lint job runs `pnpm lint` and `pnpm format`, then checks `git diff --exit-code`. If the formatter or linter would change any file, the build fails. This means formatting is enforced in CI, not just locally.

### Build matrix

| Platform               | Targets                     |
| ---------------------- | --------------------------- |
| Linux (ubuntu-22.04)   | deb, rpm, AppImage, freebsd |
| Windows (windows-2022) | x64 NSIS installer          |
| macOS                  | arm64 + x64                 |

Each build job also runs `pnpm test` so unit tests are validated on every platform.

### Release metadata

Linux produces a separate `latest-linux.yml` per electron target. The `post_build_linux` job downloads all of them and merges them via `build/setup-release-combine.sh` before attaching the single combined file to the release. This is needed because `electron-updater` expects one `latest-linux.yml` that lists all Linux variants.

---

## 17. Testing

Tests are run with **Mocha**, using **jsdom** for a simulated browser environment, **Chai** for assertions, and **Sinon** for mocks and stubs.

```bash
pnpm test           # Run the full test suite
```

Test sources live in `ts/test/` and are compiled alongside the application code. Test utilities and common stubs (e.g. for `PendingMessageCache` and the sending pipeline) are in `ts/test/test-utils/`.

React component tests use `@testing-library/react`. Crypto and protocol logic tests operate directly on TypeScript modules without a DOM.

---

## 18. Other Notable Architectural Decisions

### Message Deduplication via Hash Table

The `seen_messages` database table stores hashes of every processed message envelope until they are expected to be removed from the swarm. Before processing, each incoming message is checked against this table. This prevents double-processing of messages because of known edge cases on the swarm network. For instance, the order of messages between the snodes of a swarm is not guaranteed, so a message may be received out of order.

### Periodic SQLite Vacuum

`ts/session/utils/job_runners/jobs/dbVacuumManager.ts` schedules periodic `VACUUM` operations on the SQLite database. Because Session messages are regularly expired and deleted (configurable per-conversation), without periodic compaction the on-disk file size would grow unboundedly. The vacuum job runs in the main process during idle periods.
