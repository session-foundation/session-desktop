import type { ReleaseChannels } from '../updater/types';

let latestRelease: string | undefined;
let releaseChannel: ReleaseChannels | undefined;

export function setLatestRelease(release: [string, ReleaseChannels]) {
  latestRelease = release[0];
  releaseChannel = release[1];
}

export function getLatestRelease() {
  return [latestRelease, releaseChannel];
}
