import { assert } from 'chai';
import type { BrowserWindow, DesktopCapturerSource, Session, WebFrameMain } from 'electron';
import Sinon from 'sinon';

import type { UserConfig } from '../../../../node/config/user_config';
import { installScreenSharePicker } from '../../../../node/screenShare';

type DisplayHandler = NonNullable<Parameters<Session['setDisplayMediaRequestHandler']>[0]>;
type IpcHandler = (event: { senderFrame: WebFrameMain | null }, ...args: Array<any>) => any;

const pageURL = 'file:///session/background.html';

function fakeSource(id: string): DesktopCapturerSource {
  return {
    id,
    name: `source ${id}`,
    display_id: '',
    appIcon: null as any,
    thumbnail: { isEmpty: () => true, toDataURL: () => '' } as any,
  };
}

function setup(
  getSources = Sinon.stub().resolves([fakeSource('screen:1'), fakeSource('window:2')]),
  screenAccess: () => 'granted' | 'denied' | 'restricted' = () => 'granted'
) {
  const mainFrame = { url: pageURL } as WebFrameMain;
  const handlers = new Map<string, IpcHandler>();
  const register = Sinon.spy();
  const window = {
    webContents: {
      mainFrame,
      isDestroyed: () => false,
      ipc: { handle: (channel: string, handler: IpcHandler) => handlers.set(channel, handler) },
      session: { setDisplayMediaRequestHandler: register },
      on: Sinon.stub(),
      once: Sinon.stub(),
    },
  } as unknown as BrowserWindow;
  installScreenSharePicker(window, pageURL, { get: () => true } as unknown as UserConfig, {
    getSources,
    screenAccess,
  });

  const displayHandler: DisplayHandler = register.firstCall.args[0];
  const event = { senderFrame: mainFrame };
  const request = {
    frame: mainFrame,
    securityOrigin: 'file://',
    audioRequested: false,
    videoRequested: true,
    userGesture: true,
  };
  const requestDisplay = () => {
    const respond = Sinon.spy();
    displayHandler(request, respond);
    return respond.firstCall.args[0];
  };
  return {
    request,
    displayHandler,
    requestDisplay,
    listSources: () => handlers.get('get-screen-share-sources')!(event),
    pick: (id: string | null) => handlers.get('set-screen-share-source')!(event, id),
  };
}

describe('screen share picker', () => {
  afterEach(() => {
    Sinon.restore();
  });

  it('declines requests from a closed frame and requests with no selected source', () => {
    const { request, displayHandler } = setup();
    const respond = Sinon.spy();
    displayHandler({ ...request, frame: null }, respond);
    displayHandler(request, respond);

    assert.deepEqual(respond.args, [[null], [null]]);
  });

  it('grants the picked source to one request only', async () => {
    const picker = setup();
    const listed = await picker.listSources();
    assert.deepEqual(
      listed.sources.map((s: { id: string }) => s.id),
      ['screen:1', 'window:2']
    );

    assert.isTrue(await picker.pick('window:2'));
    assert.strictEqual(picker.requestDisplay()?.video?.id, 'window:2');
    assert.isNull(picker.requestDisplay());
  });

  it('refuses a source that was not offered', async () => {
    const picker = setup();
    await picker.listSources();

    assert.isFalse(await picker.pick('screen:99'));
    assert.isNull(picker.requestDisplay());
  });

  it('declines a selection older than five seconds', async () => {
    const clock = Sinon.useFakeTimers({ now: 1_000_000 });
    const picker = setup();
    await picker.listSources();
    assert.isTrue(await picker.pick('screen:1'));

    clock.tick(5001);
    assert.isNull(picker.requestDisplay());
  });

  it('drops sources listed after the picker was cancelled', async () => {
    let resolveSources: (sources: Array<DesktopCapturerSource>) => void = () => {};
    const picker = setup(
      Sinon.stub().returns(
        new Promise<Array<DesktopCapturerSource>>(resolve => {
          resolveSources = resolve;
        })
      )
    );
    const listing = picker.listSources();
    await picker.pick(null);
    resolveSources([fakeSource('screen:1')]);

    assert.isEmpty((await listing).sources);
    assert.isFalse(await picker.pick('screen:1'));
  });

  it('asks macOS for sources while access is not granted yet, without offering them', async () => {
    const getSources = Sinon.stub().resolves([fakeSource('screen:1')]);
    const picker = setup(getSources, () => 'denied');

    const listed = await picker.listSources();

    assert.isTrue(getSources.calledOnce, 'the capture attempt is what makes macOS prompt');
    assert.strictEqual(listed.screenAccess, 'denied');
    assert.isEmpty(listed.sources);
    assert.isFalse(await picker.pick('screen:1'));
  });

  it('does not ask for sources when screen capture is restricted', async () => {
    const getSources = Sinon.stub().resolves([fakeSource('screen:1')]);
    const picker = setup(getSources, () => 'restricted');

    assert.isEmpty((await picker.listSources()).sources);
    assert.isTrue(getSources.notCalled);
  });
});
