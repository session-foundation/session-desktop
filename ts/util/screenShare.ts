import { ipcRenderer } from 'electron';

export type ScreenShareSource = {
  id: string;
  name: string;
  thumbnailDataUrl: string | null;
};

export type ScreenShareSourcesResult = {
  screenAccess: 'granted' | 'denied' | 'restricted' | 'not-determined' | 'unknown';
  sources: Array<ScreenShareSource>;
};

export const getScreenShareSources = (): Promise<ScreenShareSourcesResult> =>
  ipcRenderer.invoke('get-screen-share-sources');

export const setScreenShareSource = (sourceId: string | null): Promise<boolean> =>
  ipcRenderer.invoke('set-screen-share-source', sourceId);

export const openScreenRecordingSettings = (): Promise<void> =>
  ipcRenderer.invoke('open-screen-recording-settings');
