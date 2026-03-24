export type ProxySettings = {
  enabled: true;
  host: string;
  port: number;
  username?: string;
  password?: string;
};

export type ProxySettingsInput = {
  enabled?: unknown;
  host?: unknown;
  port?: unknown;
  username?: unknown;
  password?: unknown;
};

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePort(value: unknown): number {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    return Number.parseInt(value.trim(), 10);
  }

  return Number.NaN;
}

export function normalizeProxySettings(input: ProxySettingsInput): ProxySettings | undefined {
  if (!input.enabled) {
    return undefined;
  }

  const host = normalizeString(input.host);
  const port = normalizePort(input.port);

  if (!host || Number.isNaN(port) || port < 1 || port > 65535) {
    return undefined;
  }

  const username = normalizeString(input.username);
  const password = normalizeString(input.password);

  return {
    enabled: true,
    host,
    port,
    username: username || undefined,
    password: password || undefined,
  };
}

export function buildProxyUrl(
  settings: ProxySettings,
  options?: { includeAuth?: boolean; protocol?: 'socks5' | 'socks5h' }
): string {
  const includeAuth = options?.includeAuth ?? true;
  const protocol = options?.protocol ?? 'socks5';
  const auth =
    includeAuth && settings.username && settings.password
      ? `${encodeURIComponent(settings.username)}:${encodeURIComponent(settings.password)}@`
      : '';

  return `${protocol}://${auth}${settings.host}:${settings.port}`;
}
