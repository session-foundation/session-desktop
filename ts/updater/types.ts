export const STABLE_CHANNEL = 'stable' as const; // The default channel aka. 'latest' for electron-updater
export const ALPHA_CHANNEL = 'alpha' as const;

export type ReleaseChannels = typeof STABLE_CHANNEL | typeof ALPHA_CHANNEL;

export const isReleaseChannel = (str: unknown): str is ReleaseChannels =>
  str === STABLE_CHANNEL || str === ALPHA_CHANNEL;
