import { describe } from 'mocha';
import Sinon from 'sinon';
import Long from 'long';
import { expect } from 'chai';
import { TestUtils } from '../../../../test-utils';
import { shouldProcessContentMessage } from '../../../../../receiver/common';
import { DURATION } from '../../../../../session/constants';

describe('shouldProcessContentMessage', () => {
  let envelopeTs: number;
  beforeEach(() => {
    TestUtils.stubWindowLog();
    envelopeTs = Math.floor(Date.now() + Math.random() * 1000000);
  });

  afterEach(() => {
    Sinon.restore();
  });

  describe('not a community', () => {
    const isCommunity = false;
    describe('with sig timestamp', () => {
      it('if timestamps match: return true', async () => {
        expect(
          shouldProcessContentMessage({
            sentAtMs: envelopeTs,
            sigTimestampMs: envelopeTs,
            isCommunity,
          })
        ).to.eq(true);
      });
      it('if timestamps do not match: return false', async () => {
        expect(
          shouldProcessContentMessage({
            sentAtMs: envelopeTs,
            sigTimestampMs: envelopeTs + 2,
            isCommunity,
          })
        ).to.eq(false);
      });
    });
    describe('without sig timestamp', () => {
      it('if timestamps match or not: return true', async () => {
        expect(
          shouldProcessContentMessage({
            sentAtMs: envelopeTs,
            sigTimestampMs: undefined as any,
            isCommunity,
          })
        ).to.eq(true);
        expect(
          shouldProcessContentMessage({
            sentAtMs: envelopeTs,
            sigTimestampMs: 0,
            isCommunity,
          })
        ).to.eq(true);
        expect(
          shouldProcessContentMessage({
            sentAtMs: envelopeTs,
            sigTimestampMs: Long.fromNumber(0) as any,
            isCommunity,
          })
        ).to.eq(true);
      });
    });
  });

  describe('a community', () => {
    const isCommunity = true;
    describe('with sig timestamp', () => {
      it('if timestamps roughly match: return true', async () => {
        expect(
          shouldProcessContentMessage({
            sentAtMs: envelopeTs,
            sigTimestampMs: envelopeTs,
            isCommunity,
          }),
          'exact match'
        ).to.eq(true);
        expect(
          shouldProcessContentMessage({
            sentAtMs: envelopeTs,
            sigTimestampMs: envelopeTs + 6 * DURATION.HOURS - 1,
            isCommunity,
          }),
          'just below 6h of diff (positive)'
        ).to.eq(true);
        expect(
          shouldProcessContentMessage({
            sentAtMs: envelopeTs,
            sigTimestampMs: envelopeTs - 6 * DURATION.HOURS + 1,
            isCommunity,
          }),
          'just below 6h of diff (negative)'
        ).to.eq(true);
      });
      it('if timestamps do not roughly match: return false', async () => {
        expect(
          shouldProcessContentMessage({
            sentAtMs: envelopeTs,
            sigTimestampMs: envelopeTs + 6 * DURATION.HOURS + 1,
            isCommunity,
          }),
          'just above 6h of diff'
        ).to.eq(false);
        expect(
          shouldProcessContentMessage({
            sentAtMs: envelopeTs,
            sigTimestampMs: envelopeTs - 6 * DURATION.HOURS - 1,
            isCommunity,
          }),
          'just above 6h of diff'
        ).to.eq(false);
      });
    });
    describe('without sig timestamp', () => {
      it('if timestamps match or not: return true', async () => {
        expect(
          shouldProcessContentMessage({
            sentAtMs: envelopeTs,
            sigTimestampMs: undefined as any,
            isCommunity,
          }),
          'sigTimestamp undefined'
        ).to.eq(true);
        expect(
          shouldProcessContentMessage({
            sentAtMs: envelopeTs,
            sigTimestampMs: 0,
            isCommunity,
          }),
          'sigTimestamp 0 as number'
        ).to.eq(true);
        expect(
          shouldProcessContentMessage({
            sentAtMs: envelopeTs,
            sigTimestampMs: Long.fromNumber(0) as any,
            isCommunity,
          }),
          'sigTimestamp 0 as Long'
        ).to.eq(true);
      });
    });
  });
});
