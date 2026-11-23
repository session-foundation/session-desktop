import { assert } from 'chai';
import type { BrowserWindow, Session, WebFrameMain } from 'electron';
import Sinon from 'sinon';

import type { UserConfig } from '../../../../node/config/user_config';
import { installScreenSharePicker } from '../../../../node/screenShare';

describe('screen share picker', () => {
  const pageURL = 'file:///session/background.html';

  it('declines requests from a closed frame and requests with no selected source', () => {
    const mainFrame = { url: pageURL } as WebFrameMain;
    const register = Sinon.spy();
    const window = {
      webContents: {
        mainFrame,
        isDestroyed: () => false,
        ipc: { handle: Sinon.stub() },
        session: { setDisplayMediaRequestHandler: register },
        on: Sinon.stub(),
        once: Sinon.stub(),
      },
    } as unknown as BrowserWindow;
    installScreenSharePicker(window, pageURL, { get: () => true } as unknown as UserConfig);

    const handle: Parameters<Session['setDisplayMediaRequestHandler']>[0] =
      register.firstCall.args[0];
    if (!handle) {
      throw new Error('Expected the picker to register a display media handler');
    }
    const respond = Sinon.spy();
    const request = {
      frame: mainFrame,
      securityOrigin: 'file://',
      audioRequested: false,
      videoRequested: true,
      userGesture: true,
    };
    handle({ ...request, frame: null }, respond);
    handle(request, respond);

    assert.deepEqual(respond.args, [[null], [null]]);
  });
});
