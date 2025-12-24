# SOCKS5 Proxy Support Patch for Session Desktop

This patch adds full SOCKS5 proxy support to Session Desktop, allowing all application traffic (including onion requests) to be routed through a SOCKS proxy server.

## Features

- ✅ SOCKS5 proxy support with authentication
- ✅ Proper timeout handling for proxy connections (30s vs 5s for direct)
- ✅ TLS/SSL certificate validation through proxy
- ✅ Certificate pinning preservation
- ✅ Agent caching for performance optimization
- ✅ Detailed error logging for debugging
- ✅ UI for proxy configuration in Settings
- ✅ Auto-updater disabled when proxy is enabled (prevents traffic leaks)

## Changes Summary

### Critical Changes (Required for functionality)

1. **InsecureNodeFetch.ts** - Core proxy implementation
   - `SocksProxyAgentWithTls` class for TLS options propagation
   - Proxy agent priority over sslAgent
   - TLS options extraction from original agent
   - Agent caching with TLS configuration support

2. **SeedNodeAPI.ts** - Timeout adjustment
   - Increased timeout from 5s to 30s when proxy is enabled

3. **onionPath.ts** - Timeout adjustment
   - Increased timeout from 10s to 30s when proxy is enabled

### Optional Improvements

4. **Enhanced error logging** - Better debugging capabilities
5. **Patch stamp tracking** - Version verification tool
6. **Agent caching** - Performance optimization

## Security Considerations

- TLS settings are extracted from the original `sslAgent` and preserved through the proxy
- Certificate pinning continues to work through SOCKS proxy
- `rejectUnauthorized` is only set to `false` if it was already disabled in the original agent
- No security regression for production seed nodes
- **Auto-updater is disabled when proxy is enabled** to prevent traffic leaks
  - electron-updater uses native HTTP clients that bypass our proxy configuration
  - Users must update manually when using proxy mode
  - This ensures 100% traffic routing through proxy with no leaks

## Installation

### Apply the patch:

```bash
cd ~/Nextcloud/WORKSPACE/PROJECTS/session-desktop
git apply socks-proxy-support.patch
```

### Build and install:

```bash
# Build the application
PATH=~/.nvm/versions/node/v20.18.2/bin:/bin:/usr/bin:$PATH npx yarn build

# Build release package
PATH=~/.nvm/versions/node/v20.18.2/bin:/bin:/usr/bin:$PATH \
  NODE_OPTIONS='--max-old-space-size=8192' \
  npx yarn build-release

# Install the package
sudo dpkg -i release/session-desktop-linux-amd64-1.17.5.deb
```

## Usage

1. Open Session Desktop
2. Go to **Settings** → **Proxy**
3. Enable proxy and configure:
   - **Proxy Server**: Your SOCKS5 proxy address (e.g., 192.168.1.254)
   - **Port**: SOCKS5 proxy port (e.g., 1080)
   - **Username** (optional): For authenticated proxies
   - **Password** (optional): For authenticated proxies
4. Click **Save**

**⚠️ Important Notes:**
- **Auto-updates are disabled** when proxy is enabled to prevent traffic leaks
- To update Session Desktop while using proxy, download new version manually from GitHub Releases
- All application traffic (messages, media, metadata) routes through proxy
- Disable proxy to re-enable auto-updates

## Testing

To verify the proxy is working, check the logs:

```bash
tail -f ~/.config/Session/logs/app.log | grep -i "proxy"
```

You should see:
- `Creating new SOCKS5 agent` on first connection
- `Using cached agent` on subsequent connections
- No `self signed certificate` errors
- Successful connections through proxy

## Files Modified

- `ts/session/utils/InsecureNodeFetch.ts` - Core proxy logic
- `ts/session/apis/seed_node_api/SeedNodeAPI.ts` - Timeout adjustment
- `ts/session/onions/onionPath.ts` - Timeout adjustment
- `ts/components/dialog/user-settings/pages/ProxySettingsPage.tsx` - UI component
- `ts/data/settings-key.ts` - Proxy settings keys
- `ts/state/ducks/modalDialog.tsx` - Modal state
- `_locales/en/messages.json` - Localization strings
- `_locales/ru/messages.json` - Russian localization
- `package.json` - Dependencies (socks-proxy-agent, etc.)

## Dependencies Added

- `socks-proxy-agent` - SOCKS5 proxy support
- `socks` - SOCKS protocol implementation
- `smart-buffer` - Buffer utilities for SOCKS

## Troubleshooting

### Timeouts after 30 seconds
- Check if your SOCKS proxy is accessible
- Verify proxy address and port are correct
- Test proxy with curl: `curl --socks5 host:port https://example.com`

### Self-signed certificate errors
- Ensure you're not using a local devnet with custom certificates
- Check if the issue occurs without proxy (to isolate the problem)

### Connection works without proxy but fails with proxy
- Verify SOCKS5 proxy supports HTTPS/TLS connections
- Check proxy logs for connection attempts
- Enable debug logging in Session to see detailed errors

## Credits

Patch created: 2025-12-23
Session Desktop version: 1.17.5
Node.js version: 20.18.2

## License

This patch maintains the same license as Session Desktop (GPL-3.0).
