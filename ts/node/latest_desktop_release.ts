let latestRelease: string | undefined;

export function setLatestRelease(release: string) {
  latestRelease = release;
}

export function getLatestRelease() {
  return latestRelease;
}
