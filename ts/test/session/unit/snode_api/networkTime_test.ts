import chai from 'chai';
import { beforeEach, describe } from 'mocha';
import Sinon from 'sinon';

import { TestUtils } from '../../../test-utils';
import { NetworkTime } from '../../../../util/NetworkTime';

const { expect } = chai;

describe('SnodeAPI:networkTime', () => {
  beforeEach(async () => {
    TestUtils.stubWindowLog();
    NetworkTime.reset();
  });

  afterEach(() => {
    Sinon.restore();
  });

  it('returns 0 if no timestamp offset is set yet', async () => {
    const offset = NetworkTime.getLatestTimestampOffset();
    expect(offset).to.be.eq(0);
  });

  it('returns first entry if only one was set', async () => {
    NetworkTime.setLatestTimestampOffset(10, 'first');
    const offset = NetworkTime.getLatestTimestampOffset();
    expect(offset).to.be.eq(10);
  });

  it('returns average if multiple entries are set', async () => {
    NetworkTime.setLatestTimestampOffset(10, 'first');
    NetworkTime.setLatestTimestampOffset(20, 'second');
    NetworkTime.setLatestTimestampOffset(30, 'third');
    const offset = NetworkTime.getLatestTimestampOffset();
    expect(offset).to.be.eq(20);
  });

  it('returns average if multiple entries are set (allows negative)', async () => {
    NetworkTime.setLatestTimestampOffset(10, 'first');
    NetworkTime.setLatestTimestampOffset(20, 'second');
    NetworkTime.setLatestTimestampOffset(-30, 'third');
    const offset = NetworkTime.getLatestTimestampOffset();
    expect(offset).to.be.eq(0);
  });

  it('returns average if all entries are set', async () => {
    NetworkTime.setLatestTimestampOffset(10, 'first');
    NetworkTime.setLatestTimestampOffset(20, 'second');
    NetworkTime.setLatestTimestampOffset(30, 'third');
    NetworkTime.setLatestTimestampOffset(40, 'fourth');
    NetworkTime.setLatestTimestampOffset(50, 'fifth');
    NetworkTime.setLatestTimestampOffset(60, 'sixth');
    NetworkTime.setLatestTimestampOffset(70, 'seventh');
    NetworkTime.setLatestTimestampOffset(80, 'eighth');
    NetworkTime.setLatestTimestampOffset(90, 'ninth');
    NetworkTime.setLatestTimestampOffset(100, 'tenth');
    const offset = NetworkTime.getLatestTimestampOffset();
    expect(offset).to.be.eq(55);
  });

  it('returns average if all entries are set (all the same)', async () => {
    NetworkTime.setLatestTimestampOffset(10, 'first');
    NetworkTime.setLatestTimestampOffset(10, 'second');
    NetworkTime.setLatestTimestampOffset(10, 'third');
    NetworkTime.setLatestTimestampOffset(10, 'fourth');
    NetworkTime.setLatestTimestampOffset(10, 'fifth');
    NetworkTime.setLatestTimestampOffset(10, 'sixth');
    NetworkTime.setLatestTimestampOffset(10, 'seventh');
    NetworkTime.setLatestTimestampOffset(10, 'eighth');
    NetworkTime.setLatestTimestampOffset(10, 'ninth');
    NetworkTime.setLatestTimestampOffset(10, 'tenth');
    const offset = NetworkTime.getLatestTimestampOffset();
    expect(offset).to.be.eq(10);
  });

  it('returns average if all entries are set overflowed', async () => {
    NetworkTime.setLatestTimestampOffset(10, 'first');
    NetworkTime.setLatestTimestampOffset(10, 'second');
    NetworkTime.setLatestTimestampOffset(10, 'third');
    NetworkTime.setLatestTimestampOffset(10, 'fourth');
    NetworkTime.setLatestTimestampOffset(10, 'fifth');
    NetworkTime.setLatestTimestampOffset(10, 'sixth');
    NetworkTime.setLatestTimestampOffset(10, 'seventh');
    NetworkTime.setLatestTimestampOffset(10, 'eighth');
    NetworkTime.setLatestTimestampOffset(10, 'ninth');
    NetworkTime.setLatestTimestampOffset(10, 'tenth');
    NetworkTime.setLatestTimestampOffset(100, 'first');
    NetworkTime.setLatestTimestampOffset(100, 'second');
    NetworkTime.setLatestTimestampOffset(100, 'third');
    const offset = NetworkTime.getLatestTimestampOffset();
    expect(offset).to.be.eq((3 * 100 + 10 * 7) / 10);
  });
});
