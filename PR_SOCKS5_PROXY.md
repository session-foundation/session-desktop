## Summary

This PR adds SOCKS5 proxy support to Session Desktop, including a **Bootstrap-only** mode (proxy only for seed-node bootstrap traffic) and **auto-updater proxy support** for environments where direct Internet access is blocked.

## Key Features

### 1) SOCKS5 Proxy (with optional auth)
- Route network requests through a SOCKS5 proxy
- Supports authenticated and unauthenticated proxies
- Preserves TLS options when tunneling through SOCKS (certificate pinning still works)

### 2) Bootstrap-only mode
- Optional mode to use the proxy only for **seed-node** traffic (initial node discovery)
- All other traffic remains direct for better performance/latency once connected

### 3) Settings UI + immediate apply
- New Settings → **Proxy** page
- Enable/disable toggle
- Bootstrap-only toggle
- Host/port + optional username/password
- Settings persist and apply immediately

### 4) Auto-updater through proxy
- Auto-update checks/downloads can run through the configured SOCKS5 proxy
- When **bootstrap-only** is enabled, the updater uses a dedicated Electron session (partition `persist:auto-updater`) so proxy settings don’t have to be applied globally

## Technical Implementation (high level)

- `ts/session/utils/InsecureNodeFetch.ts`
  - Adds a SOCKS5 agent (`socks5h://…`) for `node-fetch`
  - Agent caching + TLS-option preservation via `SocksProxyAgentWithTls`
  - Destination-based routing (bootstrap-only ⇒ proxy only for `FetchDestination.SEED_NODE`)

- `ts/session/apis/seed_node_api/SeedNodeAPI.ts`
  - Marks seed-node calls as `FetchDestination.SEED_NODE`
  - Uses longer timeouts when proxy is enabled (SOCKS handshake + routing)

- `ts/mains/main_node.ts`
  - Applies global Electron proxy only when **not** in bootstrap-only mode
  - Sets `HTTP(S)_PROXY` env vars for components relying on them
  - Handles proxy auth via Electron `app.on('login', …)`

- `ts/updater/updater.ts`
  - Applies proxy to auto-updater using an Electron session
  - Uses internal `_netSession` to avoid `electron-updater` `netSession` being read-only

## Testing

### CI test builds (all platforms)
- GitHub Actions run: https://github.com/scrense-hash/session-desktop/actions/runs/20927965375

### Mirror to fork releases (recommended download link)
- Release tag: https://github.com/scrense-hash/session-desktop/releases/tag/v1.17.6-socks5-proxy

