import chai from 'chai';
import { describe } from 'mocha';

import { detectMissingConfigHashes } from '../../../../session/apis/snode_api/configExpiryDetection';
import { ExpireMessagesResultsContent } from '../../../../session/apis/snode_api/types';

const { expect } = chai;

/**
 * The vectors from CONFIG_EXPIRY_DETECTION_SPEC.md §6, one test each. iOS and Android implement
 * the same rule separately, and these vectors are the only thing keeping the three in agreement —
 * so don't relax one to make an implementation pass, change the spec.
 */

const H1 = 'hash1';
const H2 = 'hash2';

/** the fields detection doesn't read, but which are always on a real sub-response */
const filler = { expiry: 1696915132498, signature: 'sig' };

function swarmOf(...subResponses: Array<Partial<ExpireMessagesResultsContent[string]>>) {
  const swarm: ExpireMessagesResultsContent = {};
  subResponses.forEach((subResponse, index) => {
    swarm[`snode${index}`] = { ...filler, updated: [], ...subResponse } as any;
  });
  return swarm;
}

function detect(
  swarm: ExpireMessagesResultsContent | null,
  { requestedHashes = [H1, H2], requestSetExtend = true } = {}
) {
  return detectMissingConfigHashes({ requestedHashes, swarm, requestSetExtend });
}

describe('configExpiryDetection', () => {
  it('V1: everything updated -> nothing missing', () => {
    const result = detect(swarmOf({ updated: [H1, H2], unchanged: {} }));

    expect(result).to.be.deep.eq({ status: 'conclusive', missingHashes: [] });
  });

  it('V2: unchanged counts as present', () => {
    const result = detect(swarmOf({ updated: [H1], unchanged: { [H2]: 12345 } }));

    expect(result).to.be.deep.eq({ status: 'conclusive', missingHashes: [] });
  });

  it('V3: absent from both arrays -> missing', () => {
    const result = detect(swarmOf({ updated: [H1], unchanged: {} }));

    expect(result).to.be.deep.eq({ status: 'conclusive', missingHashes: [H2] });
  });

  it('V4: one eligible snode reporting absence is sufficient', () => {
    const result = detect(
      swarmOf({ updated: [H1], unchanged: {} }, { updated: [H1, H2], unchanged: {} })
    );

    expect(result).to.be.deep.eq({ status: 'conclusive', missingHashes: [H2] });
  });

  it('V5: a failed sub-response is excluded, not read as absence', () => {
    const result = detect(
      swarmOf({ updated: [H1, H2], unchanged: {} }, { failed: true, timeout: true } as any)
    );

    expect(result).to.be.deep.eq({ status: 'conclusive', missingHashes: [] });
  });

  it('V6: every sub-response failed -> inconclusive, no recovery', () => {
    const result = detect(swarmOf({ failed: true } as any, { failed: true, code: 500 } as any));

    expect(result).to.be.deep.eq({ status: 'inconclusive' });
  });

  it('V7: snode holds nothing -> both hashes missing', () => {
    const result = detect(swarmOf({ updated: [], unchanged: {} }));

    expect(result).to.be.deep.eq({ status: 'conclusive', missingHashes: [H1, H2] });
  });

  it('V8: request did not set extend -> detection unavailable', () => {
    const result = detect(swarmOf({ updated: [H1] }), { requestSetExtend: false });

    expect(result).to.be.deep.eq({ status: 'unavailable' });
  });

  it('V9: multipart config parts are evaluated independently', () => {
    const [P1, P2, P3] = ['part1', 'part2', 'part3'];

    const result = detect(swarmOf({ updated: [P1, P3], unchanged: {} }), {
      requestedHashes: [P1, P2, P3],
    });

    // only the missing part is re-stored; "recovered" is the caller's call, and it needs all three
    expect(result).to.be.deep.eq({ status: 'conclusive', missingHashes: [P2] });
  });

  /**
   * V10-V13 are guard and action rules rather than properties of the response, so they are
   * covered where those live: V10 (poll+merge this session), V11 (obsolete hash set), V12
   * (kicked/destroyed group) and V13 (re-store once per session) are in
   * configRecovery_test.ts. Detection itself still reports MISSING in all four cases, which is
   * what these assert.
   */
  it('V10-V13: detection still reports missing; acting on it is guarded elsewhere', () => {
    const result = detect(swarmOf({ updated: [H1], unchanged: {} }));

    expect(result).to.be.deep.eq({ status: 'conclusive', missingHashes: [H2] });
  });

  it('V15: an EMPTY unchanged is a valid answer; an ABSENT one is not — same fixture, opposite verdicts', () => {
    // Split out of V7/V8b at planning's request, because the vector is about the DISTINCTION rather
    // than either endpoint. Conflating the two would silently disable recovery in the total-loss
    // case — the one case the feature exists for — so it is worth pinning as one assertion.
    const empty = detect(swarmOf({ updated: [], unchanged: {} }));
    const absent = detect(swarmOf({ updated: [] }));

    expect(empty, 'present-and-empty: the snode answered, and it holds neither hash').to.be.deep.eq(
      {
        status: 'conclusive',
        missingHashes: [H1, H2],
      }
    );
    expect(absent, 'absent: this response cannot tell presence from absence at all').to.be.deep.eq({
      status: 'inconclusive',
    });
  });

  describe('rules that are easy to get wrong', () => {
    it('an empty swarm is inconclusive, not "nothing missing"', () => {
      expect(detect({})).to.be.deep.eq({ status: 'inconclusive' });
      expect(detect(null)).to.be.deep.eq({ status: 'inconclusive' });
    });

    it('V8b: an ABSENT unchanged KEY excludes that sub-response — distinct from V8s flag', () => {
      // if this were read as "nothing was unchanged", H2 would look missing
      const result = detect(swarmOf({ updated: [H1] }));

      expect(result).to.be.deep.eq({ status: 'inconclusive' });
    });

    it('V8c: one unreadable sub-response alongside a readable one — the readable one is honoured', () => {
      const result = detect(
        swarmOf(
          { failed: true } as any,
          { updated: [H1], unchanged: { [H2]: 1 } },
          { updated: [] } // no unchanged key -> excluded
        )
      );

      expect(result).to.be.deep.eq({ status: 'conclusive', missingHashes: [] });
    });

    it('V14: asking about no hashes is INCONCLUSIVE, not "nothing missing"', () => {
      // This test previously asserted 'conclusive' — the natural short-circuit, and wrong. A
      // conclusive result outranks the empty-fetch check in the §3.5 authority table, so reporting
      // one here would make detection the authority for a swarm it never asked about, and the
      // check that should decide the no-hashes case could never fire.
      const result = detect(swarmOf({ updated: [], unchanged: {} }), { requestedHashes: [] });

      expect(result).to.be.deep.eq({ status: 'inconclusive' });
    });

    it('V14: an empty ask is inconclusive even when the request did set extend', () => {
      const result = detect(swarmOf({ updated: [], unchanged: {} }), {
        requestedHashes: [],
        requestSetExtend: true,
      });

      expect(
        result.status,
        'having asked correctly about nothing is still asking nothing'
      ).to.be.eq('inconclusive');
    });
  });
});
