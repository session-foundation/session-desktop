## Summary

This change adds **SOCKS5 proxy support** to Session Desktop, including a **Bootstrap-only** mode (proxy only for seed-node bootstrap traffic) and **auto-updater proxy support** for environments where direct Internet access is blocked.

The implementation supports both per-request SOCKS routing for `node-fetch` traffic and (optionally) global Electron proxying for the full application, with immediate application from the Settings UI.

## User-Facing Features

### 1) SOCKS5 proxy (optional authentication)
- Route network requests through a SOCKS5 proxy.
- Supports both unauthenticated proxies and username/password authentication.
- Uses `socks5h://…` for DNS-through-proxy semantics when using the per-request agent.
- Preserves TLS options when tunneling through SOCKS (certificate pinning remains effective).

### 2) Bootstrap-only mode
When **Bootstrap-only** is enabled:
- Only **seed-node bootstrap / discovery** traffic is routed through SOCKS (`FetchDestination.SEED_NODE`).
- Other destinations (service nodes, Session server, SOGS, etc.) remain direct for better performance once connected.
- Global Electron proxy is intentionally not configured in this mode (proxying is done per-request where applicable).

### 3) Proxy settings UI + immediate apply
- New Settings → **Proxy** page.
- Enable/disable toggle.
- Bootstrap-only toggle.
- Host/port fields + optional username/password.
- Input validation and toast-based error/success feedback.
- Settings persist to storage and apply immediately via IPC (`apply-proxy-settings`).

### 4) Auto-updater via proxy
- Auto-update checks and downloads can run through the configured SOCKS5 proxy.
- To avoid global proxy side effects, the updater can use a dedicated Electron session:
  - If **bootstrap-only** is enabled, the updater uses `session.fromPartition('persist:auto-updater')`.
  - Otherwise, it uses `session.defaultSession`.
- Updated to work with `electron-updater` where `netSession` is read-only by setting the backing `_netSession` field.

## Technical Notes (Implementation Details)

### Request-level proxying for Session network fetches
- `ts/session/utils/InsecureNodeFetch.ts`
  - Introduces `SocksProxyAgentWithTls` (extends `socks-proxy-agent`) to preserve TLS options for secure endpoints.
  - Agent caching keyed by proxy URL + TLS options to avoid re-creating agents for every request.
  - Destination-based routing:
    - Full proxy mode ⇒ proxy for all destinations.
    - Bootstrap-only ⇒ proxy only for `FetchDestination.SEED_NODE`.
  - SOCKS agent timeout increased to 30s to account for handshake + routing.

### Seed-node bootstrap integration
- `ts/session/apis/seed_node_api/SeedNodeAPI.ts`
  - Marks seed-node calls as `FetchDestination.SEED_NODE`.
  - Increases request timeout when proxy is enabled (30s vs 5s).

### Global Electron proxy integration (full proxy mode)
- `ts/mains/main_node.ts`
  - Applies `session.defaultSession.setProxy({ proxyRules: 'socks5://host:port' })` when proxy is enabled and **not** bootstrap-only.
  - Sets `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` env vars for components that rely on standard proxy env vars.
  - Handles proxy authentication via Electron `app.on('login', …)` when `authInfo.isProxy`.

### Auto-updater integration
- `ts/updater/updater.ts`
  - Configures proxy on the chosen Electron session (default or `persist:auto-updater`).
  - Assigns the session to the updater via `_netSession` to avoid runtime errors with read-only `netSession`.

## Security / Behavior Considerations

- Bootstrap-only mode is explicitly designed to avoid routing all traffic through a proxy: only initial seed bootstrap is proxied.
- In full-proxy mode, global Electron proxying is enabled; ensure users understand that this affects Electron-level networking.
- Local bypass rules are set to `'<local>'` to avoid proxying local traffic.

## Test Builds

### CI run artifacts (all platforms)
https://github.com/scrense-hash/session-desktop/actions/runs/20927965375

### Fork release (recommended download link)
https://github.com/scrense-hash/session-desktop/releases/tag/v1.17.6-socks5-proxy
