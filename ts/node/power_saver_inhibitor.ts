import { powerMonitor, powerSaveBlocker } from 'electron';
import { ChildProcess, spawn } from 'child_process';

import packageJson from '../../package.json';

let inhibitProcess: ChildProcess | null = null;
let electronBlockerId: number | null = null;

function preventAppSuspensionElectron() {
  if (electronBlockerId) {
    throw new Error('Electron blocker already running');
  }
  electronBlockerId = powerSaveBlocker.start('prevent-app-suspension');
}

powerMonitor.on('resume', () => {
  startAppSuspensionBlocker();
});

export function startAppSuspensionBlocker(): void {
  if (process.env.SESSION_ALLOW_APP_SUSPENSION) {
    console.log('SESSION_ALLOW_APP_SUSPENSION is set, so we do not prevent app suspension');
    return;
  }
  if (process.platform !== 'linux') {
    preventAppSuspensionElectron();
    return;
  }

  const proc = spawn(
    'systemd-inhibit',
    [
      '--what=idle',
      `--who=${packageJson.productName}`,
      `--why=Keeping ${packageJson.name} running`,
      '--mode=block',
      'sleep',
      'infinity',
    ],
    { stdio: 'ignore', detached: false }
  );

  proc.on('error', () => {
    // systemd-inhibit not available — fall back to Electron (Flatpak sandbox etc.)
    preventAppSuspensionElectron();
  });

  proc.on('exit', () => {
    inhibitProcess = null;
  });
  inhibitProcess = proc;
}

export function stopAppSuspensionBlocker(): void {
  inhibitProcess?.kill();
  inhibitProcess = null;

  if (electronBlockerId !== null) {
    powerSaveBlocker.stop(electronBlockerId);
    electronBlockerId = null;
  }
}
