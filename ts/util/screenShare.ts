import { ipcRenderer } from 'electron';

export type ScreenShareSource = {
  id: string;
  name: string;
  isScreen: boolean;
  thumbnailDataUrl: string | null;
};

export type ScreenShareSourcesResult = {
  /**
   * macOS only ever reports something other than 'granted' here; every other platform reports
   * 'granted' because it has no equivalent gate. When it is not granted, `sources` is empty and
   * the user has to allow Screen Recording for this app in System Settings first.
   */
  screenAccess: 'granted' | 'denied' | 'restricted' | 'not-determined' | 'unknown';
  sources: Array<ScreenShareSource>;
};

/**
 * Ask the main process for the screens and windows which can be shared.
 * Thumbnails come back as data URLs so the renderer needs no extra privileges.
 */
export async function getScreenShareSources(): Promise<ScreenShareSourcesResult> {
  return ipcRenderer.invoke('get-screen-share-sources');
}

/**
 * Tell the main process which source the user picked. The display-media request handler there
 * consumes this the next time `getDisplayMedia()` is called, which is how Session's own picker
 * replaces the one Electron does not ship.
 */
export async function setScreenShareSource(sourceId: string | null): Promise<boolean> {
  return ipcRenderer.invoke('set-screen-share-source', sourceId);
}

/**
 * macOS only: open the Screen Recording pane of System Settings. Returns false elsewhere.
 */
export async function openScreenRecordingSettings(): Promise<boolean> {
  return ipcRenderer.invoke('open-screen-recording-settings');
}
