import nodeFetch, {
  type FetchError,
  type RequestInfo,
  type RequestInit,
  type Response,
} from 'node-fetch';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { SettingsKey } from '../../data/settings-key';
import { ReduxOnionSelectors } from '../../state/selectors/onions';
import { ERROR_CODE_NO_CONNECT } from '../apis/snode_api/SNodeAPI';
import { getFeatureFlag } from '../../state/ducks/types/releasedFeaturesReduxTypes';
import { updateIsOnline } from '../../state/ducks/onions';
import { buildProxyUrl, normalizeProxySettings } from './ProxySettings';

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

type NodeFetchParams = {
  url: RequestInfo;
  fetchOptions?: RequestInit;
  destination: FetchDestination;
  caller: string;
  tlsOptions?: Partial<Record<TlsOptionKey, unknown>>;
};

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

const cachedAgents = new Map<string, SocksProxyAgent>();

function isFetchError(e: Error): e is FetchError {
  return 'code' in e;
}

function isClientOfflineFromError(e: FetchError) {
  return e.code === NodeFetchErrorCode.EHOSTUNREACH || e.code === NodeFetchErrorCode.ENETUNREACH;
}

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

function handleGoOffline(error: Error) {
  if (
    !navigator.onLine ||
    error.message === ERROR_CODE_NO_CONNECT ||
    (isFetchError(error) && isClientOfflineFromError(error))
  ) {
    setIsOnlineIfDifferent(false);
  }
}

function getProxySettings() {
  if (typeof window === 'undefined' || !window.getSettingValue) {
    return undefined;
  }

  return normalizeProxySettings({
    enabled: window.getSettingValue(SettingsKey.proxyEnabled),
    host: window.getSettingValue(SettingsKey.proxyHost),
    port: window.getSettingValue(SettingsKey.proxyPort),
    username: window.getSettingValue(SettingsKey.proxyUsername),
    password: window.getSettingValue(SettingsKey.proxyPassword),
  });
}

export function isProxyEnabled(): boolean {
  return getProxySettings() !== undefined;
}

function hasTlsOptions(tlsOptions?: Partial<Record<TlsOptionKey, unknown>>): boolean {
  return !!tlsOptions && Object.keys(tlsOptions).length > 0;
}

export function buildTlsOptionsCacheKey(
  tlsOptions?: Partial<Record<TlsOptionKey, unknown>>
): string | undefined {
  if (!hasTlsOptions(tlsOptions)) {
    return 'no-tls';
  }

  if (
    tlsOptions &&
    'checkServerIdentity' in tlsOptions &&
    typeof (tlsOptions as Record<string, unknown>).checkServerIdentity === 'function'
  ) {
    return undefined;
  }

  const parts = Object.entries(tlsOptions || {})
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
  tlsOptions: Partial<Record<TlsOptionKey, unknown>> | undefined,
  _destination?: FetchDestination
): SocksProxyAgent | undefined {
  const settings = getProxySettings();
  if (!settings) {
    return undefined;
  }

  const proxyUrl = buildProxyUrl(settings, { includeAuth: true, protocol: 'socks5h' });
  const tlsOpts = hasTlsOptions(tlsOptions) ? tlsOptions : undefined;
  const tlsOptionsKey = buildTlsOptionsCacheKey(tlsOpts);
  const cacheKey = tlsOptionsKey ? `${proxyUrl}:${tlsOptionsKey}` : undefined;

  if (cacheKey) {
    const cachedAgent = cachedAgents.get(cacheKey);
    if (cachedAgent) {
      return cachedAgent;
    }
  }

  const agent = new SocksProxyAgentWithTls(
    proxyUrl,
    {
      timeout: 30000,
    },
    tlsOpts
  );

  if (cacheKey) {
    cachedAgents.set(cacheKey, agent);
  }

  return agent;
}

function buildAgentForRequest(params: NodeFetchParams): RequestInit['agent'] | undefined {
  const proxyAgent = getProxyAgent(params.tlsOptions, params.destination);
  if (proxyAgent) {
    window?.log?.info(`insecureNodeFetch: using SOCKS5 proxy for ${FetchDestination[params.destination]}`);
    return proxyAgent;
  }

  return params.fetchOptions?.agent;
}

export async function insecureNodeFetch(params: NodeFetchParams) {
  try {
    const finalAgent = buildAgentForRequest(params);
    const fetchOptions = {
      ...params.fetchOptions,
      ...(finalAgent ? { agent: finalAgent } : {}),
    } as RequestInit;

    debugLogRequestIfEnabled(params);
    const result = await nodeFetch(params.url, fetchOptions);
    handleGoOnline(result, params.destination);
    debugLogResponseIfEnabled(result);
    return result;
  } catch (e) {
    handleGoOffline(e as Error);
    window?.log?.error(`insecureNodeFetch error: ${(e as Error).message}`);
    window?.log?.debug('insecureNodeFetch error details', {
      code: (e as any).code,
      errno: (e as any).errno,
      syscall: (e as any).syscall,
      type: (e as any).type,
      stack: (e as Error).stack?.split('\n').slice(0, 3).join('\n'),
    });
    throw e;
  }
}
