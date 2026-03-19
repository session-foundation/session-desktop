import { expect } from 'chai';

import { buildTlsOptionsCacheKey } from '../../../../session/utils/InsecureNodeFetch';
import { buildProxyUrl, normalizeProxySettings } from '../../../../session/utils/ProxySettings';

describe('ProxySettings', () => {
  it('normalizes valid proxy settings', () => {
    const settings = normalizeProxySettings({
      enabled: true,
      host: ' 127.0.0.1 ',
      port: '9050',
      username: ' alice ',
      password: ' secret ',
    });

    expect(settings).to.deep.equal({
      enabled: true,
      host: '127.0.0.1',
      port: 9050,
      username: 'alice',
      password: 'secret',
    });
  });

  it('rejects invalid proxy settings', () => {
    expect(
      normalizeProxySettings({
        enabled: true,
        host: '',
        port: '9050',
      })
    ).to.be.eq(undefined);

    expect(
      normalizeProxySettings({
        enabled: true,
        host: '127.0.0.1',
        port: '99999',
      })
    ).to.be.eq(undefined);
  });

  it('builds proxy urls with and without auth', () => {
    const settings = normalizeProxySettings({
      enabled: true,
      host: '127.0.0.1',
      port: 9050,
      username: 'user',
      password: 'pass',
    });

    if (!settings) {
      throw new Error('Expected settings to normalize');
    }

    expect(buildProxyUrl(settings, { includeAuth: true, protocol: 'socks5' })).to.be.eq(
      'socks5://user:pass@127.0.0.1:9050'
    );
    expect(buildProxyUrl(settings, { includeAuth: false, protocol: 'socks5h' })).to.be.eq(
      'socks5h://127.0.0.1:9050'
    );
  });

  it('omits tls cache keys when checkServerIdentity is a function', () => {
    expect(buildTlsOptionsCacheKey()).to.be.eq('no-tls');
    expect(
      buildTlsOptionsCacheKey({
        rejectUnauthorized: false,
        checkServerIdentity: () => undefined,
      })
    ).to.be.eq(undefined);
    expect(
      buildTlsOptionsCacheKey({
        servername: 'seed1.getsession.org',
        rejectUnauthorized: false,
      })
    ).to.be.eq('rejectUnauthorized:false|servername:seed1.getsession.org');
  });
});
