import { BrowserWindow } from 'electron';

const SCREEN_OFF_IDLE_MS = 30000;

let screenOff = false;
let idleTimer: NodeJS.Timeout | null = null;
let mainWindow: BrowserWindow | null = null;
const callbacks: {
  onScreenOff: Array<() => void>;
  onScreenOn: Array<() => void>;
} = {
  onScreenOff: [],
  onScreenOn: [],
};

export function isScreenOff(): boolean {
  return screenOff;
}

export function onScreenOff(callback: () => void): void {
  callbacks.onScreenOff.push(callback);
}

export function onScreenOn(callback: () => void): void {
  callbacks.onScreenOn.push(callback);
}

function notifyRenderer(multiplier: number): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('power-state-changed', multiplier);
  }
}

function setScreenOff(): void {
  if (screenOff) {
    return;
  }
  screenOff = true;
  window.log.info('[powerState] Screen off detected');
  notifyRenderer(8);
  callbacks.onScreenOff.forEach(cb => cb());
}

function setScreenOn(): void {
  if (!screenOff) {
    return;
  }
  screenOff = false;
  window.log.info('[powerState] Screen on detected');
  notifyRenderer(1);
  callbacks.onScreenOn.forEach(cb => cb());
}

export function startIdleTimer(ms: number = SCREEN_OFF_IDLE_MS): void {
  cancelIdleTimer();
  idleTimer = global.setTimeout(() => {
    setScreenOff();
  }, ms);
}

export function cancelIdleTimer(): void {
  if (idleTimer) {
    global.clearTimeout(idleTimer);
    idleTimer = null;
  }
}

function getMainWindow(): BrowserWindow | null {
  const wins = BrowserWindow.getAllWindows();
  return wins.length > 0 ? wins[0] : null;
}

function handleFocusChange(): void {
  const win = getMainWindow();
  if (!win) {
    return;
  }

  if (win.isFocused()) {
    cancelIdleTimer();
    setScreenOn();
  } else {
    startIdleTimer();
  }
}

export function initPowerState(win?: BrowserWindow): void {
  window.log.info('[powerState] Initializing power state management');

  mainWindow = win || getMainWindow();
  if (!mainWindow) {
    console.error('[powerState] No main window found');
    return;
  }

  mainWindow.on('focus', handleFocusChange);
  mainWindow.on('blur', () => {
    startIdleTimer();
  });

  if (!mainWindow.isFocused()) {
    startIdleTimer();
  }
}

export function getPowerStateMultiplier(): number {
  return screenOff ? 8 : 1;
}
