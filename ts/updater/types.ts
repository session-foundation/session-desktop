export const LATEST_CHANNEL = 'latest' as const;
export const ALPHA_CHANNEL = 'alpha' as const;

export type ReleaseChannels = typeof LATEST_CHANNEL | typeof ALPHA_CHANNEL;

export const isReleaseChannel = (str: unknown): str is ReleaseChannels =>
  str === LATEST_CHANNEL || str === ALPHA_CHANNEL;
