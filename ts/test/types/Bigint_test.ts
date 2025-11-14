import { expect } from 'chai';
import Long from 'long';

import { bigIntToLong, longToBigInt } from '../../types/Bigint';

describe('Bigint', () => {
  describe('bigIntToLong', () => {
    it('0n equals 0', () => {
      expect(bigIntToLong(0n)).to.be.deep.eq(Long.fromNumber(0));
    });
    it('1000000000n equals 1000000000', () => {
      expect(bigIntToLong(1000000000n)).to.be.deep.eq(Long.fromNumber(1000000000));
    });
    it('max signed: 9223372036854775807 (2^63 - 1)', () => {
      expect(bigIntToLong(9223372036854775807n)).to.be.deep.eq(
        Long.fromString('9223372036854775807')
      );
    });
    it('-1000000000n equals -1000000000', () => {
      expect(bigIntToLong(-1000000000n)).to.be.deep.eq(Long.fromNumber(-1000000000));
    });
    it('min signed: -9223372036854775808 (-2^63)', () => {
      expect(bigIntToLong(-9223372036854775808n)).to.be.deep.eq(
        Long.fromString('-9223372036854775808')
      );
    });
  });

  describe('longToBigInt', () => {
    it('0 equals 0n', () => {
      expect(longToBigInt(Long.fromNumber(0))).to.be.deep.eq(0n);
    });
    it('1000000000 equals 1000000000n', () => {
      expect(longToBigInt(Long.fromNumber(1000000000))).to.be.deep.eq(1000000000n);
    });
    it('max signed: 9223372036854775807 (2^63 - 1)', () => {
      expect(longToBigInt(Long.fromString('9223372036854775807'))).to.be.deep.eq(
        9223372036854775807n
      );
    });
    it('-1000000000 equals -1000000000n', () => {
      expect(longToBigInt(Long.fromNumber(-1000000000))).to.be.deep.eq(-1000000000n);
    });
    it('min signed: -9223372036854775808 (-2^63)', () => {
      expect(longToBigInt(Long.fromString('-9223372036854775808'))).to.be.deep.eq(
        -9223372036854775808n
      );
    });
  });
});
