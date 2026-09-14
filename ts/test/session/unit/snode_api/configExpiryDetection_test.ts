import chai from 'chai';
import { describe } from 'mocha';

import { detectMissingConfigHashes } from '../../../../session/apis/snode_api/configExpiryDetection';
import { ExpireMessagesResultsContent } from '../../../../session/apis/snode_api/types';

const { expect } = chai;

/**
 * The shared detection vectors, one test each. iOS and Android implement the same rule separately,
 * and these vectors are the only thing keeping the three in agreement.
 *
 * So a vector failing here is a disagreement between clients, not a test that needs adjusting. If
 * one of these looks wrong, the other two implementations are the thing to check first — relaxing
 * it to make this client pass removes the only evidence that they have diverged.
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

  // The failed nodes below CARRY an `unchanged` array on purpose, and it must stay.
  //
  // Without it they are already unreadable, so the eligibility check excludes them on that ground
  // and never consults `failed` at all — the `failed` term could then be deleted with the whole
  // suite green. Verified: it was, and nothing died until these two fixtures gained the array.
  //
  // Carrying it also makes them the dangerous shape rather than a harmless one. A node that says it
  // failed but still reports arrays is exactly the input the term exists for: read as usable, its
  // empty arrays become authority and EVERY requested hash is reported missing — a false positive
  // that re-stores configs the swarm still holds, on the word of a node that told us it failed.
  it('V5: a failed sub-response is excluded, not read as absence', () => {
    const result = detect(
      swarmOf({ updated: [H1, H2], unchanged: {} }, {
        updated: [],
        unchanged: {},
        failed: true,
        timeout: true,
      } as any)
    );

    expect(result).to.be.deep.eq({ status: 'conclusive', missingHashes: [] });
  });

  it('V6: every sub-response failed -> inconclusive, no recovery', () => {
    const result = detect(
      swarmOf(
        { updated: [], unchanged: {}, failed: true } as any,
        { updated: [], unchanged: {}, failed: true, code: 500 } as any
      )
    );

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
      // The two unreadable nodes are unreadable for DIFFERENT reasons, and each is excludable only
      // by its own guard — otherwise this vector says "unreadable" while testing one route twice.
      // The failed node therefore carries full arrays (only `failed` can exclude it) and the other
      // omits `unchanged` (only the readability check can).
      const result = detect(
        swarmOf(
          { updated: [], unchanged: {}, failed: true } as any,
          { updated: [H1], unchanged: { [H2]: 1 } },
          { updated: [] } // no unchanged key -> excluded on that ground alone
        )
      );

      expect(result).to.be.deep.eq({ status: 'conclusive', missingHashes: [] });
    });

    it('V14: asking about no hashes is INCONCLUSIVE, not "nothing missing"', () => {
      // 'conclusive' is the natural short-circuit here, and it is wrong: a conclusive result
      // outranks the empty-fetch check, so reporting one for a swarm detection never asked about
      // would make detection the authority for it, and the check that should decide the no-hashes
      // case could never fire.
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
