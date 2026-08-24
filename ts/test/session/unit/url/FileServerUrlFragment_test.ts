import { expect } from 'chai';

import {
  addProfileKeyToUrl,
  extractDetailsFromUrlFragment,
  queryParamDeterministicEncryption,
  queryParamServerEd25519Pubkey,
  stringifyFragmentParams,
} from '../../../../session/url';

/**
 * The fragment is the only thing telling a reader which encryption a file used, and libSession
 * (so iOS) compares it against 'd' with string equality. URLSearchParams.toString() writes 'd=',
 * which iOS reads as legacy, so nothing that leaves this client may be serialised with it.
 */
describe('file server url fragment', () => {
  const edPk = '0123456789abcdef0123456789abcdef00000000000000000000000000000000';
  const profileKey = 'aa'.repeat(32);

  /** Mirrors how uploadFileToFsWithOnionV4 builds the fragment. */
  function buildFragment({ pubkey }: { pubkey?: string } = {}) {
    const urlParams = new URLSearchParams();
    if (pubkey) {
      urlParams.set(queryParamServerEd25519Pubkey, pubkey);
    }
    urlParams.set(queryParamDeterministicEncryption, '');
    return stringifyFragmentParams(urlParams);
  }

  /** libSession: `if (fragment == FRAGMENT_STREAM_ENCRYPTION)` over `split(fragment, "&")`. */
  function libSessionWantsStreamDecryption(url: string) {
    return new URL(url).hash
      .slice(1)
      .split('&')
      .some(fragment => fragment === 'd');
  }

  describe('stringifyFragmentParams', () => {
    it('writes a valueless key bare', () => {
      expect(buildFragment()).to.equal('d');
    });

    it('writes a valueless key bare alongside a valued one', () => {
      expect(buildFragment({ pubkey: edPk })).to.equal(`p=${edPk}&d`);
    });

    it('writes nothing when there are no params', () => {
      expect(stringifyFragmentParams(new URLSearchParams())).to.equal('');
    });

    it('is what URLSearchParams would not have produced', () => {
      const urlParams = new URLSearchParams();
      urlParams.set(queryParamDeterministicEncryption, '');
      expect(urlParams.toString()).to.equal('d=');
      expect(stringifyFragmentParams(urlParams)).to.equal('d');
    });
  });

  describe('what libSession and iOS accept', () => {
    it('recognises the fragment we write', () => {
      const fragment = buildFragment();
      expect(
        libSessionWantsStreamDecryption(`http://filev2.getsession.org/file/abc123#${fragment}`)
      ).to.equal(true);
    });

    it('recognises it beside a server pubkey', () => {
      const fragment = buildFragment({ pubkey: edPk });
      expect(
        libSessionWantsStreamDecryption(`http://example.com/file/abc123#${fragment}`)
      ).to.equal(true);
    });

    it('still recognises it after a profile key round trip', () => {
      /// OutgoingUserProfile rebuilds the fragment to attach and strip the profile key, and that
      /// rebuild is on the path that hands the avatar pointer to the other platforms.
      const uploaded = new URL(`http://filev2.getsession.org/file/abc123#${buildFragment()}`);
      const withKey = addProfileKeyToUrl(uploaded, profileKey);

      expect(libSessionWantsStreamDecryption(withKey.toString())).to.equal(true);

      const { urlWithoutProfileKey, profileKey: readBack } = extractDetailsFromUrlFragment(withKey);
      expect(readBack).to.equal(profileKey);
      expect(libSessionWantsStreamDecryption(urlWithoutProfileKey)).to.equal(true);
    });
  });

  describe('what we read', () => {
    it('accepts the bare "d" we and the other platforms write', () => {
      expect(
        extractDetailsFromUrlFragment(new URL('http://filev2.getsession.org/file/abc123#d'))
          .deterministicEncryption
      ).to.equal(true);
    });

    it('still accepts the legacy "d=" spelling we used to write', () => {
      expect(
        extractDetailsFromUrlFragment(new URL('http://filev2.getsession.org/file/abc123#d='))
          .deterministicEncryption
      ).to.equal(true);
    });

    it('accepts "d" beside a server pubkey in either order', () => {
      expect(
        extractDetailsFromUrlFragment(new URL(`http://example.com/file/abc123#d&p=${edPk}`))
          .deterministicEncryption
      ).to.equal(true);
      expect(
        extractDetailsFromUrlFragment(new URL(`http://example.com/file/abc123#p=${edPk}&d`))
          .deterministicEncryption
      ).to.equal(true);
    });

    it('reads no flag when the fragment is absent', () => {
      expect(
        extractDetailsFromUrlFragment(new URL('http://filev2.getsession.org/file/abc123'))
          .deterministicEncryption
      ).to.equal(false);
    });
  });
});
