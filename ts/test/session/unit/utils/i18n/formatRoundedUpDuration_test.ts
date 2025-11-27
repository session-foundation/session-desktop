import { expect } from 'chai';
import { formatRoundedUpDuration } from '../../../../../util/i18n/formatting/generics';

describe('formatRoundedUpDuration', () => {
  it('<= 0 returns 1 minute', () => {
    expect(formatRoundedUpDuration(-1)).to.equal('1 minute');
    expect(formatRoundedUpDuration(-1000)).to.equal('1 minute');
    expect(formatRoundedUpDuration(-3600000)).to.equal('1 minute');
  });

  it('minutes only', () => {
    expect(formatRoundedUpDuration(1000)).to.equal('1 minute');
    expect(formatRoundedUpDuration(59 * 1000)).to.equal('1 minute');
    expect(formatRoundedUpDuration(60 * 1000)).to.equal('1 minute');
    expect(formatRoundedUpDuration(2 * 60 * 1000)).to.equal('2 minutes');
    expect(formatRoundedUpDuration(59 * 60 * 1000)).to.equal('59 minutes');
  });

  it('hours only', () => {
    expect(formatRoundedUpDuration(60 * 60 * 1000)).to.equal('1 hour');
    expect(formatRoundedUpDuration(60 * 60 * 1000 + 1000)).to.equal('2 hours');
    expect(formatRoundedUpDuration(60 * 60 * 1000 + 59 * 1000)).to.equal('2 hours');
    expect(formatRoundedUpDuration(60 * 60 * 1000 + 60 * 1000)).to.equal('2 hours');
    expect(formatRoundedUpDuration(10 * 60 * 60 * 1000)).to.equal('10 hours');
    expect(formatRoundedUpDuration(23 * 60 * 60 * 1000 + 59 * 60 * 1000)).to.equal('24 hours');
  });

  it('days only', () => {
    expect(formatRoundedUpDuration(24 * 60 * 60 * 1000 + 1000)).to.equal('2 days');
    expect(formatRoundedUpDuration(24 * 60 * 60 * 1000 + 59 * 60 * 1000)).to.equal('2 days');
    expect(formatRoundedUpDuration(24 * 60 * 60 * 1000)).to.equal('1 day');
    expect(formatRoundedUpDuration(2 * 24 * 60 * 60 * 1000)).to.equal('2 days');
    expect(formatRoundedUpDuration(6 * 24 * 60 * 60 * 1000)).to.equal('6 days');
  });

  it('edge cases - exactly at boundaries', () => {
    // Exactly 1 minute
    expect(formatRoundedUpDuration(60 * 1000)).to.equal('1 minute');
    // Exactly 1 hour
    expect(formatRoundedUpDuration(60 * 60 * 1000)).to.equal('1 hour');
    // Exactly 1 day
    expect(formatRoundedUpDuration(24 * 60 * 60 * 1000)).to.equal('1 day');
    // Just under 1 hour (59m 59s)
    expect(formatRoundedUpDuration(59 * 60 * 1000 + 59 * 1000)).to.equal('60 minutes');
    // Just under 1 day (23h 59m 59s)
    expect(formatRoundedUpDuration(23 * 60 * 60 * 1000 + 59 * 60 * 1000 + 59 * 1000)).to.equal(
      '24 hours'
    );
  });

  it('rounding up examples from requirements', () => {
    // exactly 24 Days and 1 Minute
    expect(formatRoundedUpDuration(24 * 24 * 60 * 60 * 1000 + 60 * 1000)).to.equal('25 days');
    // exactly 24 hours and 1 minute
    expect(formatRoundedUpDuration(24 * 60 * 60 * 1000 + 60 * 1000)).to.equal('2 days');
    // exactly 23 hours and 59 minutes
    expect(formatRoundedUpDuration(23 * 60 * 60 * 1000 + 59 * 60 * 1000)).to.equal('24 hours');
    // exactly 33 minutes
    expect(formatRoundedUpDuration(33 * 60 * 1000)).to.equal('33 minutes');
    // exactly 1 minute
    expect(formatRoundedUpDuration(1 * 60 * 1000)).to.equal('1 minute');
    // exactly 10 seconds
    expect(formatRoundedUpDuration(10 * 1000)).to.equal('1 minute');
  });
});
