import { readFileSync } from 'fs';
import { isLinux } from '../../OS';

/**
 * The return of this function should be used as override of `sse42FromCPUInfo` if different than null.
 * Used for testing purposes.
 * @returns true when process.env.SESSION_SSE42_OVERRIDE === '1', false when process.env.SESSION_SSE42_OVERRIDE === '0', null otherwise
 */
function overrideSSE42IsSupported() {
  if (process.env.SESSION_SSE42_OVERRIDE === '1') {
    return true;
  }

  if (process.env.SESSION_SSE42_OVERRIDE === '0') {
    return false;
  }
  return null;
}

/**
 * Checks from /proc/cpuinfo if the CPU supports SSE 4.2 instructions.
 */
function sse42FromCPUInfo() {
  try {
    const cpuinfo = readFileSync('/proc/cpuinfo', 'utf8');
    const flagsMatch = cpuinfo.match(/flags\s*:\s*(.+)/m);

    if (flagsMatch) {
      const flags = flagsMatch[1].split(/\s+/);

      const sseFlagFound = flags.includes('sse4_2');
      console.info('SSE 4.2 flag found:', sseFlagFound);
      return sseFlagFound;
    }
    return false;
  } catch (error) {
    console.warn('Could not read /proc/cpuinfo:', error);
    return false;
  }
}

function isLinuxX64() {
  return isLinux() && process.arch === 'x64';
}

/**
 * Returns true if sharp is supported on the current platform.
 * On linux x64, the CPU needs to support SSE 4.2 instructions to process images.
 * This function checks if we are on linux x64 and if yes, checks `/proc/cpuinfo` for the SSE 4.2 flag.
 */
export function isSharpSupported() {
  const sse42Override = overrideSSE42IsSupported();
  if (sse42Override !== null) {
    return sse42Override;
  }
  if (isLinuxX64()) {
    return sse42FromCPUInfo();
  }
  // sharp doesn't need sse42 on other platforms than linux x64 as of 18/09/2025
  return true;
}
