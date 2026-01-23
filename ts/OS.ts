import os from 'os';
import _ from 'lodash';
import semver from 'semver';
import { existsSync, readFileSync } from 'fs';

export const isMacOS = () => process.platform === 'darwin';
export const isLinux = () => process.platform === 'linux';
export const isWindows = (minVersion?: string) => {
  const osRelease = os.release();

  if (process.platform !== 'win32') {
    return false;
  }

  return _.isUndefined(minVersion) ? true : semver.gte(osRelease, minVersion);
};

export const getOSArchitecture = () => os.arch();
export const getOSPlatform = () => os.platform();

export const isDebianBased = () => {
  if (!isLinux()) {
    return false;
  }
  try {
    const hasDebianVersion = existsSync('/etc/debian_version');
    if (hasDebianVersion) {
      return true;
    }
  } catch (e) {
    // ignore
  }
  try {
    const osRelease = readFileSync('/etc/os-release', 'utf-8');
    const idLike = osRelease.match(/ID_LIKE="?([^"\n]+)"?/)?.[1] || '';
    const id = osRelease.match(/^ID="?([^"\n]+)"?/m)?.[1] || '';

    return id === 'debian' || idLike.includes('debian') || idLike.includes('ubuntu');
  } catch (e2) {
    return false;
  }
};

export const isRunningViaAppImage = () => {
  if (!isLinux()) {
    return false;
  }
  return !!process.env.APPIMAGE;
};
