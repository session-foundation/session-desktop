import {
  BrowserWindow,
  desktopCapturer,
  DesktopCapturerSource,
  shell,
  systemPreferences,
  WebFrameMain,
} from 'electron';

import { UserConfig } from './config/user_config';
import type { ScreenShareSourcesResult } from '../util/screenShare';

export function installScreenSharePicker(
  window: BrowserWindow,
  pageURL: string,
  config: UserConfig
) {
  const contents = window.webContents;
  const page = new URL(pageURL);
  const session = contents.session;
  let generation = 0;
  let choices: Array<DesktopCapturerSource> = [];
  let selection: { source: DesktopCapturerSource; expires: number } | null = null;

  function clear() {
    generation += 1;
    choices = [];
    selection = null;
  }

  function allowed(frame: WebFrameMain | null) {
    if (
      !frame ||
      contents.isDestroyed() ||
      frame !== contents.mainFrame ||
      !config.get('mediaPermissions')
    ) {
      return false;
    }
    const current = new URL(frame.url);
    return (
      current.protocol === page.protocol &&
      current.host === page.host &&
      current.pathname === page.pathname
    );
  }

  const screenAccess = () =>
    process.platform === 'darwin' ? systemPreferences.getMediaAccessStatus('screen') : 'granted';

  contents.ipc.handle(
    'get-screen-share-sources',
    async (event): Promise<ScreenShareSourcesResult> => {
      if (!allowed(event.senderFrame)) {
        return { screenAccess: 'denied', sources: [] };
      }
      clear();
      const request = generation;
      let status = screenAccess();
      if (status === 'granted' || status === 'not-determined') {
        const sources = await desktopCapturer.getSources({
          types: ['screen', 'window'],
          thumbnailSize: { width: 320, height: 180 },
        });
        status = screenAccess();
        if (request === generation && allowed(event.senderFrame) && status === 'granted') {
          choices = sources;
          return {
            screenAccess: status,
            sources: sources.map(source => ({
              id: source.id,
              name: source.name,
              thumbnailDataUrl: source.thumbnail.isEmpty() ? null : source.thumbnail.toDataURL(),
            })),
          };
        }
      }
      return { screenAccess: status, sources: [] };
    }
  );

  contents.ipc.handle('set-screen-share-source', (event, id: string | null) => {
    if (!allowed(event.senderFrame)) {
      return false;
    }
    const source = choices.find(item => item.id === id);
    clear();
    if (!source) {
      return false;
    }
    selection = { source, expires: Date.now() + 5000 };
    return true;
  });

  contents.ipc.handle('open-screen-recording-settings', async event => {
    if (process.platform === 'darwin' && allowed(event.senderFrame)) {
      await shell.openExternal(
        'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
      );
    }
  });

  session.setDisplayMediaRequestHandler((request, respond) => {
    if (
      !allowed(request.frame) ||
      !request.userGesture ||
      !request.videoRequested ||
      request.audioRequested
    ) {
      respond({});
      return;
    }
    const picked = selection;
    clear();
    respond(
      picked && picked.expires >= Date.now() && screenAccess() === 'granted'
        ? { video: picked.source }
        : {}
    );
  });

  contents.on('did-start-navigation', details => {
    if (details.isMainFrame && !details.isSameDocument) {
      clear();
    }
  });
  contents.once('destroyed', () => {
    clear();
    session.setDisplayMediaRequestHandler(null);
  });
}
