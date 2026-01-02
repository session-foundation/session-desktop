import nodeFetch, {
  type FetchError,
  type RequestInfo,
  type RequestInit,
  type Response,
} from 'node-fetch';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { SettingsKey } from '../../data/settings-key';
import { getFeatureFlag } from '../../state/ducks/types/releasedFeaturesReduxTypes';
import { updateIsOnline } from '../../state/ducks/onions';
import { ReduxOnionSelectors } from '../../state/selectors/onions';
import { ERROR_CODE_NO_CONNECT } from '../apis/snode_api/SNodeAPI';

function debugLogRequestIfEnabled(params: NodeFetchParams) {
  if (getFeatureFlag('debugInsecureNodeFetch')) {
    const logObj = {
      ...params,
      destination: `${FetchDestination[params.destination]} (${params.destination})`,
    };
    window?.log?.debug('insecureNodeFetch request: ', logObj);
  }
}

function debugLogResponseIfEnabled(response: Response) {
  if (getFeatureFlag('debugInsecureNodeFetch')) {
    const logObj = {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    };
    window?.log?.debug('insecureNodeFetch response: ', logObj);
  }
}

export function setIsOnlineIfDifferent(v: boolean) {
  if (ReduxOnionSelectors.isOnlineOutsideRedux() !== v) {
    window.inboxStore?.dispatch(updateIsOnline(v));
    if (getFeatureFlag('debugOnlineState')) {
      window?.log?.debug(`Setting isOnline to ${v}`);
    }
  }
}

enum NodeFetchErrorCode {
  ENETUNREACH = 'ENETUNREACH',
  EHOSTUNREACH = 'EHOSTUNREACH',
}

export enum FetchDestination {
  SERVICE_NODE = 1,
  SEED_NODE = 2,
  SESSION_SERVER = 3,
  SOGS = 4,
  PUBLIC = 5,
}

function isFetchError(e: Error): e is FetchError {
  return 'code' in e;
}

function isClientOfflineFromError(e: FetchError) {
  return e.code === NodeFetchErrorCode.EHOSTUNREACH || e.code === NodeFetchErrorCode.ENETUNREACH;
}

// If a request succeeds and was for any destination on the Session Network we want to set online to true.
function handleGoOnline(response: Response, destination: FetchDestination) {
  if (
    response.ok &&
    (destination === FetchDestination.SERVICE_NODE ||
      destination === FetchDestination.SEED_NODE ||
      destination === FetchDestination.SESSION_SERVER ||
      destination === FetchDestination.SOGS)
  ) {
    setIsOnlineIfDifferent(true);
  }
}

// Only go offline if the device itself is offline
function handleGoOffline(error: Error) {
  if (
    !navigator.onLine ||
    error.message === ERROR_CODE_NO_CONNECT ||
    (isFetchError(error) && isClientOfflineFromError(error))
  ) {
    setIsOnlineIfDifferent(false);
  }
}

type NodeFetchParams = {
  url: RequestInfo;
  fetchOptions?: RequestInit;
  destination: FetchDestination;
  caller: string;
};

type ProxySettings = {
  enabled: boolean;
  host: string;
  port: number;
  username?: string;
  password?: string;
};

type TlsOptionKey =
  | 'ca'
  | 'cert'
  | 'key'
  | 'rejectUnauthorized'
  | 'checkServerIdentity'
  | 'servername'
  | 'ciphers'
  | 'minVersion'
  | 'maxVersion';

class SocksProxyAgentWithTls extends SocksProxyAgent {
  private readonly tlsOptions?: Partial<Record<TlsOptionKey, unknown>>;

  constructor(
    proxyUrl: string,
    options: ConstructorParameters<typeof SocksProxyAgent>[1],
    tlsOptions?: Partial<Record<TlsOptionKey, unknown>>
  ) {
    super(proxyUrl, options);
    this.tlsOptions = tlsOptions;
  }

  async connect(req: unknown, opts: any) {
    if (opts?.secureEndpoint && this.tlsOptions) {
      Object.assign(opts, this.tlsOptions);
    }
    return super.connect(req as any, opts);
  }
}

function getTlsOptionsFromAgent(agent: RequestInit['agent']): Partial<Record<TlsOptionKey, unknown>> {
  if (!agent || typeof agent === 'function') {
    return {};
  }

  const options = (agent as { options?: Record<string, unknown> }).options;
  if (!options || typeof options !== 'object') {
    return {};
  }

  const tlsOptionKeys: Array<TlsOptionKey> = [
    'ca',
    'cert',
    'key',
    'rejectUnauthorized',
    'checkServerIdentity',
    'servername',
    'ciphers',
    'minVersion',
    'maxVersion',
  ];
  const tlsOptions: Partial<Record<TlsOptionKey, unknown>> = {};

  tlsOptionKeys.forEach(key => {
    if (options[key] !== undefined) {
      tlsOptions[key] = options[key];
    }
  });

  return tlsOptions;
}

// Cache for proxy agents with different TLS configurations
const cachedAgents = new Map<string, SocksProxyAgent>();

function getProxySettings(): ProxySettings | undefined {
  if (typeof window === 'undefined' || !window.getSettingValue) {
    return undefined;
  }

  const enabled = Boolean(window.getSettingValue(SettingsKey.proxyEnabled));
  if (!enabled) {
    return undefined;
  }

  const host = (window.getSettingValue(SettingsKey.proxyHost) as string) || '';
  const portValue = window.getSettingValue(SettingsKey.proxyPort);
  const port = typeof portValue === 'number' ? portValue : parseInt(String(portValue || ''), 10);
  const username = (window.getSettingValue(SettingsKey.proxyUsername) as string) || '';
  const password = (window.getSettingValue(SettingsKey.proxyPassword) as string) || '';

  if (!host || !port || Number.isNaN(port)) {
    return undefined;
  }

  return {
    enabled,
    host,
    port,
    username: username || undefined,
    password: password || undefined,
  };
}

export function isProxyEnabled(): boolean {
  return getProxySettings() !== undefined;
}

function hasTlsOptions(tlsOptions: Partial<Record<TlsOptionKey, unknown>>): boolean {
  return Object.keys(tlsOptions).length > 0;
}

function buildTlsOptionsCacheKey(
  tlsOptions: Partial<Record<TlsOptionKey, unknown>>
): string | undefined {
  if (!hasTlsOptions(tlsOptions)) {
    return 'no-tls';
  }

  if (typeof tlsOptions.checkServerIdentity === 'function') {
    return undefined;
  }

  const parts = Object.entries(tlsOptions)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}:${value.map(item => String(item)).join(',')}`;
      }

      return `${key}:${String(value)}`;
    });

  return parts.length ? parts.join('|') : 'no-tls';
}

function getProxyAgent(
  tlsOptions: Partial<Record<TlsOptionKey, unknown>> = {}
): SocksProxyAgent | undefined {
  const settings = getProxySettings();
  if (!settings) {
    window?.log?.debug('getProxyAgent: No proxy settings configured');
    return undefined;
  }

  const auth =
    settings.username && settings.password
      ? `${encodeURIComponent(settings.username)}:${encodeURIComponent(settings.password)}@`
      : '';
  const proxyUrl = `socks5h://${auth}${settings.host}:${settings.port}`;

  const tlsOptionsKey = buildTlsOptionsCacheKey(tlsOptions);
  const cacheKey = tlsOptionsKey ? `${proxyUrl}:${tlsOptionsKey}` : undefined;

  if (cacheKey) {
    // Check cache to reuse existing agents (performance optimization)
    const cachedAgent = cachedAgents.get(cacheKey);
    if (cachedAgent) {
      return cachedAgent;
    }
  }

  // Create new agent with SOCKS5 configuration
  window?.log?.info(`getProxyAgent: Creating new SOCKS5 agent for ${settings.host}:${settings.port}`);
  if (hasTlsOptions(tlsOptions)) {
    window?.log?.debug(
      `getProxyAgent: Applying TLS options to SOCKS agent: ${Object.keys(tlsOptions).join(', ')}`
    );
  }
  const agent = new SocksProxyAgentWithTls(
    proxyUrl,
    {
      timeout: 30000, // 30 seconds timeout for SOCKS connection
    },
    useTlsOptions ? tlsOptions : undefined
  );

  if (cacheKey) {
    // Cache the agent
    cachedAgents.set(cacheKey, agent);
  }

  return agent;
}

export async function insecureNodeFetch(params: NodeFetchParams) {
  try {
    // Extract TLS options from the original agent (if present) to preserve security settings
    // This ensures certificate pinning and other TLS configurations work through the proxy
    const tlsOptions = getTlsOptionsFromAgent(params.fetchOptions?.agent);
    const proxyAgent = getProxyAgent(tlsOptions);

    // CRITICAL: Proxy agent must override any other agent (like sslAgent) to route through SOCKS
    const fetchOptions = {
      ...params.fetchOptions,
      ...(proxyAgent ? { agent: proxyAgent } : {}),
    } as RequestInit;

    if (proxyAgent) {
      window?.log?.info(`insecureNodeFetch: Using proxy for request to ${params.url}`);
    }

    debugLogRequestIfEnabled(params);
    const result = await nodeFetch(params.url, fetchOptions);
    handleGoOnline(result, params.destination);
    debugLogResponseIfEnabled(result);
    return result;
  } catch (e) {
    handleGoOffline(e);
    // Enhanced error logging for debugging proxy issues
    const errorDetails = {
      message: (e as Error).message,
      name: (e as Error).name,
      code: (e as any).code,
      errno: (e as any).errno,
      syscall: (e as any).syscall,
      type: (e as any).type,
      stack: (e as Error).stack?.split('\n').slice(0, 3).join('\n'),
    };
    window?.log?.error('insecureNodeFetch error', errorDetails);
    throw e;
  }
}
